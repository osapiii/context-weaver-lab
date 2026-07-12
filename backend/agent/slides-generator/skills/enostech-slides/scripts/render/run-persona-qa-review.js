#!/usr/bin/env node
/**
 * run-persona-qa-review.js
 * ──────────────────────────────────────────────────────────
 * QA 駆動モード (`doc.qa_driven=true`) のデッキで、4 ペルソナが
 * 「自分の立場で各 Q の答えをスライドから探しに行く」レビューを生成する CLI。
 *
 * 既存 run-pawapo-dekitaro-qa.js (規則ベース) と異なり、本ツールは LLM 介在が必須。
 * Claude (osanai さんが Cowork で動かす Claude) が手動で実行する想定。
 *
 * 役割:
 *   - plan.json から questions[] と全 slide content を抽出
 *   - 既存 reviews[] から 4 ペルソナを引き当てる
 *   - 各ペルソナ向けに per_question_findings の空 skeleton を生成
 *   - 各ペルソナ向けの LLM プロンプトを別ファイルに出力 (--prompts-out)
 *   - LLM 出力 JSON を受け取って plan.json に merge する mode (--findings-in)
 *   - reviews[] に review_type='persona-qa-review' のサイクルを push (重複は置換)
 *
 * 使い方:
 *   # 1. プロンプト + skeleton 生成 (Claude が手動で叩く前)
 *   node run-persona-qa-review.js -i plan.json --prompts-out ./qa-review-prompts/
 *
 *   # 2. LLM 出力 (JSON) を受け取って plan.json に merge (Claude 完了後)
 *   node run-persona-qa-review.js -i plan.json --findings-in ./qa-review-findings.json
 *
 *   # 3. quiet モード (run-qa.py から呼ぶ時)
 *   node run-persona-qa-review.js -i plan.json --prompts-out ./prompts/ --quiet
 *
 * 詳細仕様: references/phase4-qa/persona-qa-review-prompt.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { PersonaQAReviewSchema } = require('./schemas/common');

// ─── 引数パース ──────────────────────────────────────
function parseArgs(argv) {
  const args = { input: null, promptsOut: null, findingsIn: null, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-i' || a === '--input') args.input = argv[++i];
    else if (a === '--prompts-out') args.promptsOut = argv[++i];
    else if (a === '--findings-in') args.findingsIn = argv[++i];
    else if (a === '--quiet' || a === '-q') args.quiet = true;
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf-8').split('\n').slice(1, 32).join('\n'));
      process.exit(0);
    }
  }
  return args;
}

function log(msg, quiet) {
  if (!quiet) console.error(`[persona-qa-review] ${msg}`);
}

// ─── スライド収集 (v9 / v8 / v6 系の全形式に対応) ───
function gatherSlides(data) {
  const slides = [];
  const seen = new Set();
  function push(s) {
    if (!s || !s.id || seen.has(s.id)) return;
    seen.add(s.id);
    slides.push(s);
  }
  if (Array.isArray(data.header)) data.header.forEach(push);
  if (data.body) {
    if (Array.isArray(data.body)) {
      data.body.forEach(push);
    } else if (Array.isArray(data.body.chapters)) {
      for (const ch of data.body.chapters) {
        for (const s of (ch.head || [])) push(s);
        for (const s of (ch.content || [])) push(s);
        for (const s of (ch.tail || [])) push(s);
      }
    }
  }
  if (Array.isArray(data.footer)) data.footer.forEach(push);
  if (Array.isArray(data.sections)) {
    data.sections.forEach(sec => {
      if (Array.isArray(sec.slides)) sec.slides.forEach(push);
    });
  }
  return slides;
}

// ─── 既存 reviews[] から 4 ペルソナを抽出 ──────
function extractPersonas(reviews) {
  if (!Array.isArray(reviews)) return [];
  const out = [];
  const seenNames = new Set();
  for (const r of reviews) {
    // qa-review はスキップ (重複防止のため自前で除外)
    if (r && r.review_type === 'persona-qa-review') continue;
    // dekitaro (title-subcopy-qa) もスキップ — 専門家枠で、generic 4 ペルソナとは別
    if (r && r.review_type === 'title-subcopy-qa') continue;
    if (r && r.persona && r.persona.name && !seenNames.has(r.persona.name)) {
      seenNames.add(r.persona.name);
      out.push(r.persona);
    }
  }
  return out;
}

// ─── 各 slide を short summary に圧縮 (LLM プロンプトに埋め込む用) ──
function summarizeSlide(slide) {
  const id = slide.id || '?';
  const tid = slide.template_id || '?';
  const title = (slide.title || '').slice(0, 60);
  const sub = (slide.subtitle || '').slice(0, 100);
  // 主要本文を 1-2 行で取り出す (template ごとに違うので best effort)
  const body = [];
  if (Array.isArray(slide.items)) {
    body.push(...slide.items.slice(0, 3).map(it => typeof it === 'string' ? it : (it.text || it.title || '')).filter(Boolean));
  }
  if (Array.isArray(slide.cards)) {
    body.push(...slide.cards.slice(0, 3).map(c => `${c.title || ''}: ${c.body || c.desc || ''}`));
  }
  if (Array.isArray(slide.detail_blocks)) {
    body.push(...slide.detail_blocks.slice(0, 2).map(b => b.heading || b.text || (b.items || []).join(' / ')));
  }
  const bodySnippet = body.join(' / ').slice(0, 200);
  const ans = Array.isArray(slide.answers_questions) ? slide.answers_questions.join(',') : '';
  return `[${id}] ${tid}${ans ? ' (→' + ans + ')' : ''} | ${title}${sub ? ' / ' + sub : ''}${bodySnippet ? ' | ' + bodySnippet : ''}`;
}

// ─── per-persona プロンプト生成 ──
function buildPrompt(persona, questions, slides, deckTitle) {
  const personaTraits = (persona.traits || [])
    .map(t => `${t.label || ''}: ${t.value || ''}`)
    .join(' / ');

  const qList = questions.map(q => {
    const ss = q.shortSummary ? ` (短い答え: ${q.shortSummary})` : '';
    return `- ${q.id} [${q.kind}] ${q.text}${ss}`;
  }).join('\n');

  const slidesList = slides.map(s => summarizeSlide(s)).join('\n');

  return [
    `あなたはこのデッキの想定読者の一人「${persona.name} (${persona.role})」です。`,
    '',
    '【あなたの背景】',
    persona.bio || '(bio 未指定)',
    '',
    '【あなたの傾向】',
    personaTraits || '(traits 未指定)',
    '',
    `これからデッキ「${deckTitle}」の「解決したい疑問・懸念」と全スライドを渡します。`,
    'あなたの立場で、各 Q の答えをスライドから探しに行ってください。',
    '',
    '【評価項目】(各 Q ごとに記入)',
    '- found: 答えが見つかったか',
    '  - "true"    = 完全に見つかった',
    '  - "partial" = 部分的・前提知識が必要・推測で補えた',
    '  - "false"   = 見つからない / 答えていないと感じる',
    '- found_at: 答えが見つかった slide id の配列 (例: ["S5", "S8"])。見つからなければ []',
    '- clarity: 分かりやすさのスコア',
    '  - S = 完璧、迷わず納得した',
    '  - A = 十分、少し読み返したら理解できた',
    '  - B = やや弱い、複数回読んでようやく',
    '  - C = 弱い、自分の前提知識で補完して理解',
    '  - D = 見つからない / 理解できない',
    `- comment: ${persona.name} としての所感を 1-3 文で。「${persona.name} ですが…」の口調で。`,
    '- suggestion (任意): 改善提案を 1-2 文で',
    '',
    '【質問リスト】',
    qList,
    '',
    '【スライド本文】',
    slidesList,
    '',
    '【出力フォーマット】',
    'JSON のみ返してください。説明・前置き・コードフェンス禁止。',
    '',
    '{',
    `  "persona_name": "${persona.name}",`,
    '  "per_question_findings": [',
    '    {',
    '      "qid": "Q1",',
    '      "found": "true|partial|false",',
    '      "found_at": ["S5"],',
    '      "clarity": "S|A|B|C|D",',
    '      "comment": "...",',
    '      "suggestion": "..."',
    '    }',
    '  ],',
    '  "summary": {',
    '    "fully_answered": 0,',
    '    "partial": 0,',
    '    "not_found": 0,',
    '    "weakest_q": "Q?",',
    '    "overall_comment": "全体としては..."',
    '  }',
    '}',
  ].join('\n');
}

// ─── skeleton review (LLM が埋める前の空 review) を生成 ──
function buildSkeletonReview(persona, questions, cycleNum) {
  return {
    review_type: 'persona-qa-review',
    cycle_num: cycleNum,
    cycle_desc: 'ペルソナ Q&A 探索',
    persona,
    per_question_findings: questions.map(q => ({
      qid: q.id,
      found: 'partial',  // LLM が埋めるまでの placeholder
      found_at: [],
      clarity: 'B',
      comment: '(LLM が埋めます — run-persona-qa-review.js --findings-in で merge)',
    })),
    summary: {
      fully_answered: 0,
      partial: questions.length,
      not_found: 0,
      weakest_q: null,
      overall_comment: '(未実施)',
    },
  };
}

// ─── reviews[] から既存の persona-qa-review を取り除く + 新しいものを追加 ─
function mergeReviews(plan, newReviews) {
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  const filtered = reviews.filter(r => r && r.review_type !== 'persona-qa-review');
  return [...filtered, ...newReviews];
}

// ─── findings-in mode: 既存 plan.json に LLM 出力を merge ──
function mergeFindings(plan, findingsArray, quiet) {
  // findingsArray は各ペルソナの { persona_name, per_question_findings, summary } の配列
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  const personas = extractPersonas(reviews);
  const personasByName = {};
  for (const p of personas) personasByName[p.name] = p;

  // 既存のサイクル数を計算 (新サイクルの cycle_num を払い出す)
  const existingMaxCycle = reviews.reduce((acc, r) => Math.max(acc, r && r.cycle_num || 0), 0);

  const newReviews = findingsArray.map((f, i) => {
    const persona = personasByName[f.persona_name];
    if (!persona) {
      log(`⚠ persona "${f.persona_name}" が plan.json に見つからない (skip)`, quiet);
      return null;
    }
    return {
      review_type: 'persona-qa-review',
      cycle_num: existingMaxCycle + 1 + i,
      cycle_desc: 'ペルソナ Q&A 探索',
      persona,
      per_question_findings: f.per_question_findings || [],
      summary: f.summary || { fully_answered: 0, partial: 0, not_found: 0 },
    };
  }).filter(Boolean);

  // schema 検証
  for (const nr of newReviews) {
    const r = PersonaQAReviewSchema.safeParse(nr);
    if (!r.success) {
      log(`⚠ persona "${nr.persona.name}" の review が schema 検証で失敗:`, quiet);
      log(JSON.stringify(r.error.issues, null, 2), quiet);
    }
  }

  plan.reviews = mergeReviews(plan, newReviews);
  return newReviews.length;
}

// ─── メイン処理 ──
function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('エラー: --input <plan.json> 必須');
    process.exit(1);
  }

  const planPath = path.resolve(args.input);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));

  // QA 駆動モード判定
  const qaDriven = plan.doc && plan.doc.qa_driven === true;
  const questions = (plan.doc && Array.isArray(plan.doc.questions)) ? plan.doc.questions : [];
  if (!qaDriven || questions.length === 0) {
    log(`⚠ qa_driven が false / questions[] が空 — skip`, args.quiet);
    process.exit(0);
  }

  // findings-in mode: LLM 出力を merge
  if (args.findingsIn) {
    const findingsRaw = fs.readFileSync(path.resolve(args.findingsIn), 'utf-8');
    const findings = JSON.parse(findingsRaw);
    const arr = Array.isArray(findings) ? findings : [findings];
    const merged = mergeFindings(plan, arr, args.quiet);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
    log(`✓ ${merged} ペルソナ分の per_question_findings を ${planPath} に merge`, args.quiet);
    return;
  }

  // skeleton + prompts mode
  const personas = extractPersonas(plan.reviews);
  if (personas.length === 0) {
    log(`⚠ 既存 reviews[] にペルソナが見つからない — Phase 2 で 4 ペルソナを定義してから再実行してください`, args.quiet);
    process.exit(2);
  }

  const slides = gatherSlides(plan);
  const deckTitle = (plan.doc && plan.doc.title) || '(無題)';

  // skeleton 生成
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  const existingMaxCycle = reviews.reduce((acc, r) => Math.max(acc, r && r.cycle_num || 0), 0);
  const skeletons = personas.map((p, i) => buildSkeletonReview(p, questions, existingMaxCycle + 1 + i));

  plan.reviews = mergeReviews(plan, skeletons);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
  log(`✓ ${skeletons.length} ペルソナ分の skeleton を ${planPath} に書き込み`, args.quiet);

  // プロンプト出力
  if (args.promptsOut) {
    const dir = path.resolve(args.promptsOut);
    fs.mkdirSync(dir, { recursive: true });
    for (const p of personas) {
      const prompt = buildPrompt(p, questions, slides, deckTitle);
      const safeName = p.name.replace(/[^\w -￿]+/g, '_').slice(0, 40);
      const fileName = `prompt-${safeName}.md`;
      fs.writeFileSync(path.join(dir, fileName), prompt, 'utf-8');
      log(`  - ${fileName}`, args.quiet);
    }
    log(`✓ ${personas.length} ペルソナ分のプロンプトを ${dir}/ に出力`, args.quiet);
    log(`  Claude (Cowork) で各プロンプトを叩いて出力 JSON を 1 つにまとめ、`, args.quiet);
    log(`  --findings-in <findings.json> で merge してください。`, args.quiet);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPrompt,
  buildSkeletonReview,
  extractPersonas,
  gatherSlides,
  mergeFindings,
  mergeReviews,
  summarizeSlide,
};
