'use strict';

// ==========================================================================
//  build-report-dto.js — BUILD phase
// --------------------------------------------------------------------------
//  入力:  plan.json (パース済み object) + deckDir
//  出力:  HtmlReportDto (HtmlReportSchema 準拠の plain object)
//
//  ここまでが「副作用が許される唯一のレイヤー」:
//    - palette.yml の fs read
//    - decks/<slug>/preview/slide-NN.png の fs read + base64 化
//    - 旧 plan.json のフィールド名を正規化
//
//  RENDER phase は本ファイルが書き出した build/report-dto.json を読み直し、
//  Zod で再検証してから純粋関数群でレンダリングします。
// ==========================================================================

const fs = require('node:fs');
const path = require('node:path');

const { SCHEMA_VERSION } = require('./html-report-schema');

let paletteYmlMod = null;
try { paletteYmlMod = require('../../../assets/palette-yml'); } catch (_e) { /* optional */ }

// --------------------------------------------------------------------------
// 色ユーティリティ (palette → CSS 変数派生)
// --------------------------------------------------------------------------
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}
function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; }
  else if (h < 120){ r = x; g = c; }
  else if (h < 180){ g = c; b = x; }
  else if (h < 240){ g = x; b = c; }
  else if (h < 300){ r = x; b = c; }
  else             { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function relLum([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrastRatio(rgb1, rgb2) {
  const l1 = relLum(rgb1), l2 = relLum(rgb2);
  const a = Math.max(l1, l2), b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}
function ensureContrastOnWhite(hex, target = 4.5) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (contrastRatio(rgb, [255, 255, 255]) >= target) return rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  for (let l = hsl.l; l > 0.05; l -= 0.03) {
    const r = hslToRgb({ h: hsl.h, s: hsl.s, l });
    if (contrastRatio(r, [255, 255, 255]) >= target) return rgbToHex(r);
  }
  return rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l: 0.18 }));
}
function mixWithWhite(hex, mix) {
  const rgb = hexToRgb(hex); if (!rgb) return null;
  return rgbToHex([rgb[0] * (1 - mix) + 255 * mix, rgb[1] * (1 - mix) + 255 * mix, rgb[2] * (1 - mix) + 255 * mix]);
}
function inkToRule(inkHex) {
  const rgb = hexToRgb(inkHex); if (!rgb) return '#E5E5E5';
  return rgbToHex([rgb[0] * 0.12 + 250 * 0.88, rgb[1] * 0.12 + 250 * 0.88, rgb[2] * 0.12 + 250 * 0.88]);
}

function loadDeckPalette(deckDir) {
  const ymlPath = path.join(deckDir, 'palette.yml');
  if (!fs.existsSync(ymlPath)) return null;
  let parsed = null;
  if (paletteYmlMod && paletteYmlMod.parseYaml) {
    try { parsed = paletteYmlMod.parseYaml(fs.readFileSync(ymlPath, 'utf8')); } catch (_e) {}
  }
  if (!parsed || !parsed.colors) return null;
  const c = parsed.colors;
  const brandHex = c.brand ? '#' + c.brand : null;
  const paletteAccentHex = c.accent ? '#' + c.accent : null;
  if (!brandHex) return null;
  let accentStrong = paletteAccentHex || brandHex;
  accentStrong = ensureContrastOnWhite(accentStrong, 4.5);
  if (contrastRatio(hexToRgb(accentStrong), [255, 255, 255]) < 4.5) {
    accentStrong = ensureContrastOnWhite(brandHex, 4.5);
  }
  const accentMute = mixWithWhite(brandHex, 0.88);
  const inkHex = c.ink ? '#' + c.ink : '#1A1A1A';
  const ruleColor = inkToRule(inkHex);
  return {
    name: (parsed.meta && parsed.meta.name) || 'palette.yml',
    accent: brandHex.toUpperCase(),
    accentStrong: accentStrong.toUpperCase(),
    accentMute: accentMute.toUpperCase(),
    rule: ruleColor.toUpperCase(),
    brand: brandHex.toUpperCase(),
  };
}

// --------------------------------------------------------------------------
// plan.json → flatten スライド
// --------------------------------------------------------------------------
function flattenSlides(plan) {
  const slides = [];
  let pageNumber = 0;
  const push = (slide, location, extra = {}) => {
    if (!slide) return;
    pageNumber += 1;
    slides.push({ ...slide, _pageNumber: pageNumber, _location: location, ...extra });
  };
  const header = plan.header || {};
  if (Array.isArray(header)) header.forEach((s, i) => push(s, `header[${i}]`));
  else {
    for (const key of ['cover', 'toc', 'context', 'background', 'before_after', 'agenda']) {
      if (Array.isArray(header[key])) header[key].forEach((s) => push(s, `header.${key}`));
      else if (header[key] && typeof header[key] === 'object') push(header[key], `header.${key}`);
    }
    if (Array.isArray(header.slides)) header.slides.forEach((s) => push(s, 'header.slides'));
  }
  const chapters = (plan.body && plan.body.chapters) || [];
  chapters.forEach((ch, idx) => {
    const chapterIdx = idx + 1;
    for (const bucket of ['head', 'content', 'tail', 'inner', 'foot']) {
      if (Array.isArray(ch[bucket])) {
        ch[bucket].forEach((s) =>
          push({ ...s }, `body.chapters[${idx}].${bucket}`, { _chapter: ch, _chapterIdx: chapterIdx, _bucket: bucket }),
        );
      }
    }
  });
  const sections = plan.sections || [];
  sections.forEach((sec, idx) => {
    if (Array.isArray(sec.slides)) {
      sec.slides.forEach((s) =>
        push({ ...s }, `sections[${idx}].slides`, { _chapter: sec, _chapterIdx: idx + 1, _bucket: 'slides' }),
      );
    }
  });
  const footer = plan.footer || {};
  if (Array.isArray(footer)) footer.forEach((s, i) => push(s, `footer[${i}]`));
  else {
    for (const key of ['summary', 'cta', 'thanks', 'company', 'company_intro', 'closing']) {
      if (Array.isArray(footer[key])) footer[key].forEach((s) => push(s, `footer.${key}`));
      else if (footer[key] && typeof footer[key] === 'object') push(footer[key], `footer.${key}`);
    }
    if (Array.isArray(footer.slides)) footer.slides.forEach((s) => push(s, 'footer.slides'));
  }
  return slides;
}

// --------------------------------------------------------------------------
// サムネ解決
// --------------------------------------------------------------------------
function resolveThumbnail(deckDir, pageNumber, opts) {
  if (!opts.thumbnails) return null;
  const nn = String(pageNumber).padStart(2, '0');
  const candidates = [
    path.join(deckDir, 'preview', `slide-${nn}.png`),
    path.join(deckDir, 'preview', `slide-${pageNumber}.png`),
    path.join(deckDir, 'preview', `${nn}.png`),
    path.join(deckDir, 'build', 'preview', `slide-${nn}.png`),
    path.join(deckDir, 'build', 'preview', `${nn}.png`),
  ];
  let found = null;
  for (const p of candidates) { if (fs.existsSync(p)) { found = p; break; } }
  if (!found) return null;
  if (opts.embedThumbnails === false) {
    const rel = path.relative(deckDir, found).split(path.sep).join('/');
    return { src: './' + rel, embedded: false };
  }
  try {
    const buf = fs.readFileSync(found);
    return { src: `data:image/png;base64,${buf.toString('base64')}`, embedded: true, bytes: buf.length };
  } catch (_e) { return null; }
}

/**
 * { type, props, caption?, schemaVersion } 形式に正規化。
 */
function normalizeWidgets(widgets, inlineHtml) {
  const out = [];
  if (Array.isArray(widgets)) {
    widgets.forEach((w) => {
      if (!w || typeof w !== 'object' || !w.type) return;
      out.push({
        schemaVersion: SCHEMA_VERSION,
        type: w.type,
        caption: w.caption,
        props: w.props || {},
      });
    });
  }
  if (typeof inlineHtml === 'string' && inlineHtml.trim()) {
    out.push({
      schemaVersion: SCHEMA_VERSION,
      type: 'inline-html',
      props: { html: inlineHtml },
    });
  }
  return out;
}

// --------------------------------------------------------------------------
// メイン: plan + palette + thumbnails → HtmlReportDto
// --------------------------------------------------------------------------
function buildReportDto({ plan, deckDir, slug, opts, titleOverride, generatedAt }) {
  const palette = loadDeckPalette(deckDir);
  const allSlides = flattenSlides(plan);
  const totalSlides = allSlides.length;
  const planLevelDefaults = plan.html_supplement_defaults || {};
  const deckCollapseDefault = planLevelDefaults.collapse_default === true;

  const resolveOpen = (supp, parentSupp) => {
    let collapse = deckCollapseDefault;
    if (parentSupp && parentSupp.collapse_default === true) collapse = true;
    if (parentSupp && parentSupp.collapse_default === false) collapse = false;
    if (supp && supp.collapse_default === true) collapse = true;
    if (supp && supp.collapse_default === false) collapse = false;
    return !collapse;
  };

  const cards = [];
  const toc = [];
  let cardIndex = 0;

  // 章スコープ補足 (v9 / v8 両対応)
  const chapters = (plan.body && plan.body.chapters) || [];
  chapters.forEach((ch, idx) => {
    if (!ch.html_supplement || ch.html_supplement.enabled !== true) return;
    cardIndex += 1;
    const supp = ch.html_supplement;
    const kindCls = supp.kind ? `kind-${supp.kind.replace(/[^a-z0-9-]/gi, '')}` : '';
    const card = {
      schemaVersion: SCHEMA_VERSION,
      domId: `chapter-${idx + 1}`,
      kind: 'chapter',
      cardIndex,
      chapterIdx: idx + 1,
      bucketLabel: '章スコープ',
      title: ch.name || ch.title || '章補足',
      subtitle: undefined,
      kindLabel: supp.kind || undefined,
      kindClass: kindCls,
      rationale: supp.reason,
      showRationale: supp.show_rationale === true,
      thumbnail: null,
      contentMd: supp.content_md,
      tables: Array.isArray(supp.tables) ? supp.tables : [],
      charts: Array.isArray(supp.charts) ? supp.charts : [],
      widgets: normalizeWidgets(supp.interactive_widgets, supp.inline_html),
      refs: Array.isArray(supp.references) ? supp.references : [],
      haystack: `${ch.name || ''} ${ch.title || ''} ${supp.reason || ''} ${supp.content_md || ''}`.toLowerCase(),
      open: resolveOpen(supp, null),
    };
    cards.push(card);
    toc.push({ id: card.domId, label: card.title, pgno: `章 ${idx + 1}` });
  });
  const sections = plan.sections || [];
  sections.forEach((sec, idx) => {
    if (!sec.html_supplement || sec.html_supplement.enabled !== true) return;
    cardIndex += 1;
    const supp = sec.html_supplement;
    const kindCls = supp.kind ? `kind-${supp.kind.replace(/[^a-z0-9-]/gi, '')}` : '';
    const card = {
      schemaVersion: SCHEMA_VERSION,
      domId: `chapter-${idx + 1}`,
      kind: 'chapter',
      cardIndex,
      chapterIdx: idx + 1,
      bucketLabel: '章スコープ',
      title: sec.name || sec.title || '章補足',
      subtitle: undefined,
      kindLabel: supp.kind || undefined,
      kindClass: kindCls,
      rationale: supp.reason,
      showRationale: supp.show_rationale === true,
      thumbnail: null,
      contentMd: supp.content_md,
      tables: Array.isArray(supp.tables) ? supp.tables : [],
      charts: Array.isArray(supp.charts) ? supp.charts : [],
      widgets: normalizeWidgets(supp.interactive_widgets, supp.inline_html),
      refs: Array.isArray(supp.references) ? supp.references : [],
      haystack: `${sec.name || ''} ${sec.title || ''} ${supp.reason || ''} ${supp.content_md || ''}`.toLowerCase(),
      open: resolveOpen(supp, null),
    };
    cards.push(card);
    toc.push({ id: card.domId, label: card.title, pgno: `章 ${idx + 1}` });
  });

  // スライド補足
  allSlides.forEach((s) => {
    if (!s.html_supplement || s.html_supplement.enabled !== true) return;
    cardIndex += 1;
    const supp = s.html_supplement;
    const kindCls = supp.kind ? `kind-${supp.kind.replace(/[^a-z0-9-]/gi, '')}` : '';
    const parentSupp = (s._chapter && s._chapter.html_supplement) || null;

    const slideOpt = supp.embed_thumbnails;
    const chapterOpt = parentSupp && parentSupp.embed_thumbnails;
    const deckOpt = planLevelDefaults.embed_thumbnails;
    let embed = opts.embedThumbnails;
    if (slideOpt === false || chapterOpt === false || deckOpt === false) embed = false;

    let thumbEnabled = opts.thumbnails;
    if (supp.show_thumbnail === false || (parentSupp && parentSupp.show_thumbnail === false)) thumbEnabled = false;

    const thumb = thumbEnabled
      ? resolveThumbnail(deckDir, s._pageNumber, { thumbnails: true, embedThumbnails: embed })
      : null;
    const thumbDto = thumb
      ? { src: thumb.src, alt: `P${s._pageNumber} ${s.title || ''}`.trim(), bytes: thumb.bytes, embedded: thumb.embedded }
      : null;

    const card = {
      schemaVersion: SCHEMA_VERSION,
      domId: `slide-${s._pageNumber}`,
      kind: 'slide',
      cardIndex,
      pageNumber: s._pageNumber,
      bucketLabel: s._chapterIdx ? `章 ${s._chapterIdx} / ${s._bucket || ''}` : (s._location || ''),
      title: s.title || '(無題)',
      subtitle: s.subtitle,
      kindLabel: supp.kind || undefined,
      kindClass: kindCls,
      rationale: supp.reason,
      showRationale: supp.show_rationale === true,
      thumbnail: thumbDto,
      contentMd: supp.content_md,
      tables: Array.isArray(supp.tables) ? supp.tables : [],
      charts: Array.isArray(supp.charts) ? supp.charts : [],
      widgets: normalizeWidgets(supp.interactive_widgets, supp.inline_html),
      refs: Array.isArray(supp.references) ? supp.references : [],
      haystack: `${s.title || ''} ${s.subtitle || ''} ${s.subsection || ''} ${supp.reason || ''} ${supp.content_md || ''}`.toLowerCase(),
      open: resolveOpen(supp, parentSupp),
    };
    cards.push(card);
    toc.push({ id: card.domId, label: card.title, pgno: `P${s._pageNumber}` });
  });
  const docForQa = plan.doc || {};
  const qaDriven = docForQa.qa_driven === true;
  const questions = (qaDriven && Array.isArray(docForQa.questions)) ? docForQa.questions : [];
  const personaQAReviews = (qaDriven && Array.isArray(plan.reviews))
    ? plan.reviews.filter((r) => r && r.review_type === 'persona-qa-review')
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    deckMeta: {
      slug,
      title: titleOverride || (plan.doc && plan.doc.title) || 'ENOSTECH 補足レポート',
      date: (plan.doc && plan.doc.date) || undefined,
      totalSlides,
      slideCount: cards.filter((c) => c.kind === 'slide').length,
      chapterCount: cards.filter((c) => c.kind === 'chapter').length,
      generatedAt: generatedAt || undefined,
    },
    palette,
    toc,
    cards,
    options: { embedThumbnails: opts.embedThumbnails, thumbnails: opts.thumbnails },
    qaDriven,
    questions,
    personaQAReviews,
  };
}

module.exports = {
  buildReportDto,
  // 個別関数は外部からも利用できるようにエクスポート (テスト容易性)
  flattenSlides,
  resolveThumbnail,
  loadDeckPalette,
  normalizeWidgets,
};
