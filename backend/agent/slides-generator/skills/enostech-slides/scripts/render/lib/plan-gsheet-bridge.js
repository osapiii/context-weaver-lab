'use strict';

/**
 * plan-gsheet-bridge.js
 * ============================================================
 * Phase 1.5 plan.json ⇄ Google Sheets 双方向ブリッジの中核ユーティリティ。
 *
 * 役割:
 *   - plan.json を 6 シート分のフラットな payload (rows of cells) に展開する
 *   - 6 シート分の payload を plan.json に **マージ** (深いフィールドは温存)
 *   - 入出力時の Zod 検証 / 整合チェック / Diff サマリ生成
 *
 * シート構成 (詳細は SKILL.md の Phase 1.5 章を参照):
 *   1. doc-meta       … doc レベルメタ (key/value/desc)
 *   2. questions      … qa_driven 時の questions[]
 *   3. chapters       … body.chapters[] 概観
 *   4. slides         … 全スライドを flat に並べた構造表
 *   5. references     … doc.references[]
 *   6. notes          … 編集者のフリーフォームメモ
 *
 * このモジュール自体は Google API を一切叩かない (純関数)。
 * gws CLI 呼び出しは plan-to-gsheet.js / gsheet-to-plan.js が担当する。
 */

const VERSION = '9.36.0';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const TEMPLATE_ID_ENUM = [
  // SECTION
  'SECTION-1', 'SECTION-1A', 'SECTION-1B', 'SECTION-1C', 'SECTION-1D', 'SECTION-1E', 'SECTION-1F',
  'SECTION-2', 'SECTION-3', 'SECTION-4', 'SECTION-5', 'SECTION-6',
  // SECSUMMARY
  'SECSUMMARY-1',
  // QA
  'QA-INDEX',
  // FRAMING
  'FRAMING-1', 'FRAMING-2', 'FRAMING-3', 'FRAMING-4', 'FRAMING-5',
  // LIST
  'LIST-1', 'LIST-2', 'LIST-3', 'LIST-4', 'LIST-5', 'LIST-6', 'LIST-7', 'LIST-8', 'LIST-9',
  // COMPARE
  'COMPARE-1', 'COMPARE-2', 'COMPARE-3', 'COMPARE-4', 'COMPARE-5', 'COMPARE-6',
  // DATA
  'DATA-1', 'DATA-2', 'DATA-3', 'DATA-4', 'DATA-5',
  // DIAGRAM
  'DIAGRAM-1', 'DIAGRAM-2', 'DIAGRAM-3', 'DIAGRAM-4',
  // PROJECT
  'PROJECT-1', 'PROJECT-2', 'PROJECT-3', 'PROJECT-4',
  // VISUAL
  'VISUAL-1', 'VISUAL-2', 'VISUAL-3', 'VISUAL-4', 'VISUAL-5', 'VISUAL-6', 'VISUAL-7', 'VISUAL-8', 'VISUAL-9',
  // WEBPAGE
  'WEBPAGE-1', 'WEBPAGE-2', 'WEBPAGE-3', 'WEBPAGE-4',
  // CODE
  'CODE-1', 'CODE-2', 'CODE-3', 'CODE-4', 'CODE-5', 'CODE-6', 'CODE-7',
  // CHART
  'CHART-01', 'CHART-02', 'CHART-03', 'CHART-04', 'CHART-05', 'CHART-06', 'CHART-07', 'CHART-08', 'CHART-09',
  'CHART-A1', 'CHART-A2', 'CHART-A3', 'CHART-A4',
];

const QUESTION_KIND_ENUM = ['definitional', 'how_to', 'risk', 'comparative', 'decisional', 'why'];
const NARRATION_ANCHOR_ENUM = ['起', '承', '転', '結', '-'];
const CHAPTER_ROLE_ENUM = ['header', 'chapter', 'footer'];
const SLIDE_ROLE_ENUM = ['header', 'head', 'content', 'tail', 'footer'];

const DECK_MODE_ENUM = ['template', 'free'];

const REQUIRED_DOC_META_KEYS = [
  { key: 'title',                 desc: 'デッキタイトル' },
  { key: 'subtitle',               desc: 'サブコピー / theme_desc / cover lead' },
  { key: 'deck_mode',              desc: 'template (テンプレベース・推奨) / free (フリーベース・反復型)' },
  { key: 'deck_structure',         desc: 'learning-deck / news-summary / proposal-deck / case-study-deck (free モードでは省略可)' },
  { key: 'deck_structure_version', desc: 'Template バージョン (例: "1.0")' },
  { key: 'qa_driven',              desc: 'Phase 1 で questions[] 駆動するか (true/false)' },
  { key: 'narration_strict',       desc: 'WritingQA-19 等を fatal 昇格するか (true/false)' },
  { key: 'audience',               desc: '想定読者 (人物像 / 業界知識レベル)' },
  { key: 'purpose',                desc: 'デッキの目的 (提案 / 学習 / etc)' },
  { key: 'theme',                  desc: 'メインテーマキーワード' },
  { key: 'theme_desc',             desc: 'テーマの一行説明' },
  { key: 'before_after_before',    desc: '読者の Before (今の状態)' },
  { key: 'before_after_after',     desc: '読者の After (読後の変化)' },
  { key: 'phase2_locked',          desc: 'Phase 2 完了マーカー (true/false)' },
  { key: 'gsheet_url',             desc: 'Phase 1.5 連携シートの URL (auto-filled)' },
];

function clean(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isBoolLike(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return ['true', 'false', 'yes', 'no', '1', '0', 'はい', 'いいえ', '○', '✕'].includes(t);
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase();
  if (['true', 'yes', '1', 'はい', '○'].includes(t)) return true;
  if (['false', 'no', '0', 'いいえ', '✕'].includes(t)) return false;
  return undefined;
}

function joinList(arr) {
  if (!arr) return '';
  if (Array.isArray(arr)) return arr.map(clean).join(', ');
  return clean(arr);
}

function splitList(s) {
  if (s == null) return [];
  if (Array.isArray(s)) return s.map(x => String(x).trim()).filter(Boolean);
  return String(s)
    .split(/[,、\s]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function chapterRoleOf(chapter) {
  if (chapter.role) return chapter.role;
  return 'chapter';
}

// ─────────────────────────────────────────────────────────
// Export: plan.json → 6 シート payload
// ─────────────────────────────────────────────────────────

function planToGsheetPayload(plan) {
  const docMeta = buildDocMetaRows(plan);
  const questions = buildQuestionsRows(plan);
  const chapters = buildChaptersRows(plan);
  const slides = buildSlidesRows(plan);
  const references = buildReferencesRows(plan);
  const notes = buildNotesRows(plan);

  return {
    version: VERSION,
    sheets: { docMeta, questions, chapters, slides, references, notes },
    enums: {
      template_id: TEMPLATE_ID_ENUM,
      question_kind: QUESTION_KIND_ENUM,
      narration_anchor: NARRATION_ANCHOR_ENUM,
      chapter_role: CHAPTER_ROLE_ENUM,
      slide_role: SLIDE_ROLE_ENUM,
    },
  };
}

function buildDocMetaRows(plan) {
  const doc = plan.doc || {};
  const ba = doc.before_after || {};
  const map = {
    title:                 clean(doc.title),
    subtitle:              clean(doc.theme_desc || doc.subtitle || ''),
    // deck_mode は元データに無ければ空のまま (import で誤って "template" を補完しないため)
    deck_mode:             clean(doc.deck_mode || ''),
    deck_structure:        clean(doc.deck_structure),
    deck_structure_version: clean(doc.deck_structure_version),
    qa_driven:             clean(doc.qa_driven),
    narration_strict:      clean(doc.narration_strict),
    audience:              clean(doc.reader || doc.audience || ''),
    purpose:               clean(doc.purpose),
    theme:                 clean(doc.theme),
    theme_desc:            clean(doc.theme_desc),
    before_after_before:   clean(ba.before || ba.before_state || ''),
    before_after_after:    clean(ba.after || ba.after_state || ''),
    phase2_locked:         clean(doc.phase2_locked),
    gsheet_url:            clean(doc.gsheet_url),
  };
  const header = ['key', 'value', 'description'];
  const rows = [header];
  for (const m of REQUIRED_DOC_META_KEYS) {
    rows.push([m.key, map[m.key] ?? '', m.desc]);
  }
  return rows;
}

function buildQuestionsRows(plan) {
  const questions = (plan.doc && plan.doc.questions) || [];
  const header = ['Q#', 'text', 'kind', 'provisionalDirection', 'shortSummary', 'refIndex', 'sectionIndex'];
  const rows = [header];
  for (const q of questions) {
    rows.push([
      clean(q.id),
      clean(q.text),
      clean(q.kind),
      clean(q.provisionalDirection),
      clean(q.shortSummary),
      joinList(q.refIndex),
      joinList(q.sectionIndex),
    ]);
  }
  return rows;
}

function buildChaptersRows(plan) {
  const header = ['section_id', 'role', 'title', 'overview', 'narration_anchor', 'source_questions'];
  const rows = [header];

  // header virtual chapter
  rows.push(['header', 'header', '— 序盤固定枠 (header) —', '表紙〜目次〜QA 早見表', '-', '']);

  for (const ch of (plan.body && plan.body.chapters) || []) {
    rows.push([
      clean(ch.id),
      chapterRoleOf(ch),
      clean(ch.name || ch.title),
      clean(ch.overview || ch.description || ''),
      clean(ch.narration_anchor || ch.anchor || '-'),
      joinList(ch.source_questions || ch.answers_questions),
    ]);
  }

  // footer virtual chapter
  rows.push(['footer', 'footer', '— 末尾固定枠 (footer) —', '参考情報集 / お土産 / 会社紹介', '-', '']);
  return rows;
}

function buildSlidesRows(plan) {
  const header = [
    'slide_id', 'section_id', 'order', 'template_id', 'role',
    'title', 'subtitle', 'answers_questions', 'content_summary', 'speaker_notes_hint',
  ];
  const rows = [header];

  let order = 0;
  const flat = flattenSlides(plan);
  for (const item of flat) {
    order += 1;
    const s = item.slide;
    rows.push([
      clean(s.id || `S${order}`),
      clean(item.section_id),
      String(order),
      clean(s.template_id),
      clean(item.slide_role),
      clean(s.title),
      clean(s.subtitle),
      joinList(s.answers_questions),
      summarizeSlideContent(s),
      summarizeSpeakerNotes(s),
    ]);
  }
  return rows;
}

function refIdOf(r, idx) {
  if (r.id != null) return String(r.id);
  if (r.ref_id != null) return String(r.ref_id);
  if (r.num != null) return String(r.num);
  return String(idx + 1);
}

function buildReferencesRows(plan) {
  const refs = (plan.doc && plan.doc.references) || [];
  const header = ['ref_id', 'title', 'author', 'url', 'type', 'year'];
  const rows = [header];
  refs.forEach((r, i) => {
    rows.push([
      refIdOf(r, i),
      clean(r.title),
      clean(r.author || r.publisher || r.source || ''),
      clean(r.url || ''),
      clean(r.type || r.kind || r.category || ''),
      clean(r.year || r.date || ''),
    ]);
  });
  return rows;
}

function buildNotesRows(plan) {
  // 編集者用フリーフォーム。export 時は plan.doc.gsheet_notes[] からシードを引く
  const notes = (plan.doc && plan.doc.gsheet_notes) || [];
  const rows = [['notes (このシートのメモは plan.json には反映されません — Phase 1.5 編集中の AI 向け追加指示や懸念点を自由に書き込んでください)']];
  for (const n of notes) rows.push([clean(n)]);
  if (rows.length === 1) rows.push(['']);
  return rows;
}

// ─────────────────────────────────────────────────────────
// Flatten / summarize helpers
// ─────────────────────────────────────────────────────────

function flattenSlides(plan) {
  const out = [];
  for (const s of plan.header || []) {
    out.push({ slide: s, section_id: 'header', slide_role: 'header' });
  }
  for (const ch of (plan.body && plan.body.chapters) || []) {
    for (const s of ch.head || []) {
      out.push({ slide: s, section_id: ch.id, slide_role: 'head' });
    }
    for (const s of ch.content || []) {
      out.push({ slide: s, section_id: ch.id, slide_role: 'content' });
    }
    for (const s of ch.tail || []) {
      out.push({ slide: s, section_id: ch.id, slide_role: 'tail' });
    }
  }
  for (const s of plan.footer || []) {
    out.push({ slide: s, section_id: 'footer', slide_role: 'footer' });
  }
  return out;
}

function summarizeSlideContent(s) {
  const parts = [];
  if (s.eyebrow) parts.push(`eyebrow: ${truncate(s.eyebrow, 30)}`);
  if (s.lead) parts.push(`lead: ${truncate(s.lead, 60)}`);
  if (Array.isArray(s.cards)) parts.push(`cards: ${s.cards.length} 件`);
  if (Array.isArray(s.points)) parts.push(`points: ${s.points.length} 件`);
  if (Array.isArray(s.bullets)) parts.push(`bullets: ${s.bullets.length} 件`);
  if (Array.isArray(s.items)) parts.push(`items: ${s.items.length} 件`);
  if (Array.isArray(s.rows)) parts.push(`rows: ${s.rows.length} 行`);
  if (s.diagram) parts.push(`diagram: ${s.diagram.template_id || 'set'}`);
  if (s.scene) parts.push(`scene: ${s.scene.template_id || 'set'}`);
  if (s.chart) parts.push(`chart: ${s.chart.template_id || 'set'}`);
  if (s.html_supplement && s.html_supplement.enabled) parts.push('html_supplement: ON');
  return parts.join(' / ');
}

function summarizeSpeakerNotes(s) {
  if (typeof s.speaker_notes === 'string') return truncate(s.speaker_notes, 120);
  if (s.speaker_notes && typeof s.speaker_notes === 'object') {
    const lines = [];
    for (const k of ['hook', 'main', 'detail', 'bridge']) {
      if (s.speaker_notes[k]) lines.push(`${k}: ${truncate(String(s.speaker_notes[k]), 50)}`);
    }
    return lines.join(' | ');
  }
  return '';
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─────────────────────────────────────────────────────────
// Import: 6 シート payload → plan.json (merge)
// ─────────────────────────────────────────────────────────

function gsheetPayloadToPlan(originalPlan, payload) {
  if (!payload || !payload.sheets) {
    throw new Error('plan-gsheet-bridge: payload.sheets が必要です');
  }
  const sheets = payload.sheets;
  const newPlan = JSON.parse(JSON.stringify(originalPlan)); // deep clone

  const warnings = [];
  const diff = { docMeta: [], questions: [], chapters: [], slides: [], references: [] };

  applyDocMeta(newPlan, sheets.docMeta || [], warnings, diff);
  applyQuestions(newPlan, sheets.questions || [], warnings, diff);
  applyChaptersAndSlides(newPlan, originalPlan, sheets.chapters || [], sheets.slides || [], warnings, diff);
  applyReferences(newPlan, sheets.references || [], warnings, diff);

  // 注意: notes シートは plan.json に反映しない (osanai 氏要望)
  return { plan: newPlan, warnings, diff };
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const header = rows[0].map(s => String(s).trim());
  return rows.slice(1).map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = r[i] != null ? r[i] : ''; });
    return obj;
  });
}

function applyDocMeta(plan, rows, warnings, diff) {
  const objs = rowsToObjects(rows);
  const map = {};
  for (const o of objs) {
    if (o.key) map[String(o.key).trim()] = o.value;
  }
  plan.doc = plan.doc || {};
  const doc = plan.doc;
  function setStr(field, v) {
    const s = clean(v);
    if (s === '') return;
    if (doc[field] !== s) {
      diff.docMeta.push({ key: field, before: doc[field], after: s });
      doc[field] = s;
    }
  }
  function setBool(field, v) {
    if (v == null || v === '') return;
    const b = parseBool(v);
    if (b == null) {
      warnings.push(`doc-meta: ${field}="${v}" は true/false に解釈できません`);
      return;
    }
    if (doc[field] !== b) {
      diff.docMeta.push({ key: field, before: doc[field], after: b });
      doc[field] = b;
    }
  }
  setStr('title', map.title);
  setStr('theme_desc', map.theme_desc || map.subtitle);
  if (map.deck_mode) {
    const m = String(map.deck_mode).trim().toLowerCase();
    if (!DECK_MODE_ENUM.includes(m)) {
      warnings.push(`doc-meta: deck_mode="${map.deck_mode}" は ${DECK_MODE_ENUM.join('/')} のいずれかである必要があります`);
    } else {
      setStr('deck_mode', m);
    }
  }
  setStr('deck_structure', map.deck_structure);
  setStr('deck_structure_version', map.deck_structure_version);
  setBool('qa_driven', map.qa_driven);
  setBool('narration_strict', map.narration_strict);
  setStr('reader', map.audience);
  setStr('purpose', map.purpose);
  setStr('theme', map.theme);
  setBool('phase2_locked', map.phase2_locked);
  if (map.gsheet_url) setStr('gsheet_url', map.gsheet_url);

  if (map.before_after_before || map.before_after_after) {
    doc.before_after = doc.before_after || {};
    if (map.before_after_before && doc.before_after.before !== map.before_after_before) {
      diff.docMeta.push({ key: 'before_after.before', before: doc.before_after.before, after: map.before_after_before });
      doc.before_after.before = String(map.before_after_before);
    }
    if (map.before_after_after && doc.before_after.after !== map.before_after_after) {
      diff.docMeta.push({ key: 'before_after.after', before: doc.before_after.after, after: map.before_after_after });
      doc.before_after.after = String(map.before_after_after);
    }
  }
}

function applyQuestions(plan, rows, warnings, diff) {
  const objs = rowsToObjects(rows);
  if (!plan.doc) plan.doc = {};
  const beforeRaw = plan.doc.questions;
  const before = beforeRaw || [];
  const beforeById = new Map(before.map(q => [String(q.id), q]));
  const afterArr = [];
  for (const o of objs) {
    const id = String(o['Q#'] || '').trim();
    const text = String(o.text || '').trim();
    if (!id && !text) continue;
    const q = beforeById.get(id) || {};
    const merged = { ...q };
    merged.id = id || q.id;
    merged.text = text || q.text;
    const kindStr = String(o.kind || q.kind || '').trim();
    if (kindStr) merged.kind = kindStr;
    const dirStr = String(o.provisionalDirection || q.provisionalDirection || '').trim();
    if (dirStr) merged.provisionalDirection = dirStr;
    const shortStr = String(o.shortSummary || q.shortSummary || '').trim();
    if (shortStr) merged.shortSummary = shortStr;
    // refIndex / sectionIndex: 元データに無くシートも空なら付けない (identity 保持)
    const refStr = o.refIndex != null ? String(o.refIndex) : '';
    if (refStr.trim()) merged.refIndex = splitList(refStr);
    else if ('refIndex' in q) merged.refIndex = q.refIndex;
    const secStr = o.sectionIndex != null ? String(o.sectionIndex) : '';
    if (secStr.trim()) merged.sectionIndex = splitList(secStr);
    else if ('sectionIndex' in q) merged.sectionIndex = q.sectionIndex;
    if (merged.kind && !QUESTION_KIND_ENUM.includes(merged.kind)) {
      warnings.push(`questions: ${merged.id} kind="${merged.kind}" は ${QUESTION_KIND_ENUM.join('/')} のいずれかである必要があります`);
    }
    afterArr.push(merged);
  }
  // diff: 追加 / 削除 / 編集
  const beforeIds = new Set(before.map(q => q.id));
  const afterIds = new Set(afterArr.map(q => q.id));
  for (const id of afterIds) if (!beforeIds.has(id)) diff.questions.push({ kind: 'added', id });
  for (const id of beforeIds) if (!afterIds.has(id)) diff.questions.push({ kind: 'removed', id });
  for (const q of afterArr) {
    const b = beforeById.get(String(q.id));
    if (b && JSON.stringify(b) !== JSON.stringify(q)) diff.questions.push({ kind: 'edited', id: q.id });
  }
  // 元 plan に questions フィールドが無く、シートにも実データが無いなら付けない (identity 保持)
  if (afterArr.length === 0 && !beforeRaw) {
    return; // do nothing
  }
  plan.doc.questions = afterArr;
}

function applyChaptersAndSlides(newPlan, originalPlan, chapterRows, slideRows, warnings, diff) {
  // build slide index of the original plan for "preserve deep fields"
  const origSlideById = new Map();
  for (const item of flattenSlides(originalPlan)) {
    if (item.slide.id) origSlideById.set(String(item.slide.id), item.slide);
  }

  // 1) Parse chapters sheet — virtual header/footer rows are skipped
  const chapterObjs = rowsToObjects(chapterRows).filter(o =>
    o.section_id && !['header', 'footer', '(header)', '(footer)'].includes(String(o.section_id).trim())
  );

  // 2) Parse slides sheet
  const slideObjs = rowsToObjects(slideRows).filter(o => o.template_id || o.slide_id);

  // Group slide rows by section_id and role
  const headerSlides = [];
  const footerSlides = [];
  const bySection = new Map(); // section_id -> { head, content, tail }
  for (const o of slideObjs) {
    const sec = String(o.section_id || '').trim();
    const role = String(o.role || '').trim().toLowerCase();
    const slide = mergeSlideRow(o, origSlideById, warnings);
    if (sec === 'header' || role === 'header') {
      headerSlides.push(slide);
    } else if (sec === 'footer' || role === 'footer') {
      footerSlides.push(slide);
    } else {
      if (!bySection.has(sec)) bySection.set(sec, { head: [], content: [], tail: [] });
      const bucket = bySection.get(sec);
      if (role === 'head') bucket.head.push(slide);
      else if (role === 'tail') bucket.tail.push(slide);
      else bucket.content.push(slide);
    }
  }

  // 3) Build new chapters preserving original chapter order if present
  const origChaptersById = new Map((originalPlan.body && originalPlan.body.chapters || []).map(c => [c.id, c]));
  const newChapters = [];
  for (const o of chapterObjs) {
    const id = String(o.section_id).trim();
    const orig = origChaptersById.get(id) || {};
    const role = String(o.role || orig.role || 'chapter').trim();
    if (role !== 'chapter') {
      // role 'header'/'footer' rows shouldn't appear here, skip
      continue;
    }
    const bucket = bySection.get(id) || { head: [], content: [], tail: [] };
    const merged = {
      ...orig,
      id,
      code: orig.code || deriveChapterCode(newChapters.length),
      name: String(o.title || orig.name || ''),
      head: bucket.head.length ? bucket.head : (orig.head || []),
      content: bucket.content.length ? bucket.content : (orig.content || []),
      tail: bucket.tail.length ? bucket.tail : (orig.tail || []),
    };
    const oldOverview = orig.overview || '';
    if (o.overview && String(o.overview).trim()) merged.overview = String(o.overview);
    const anc = String(o.narration_anchor || '').trim();
    if (anc && anc !== '-' && anc !== '') merged.narration_anchor = anc;
    if (o.source_questions && String(o.source_questions).trim()) merged.source_questions = splitList(o.source_questions);
    newChapters.push(merged);

    // diff
    const oldName = orig.name || '';
    if (oldName !== merged.name) diff.chapters.push({ id, kind: 'renamed', before: oldName, after: merged.name });
    if ((merged.overview || '') !== oldOverview) diff.chapters.push({ id, kind: 'overview-edited', before: truncate(oldOverview, 30), after: truncate(merged.overview || '', 30) });
  }

  // chapters added/removed diff
  const oldIds = new Set(origChaptersById.keys());
  const newIds = new Set(newChapters.map(c => c.id));
  for (const id of newIds) if (!oldIds.has(id)) diff.chapters.push({ id, kind: 'added' });
  for (const id of oldIds) if (!newIds.has(id)) diff.chapters.push({ id, kind: 'removed' });

  // slides diff
  const origSlideIds = new Set(Array.from(origSlideById.keys()));
  const newSlideIds = new Set();
  const newSlideById = new Map();
  function recordSlides(list, sec, role) {
    for (const s of list) {
      if (s.id) {
        newSlideIds.add(String(s.id));
        newSlideById.set(String(s.id), s);
      }
    }
  }
  recordSlides(headerSlides, 'header', 'header');
  recordSlides(footerSlides, 'footer', 'footer');
  for (const c of newChapters) {
    recordSlides(c.head, c.id, 'head');
    recordSlides(c.content, c.id, 'content');
    recordSlides(c.tail, c.id, 'tail');
  }
  for (const id of newSlideIds) if (!origSlideIds.has(id)) diff.slides.push({ id, kind: 'added' });
  for (const id of origSlideIds) if (!newSlideIds.has(id)) diff.slides.push({ id, kind: 'removed' });
  // edited: title / subtitle / template_id / answers_questions のいずれかが変わった
  for (const id of newSlideIds) {
    if (!origSlideIds.has(id)) continue;
    const o = origSlideById.get(id);
    const n = newSlideById.get(id);
    const compareKeys = ['title', 'subtitle', 'template_id', 'answers_questions'];
    for (const k of compareKeys) {
      const ov = JSON.stringify(o && o[k] || '');
      const nv = JSON.stringify(n && n[k] || '');
      if (ov !== nv) {
        diff.slides.push({ id, kind: `edited:${k}` });
        break;
      }
    }
  }

  newPlan.header = headerSlides.length ? headerSlides : (originalPlan.header || []);
  newPlan.body = newPlan.body || {};
  newPlan.body.chapters = newChapters.length ? newChapters : (originalPlan.body && originalPlan.body.chapters) || [];
  newPlan.footer = footerSlides.length ? footerSlides : (originalPlan.footer || []);
}

function deriveChapterCode(idx) {
  return String.fromCharCode('B'.charCodeAt(0) + idx); // B, C, D, ...
}

function mergeSlideRow(row, origSlideById, warnings) {
  const id = String(row.slide_id || '').trim();
  const orig = id && origSlideById.get(id) ? origSlideById.get(id) : {};
  const merged = { ...orig };
  if (id) merged.id = id;
  if (row.template_id) {
    const tid = String(row.template_id).trim();
    if (!TEMPLATE_ID_ENUM.includes(tid)) {
      warnings.push(`slides: ${id || '(new)'} template_id="${tid}" は既知 ID ではありません (許容: ${TEMPLATE_ID_ENUM.length} 種)`);
    }
    merged.template_id = tid;
  }
  if (row.title) merged.title = String(row.title);
  if (row.subtitle) merged.subtitle = String(row.subtitle);
  if (row.answers_questions) merged.answers_questions = splitList(row.answers_questions);
  // section_id は仮想ラベル (header/footer) を plan.json の元値に上書きさせない
  if (row.section_id) {
    const newSec = String(row.section_id).trim();
    const origSec = orig.section_id;
    const isVirtual = (newSec === 'header' || newSec === 'footer');
    if (isVirtual && origSec && origSec !== newSec) {
      // sheet で 'header'/'footer' と表示されていても元の `_header`/`_footer` 等を保持
    } else {
      merged.section_id = newSec;
    }
  }
  // content_summary / speaker_notes_hint は plan.json には反映しない (要約用)
  return merged;
}

function applyReferences(plan, rows, warnings, diff) {
  const objs = rowsToObjects(rows);
  if (!plan.doc) plan.doc = {};
  const before = plan.doc.references || [];
  const beforeById = new Map(before.map((r, i) => [refIdOf(r, i), r]));
  const after = [];
  for (const o of objs) {
    const id = String(o.ref_id || '').trim();
    const title = String(o.title || '').trim();
    if (!id && !title) continue;
    const orig = beforeById.get(id) || {};
    // 深いフィールド (num, category, source, note, cited_by, …) を全て温存
    const merged = { ...orig };
    // ID は元データに id / ref_id / num のどれが使われていたかを尊重して書き戻す
    if ('id' in orig) merged.id = id || orig.id;
    else if ('ref_id' in orig) merged.ref_id = id || orig.ref_id;
    else if ('num' in orig) {
      // num は数値のままにする (元仕様維持)
      const numId = /^\d+$/.test(id) ? Number(id) : id;
      merged.num = numId !== '' ? numId : orig.num;
    } else {
      // 新規行: id を string で付与
      merged.id = id || String(after.length + 1);
    }
    if (title) merged.title = title;
    // 浅い列は値があれば上書き、空なら元値温存
    if (o.author && String(o.author).trim()) {
      // author 列は元データの author / publisher / source のうち存在したものを優先
      if ('author' in orig) merged.author = String(o.author).trim();
      else if ('publisher' in orig) merged.publisher = String(o.author).trim();
      else if ('source' in orig) merged.source = String(o.author).trim();
      else merged.author = String(o.author).trim();
    }
    if (o.url && String(o.url).trim()) merged.url = String(o.url).trim();
    if (o.type && String(o.type).trim()) {
      if ('type' in orig) merged.type = String(o.type).trim();
      else if ('kind' in orig) merged.kind = String(o.type).trim();
      else if ('category' in orig) merged.category = String(o.type).trim();
      else merged.type = String(o.type).trim();
    }
    if (o.year && String(o.year).trim()) merged.year = String(o.year).trim();
    after.push(merged);
  }
  const oldIds = new Set(before.map((r, i) => refIdOf(r, i)));
  const newIds = new Set(after.map((r, i) => refIdOf(r, i)));
  for (const id of newIds) if (!oldIds.has(id)) diff.references.push({ id, kind: 'added' });
  for (const id of oldIds) if (!newIds.has(id)) diff.references.push({ id, kind: 'removed' });
  plan.doc.references = after;
}

// ─────────────────────────────────────────────────────────
// Diff summarization
// ─────────────────────────────────────────────────────────

function summarizeDiff(diff) {
  const lines = [];
  if (diff.docMeta && diff.docMeta.length) {
    lines.push(`[doc-meta] ${diff.docMeta.length} 件変更`);
    diff.docMeta.slice(0, 6).forEach(d => lines.push(`  - ${d.key}: ${truncate(JSON.stringify(d.before), 30)} → ${truncate(JSON.stringify(d.after), 30)}`));
  }
  if (diff.questions && diff.questions.length) {
    const a = diff.questions.filter(d => d.kind === 'added').map(d => d.id);
    const r = diff.questions.filter(d => d.kind === 'removed').map(d => d.id);
    const e = diff.questions.filter(d => d.kind === 'edited').map(d => d.id);
    lines.push(`[questions] +${a.length} -${r.length} ~${e.length}` +
      (a.length ? ` added=${a.join(',')}` : '') +
      (r.length ? ` removed=${r.join(',')}` : '') +
      (e.length ? ` edited=${e.join(',')}` : ''));
  }
  if (diff.chapters && diff.chapters.length) {
    lines.push(`[chapters] ${diff.chapters.length} 件変更`);
    diff.chapters.slice(0, 6).forEach(d => lines.push(`  - ${d.kind}: ${d.id}` + (d.before != null ? ` (${truncate(d.before, 20)} → ${truncate(d.after, 20)})` : '')));
  }
  if (diff.slides && diff.slides.length) {
    const a = diff.slides.filter(d => d.kind === 'added').map(d => d.id);
    const r = diff.slides.filter(d => d.kind === 'removed').map(d => d.id);
    const e = diff.slides.filter(d => String(d.kind).startsWith('edited:'));
    const editedIds = [...new Set(e.map(d => d.id))];
    lines.push(`[slides] +${a.length} -${r.length} ~${editedIds.length}` +
      (a.length ? ` added=${a.slice(0, 6).join(',')}${a.length > 6 ? '…' : ''}` : '') +
      (r.length ? ` removed=${r.slice(0, 6).join(',')}${r.length > 6 ? '…' : ''}` : '') +
      (editedIds.length ? ` edited=${editedIds.slice(0, 6).join(',')}${editedIds.length > 6 ? '…' : ''}` : ''));
  }
  if (diff.references && diff.references.length) {
    lines.push(`[references] ${diff.references.length} 件変更`);
  }
  return lines.length ? lines.join('\n') : '(no changes)';
}

// ─────────────────────────────────────────────────────────
// Module exports
// ─────────────────────────────────────────────────────────

module.exports = {
  VERSION,
  TEMPLATE_ID_ENUM,
  QUESTION_KIND_ENUM,
  NARRATION_ANCHOR_ENUM,
  CHAPTER_ROLE_ENUM,
  SLIDE_ROLE_ENUM,
  DECK_MODE_ENUM,
  REQUIRED_DOC_META_KEYS,
  planToGsheetPayload,
  gsheetPayloadToPlan,
  flattenSlides,
  rowsToObjects,
  summarizeDiff,
};
