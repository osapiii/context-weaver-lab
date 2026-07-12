/**
 * deck-structures/case-study-deck.js
 * ===================================
 * 「複数事例を横並びで比較してパターンを抽出する」用途の構造定義。
 *
 * 仕様書:
 *   - `references/deck-structures/case-study-deck.md` (v2.0)
 *   - `references/phase2-information-design/plan-json-v9-structure.md`
 *
 * StructureQA で適用されるルール (v2.0 = 17 ルール):
 *   StructQA-00 (Template メタ)
 *   StructQA-01 (header の順序・必須 / 全 5 枚) ★ v2.0 で 4 → 5 に拡張
 *   StructQA-02 (footer の必須スライド)
 *   StructQA-03 (章構造 head[2] / content / tail[1])
 *   StructQA-04 (章数 3-7)
 *   StructQA-05 (章内本文 1-8 枚) [warn]
 *   StructQA-06 (総スライド 14-60 枚)
 *   StructQA-12 (章扉直後の SECSUMMARY-1)
 *   StructQA-13 (章末 FRAMING-5)
 *   StructQA-22 (HubSpoke 上限)
 *
 * case-study-deck 専用ルール (StructQA-40〜46):
 *   StructQA-40 [warn]  doc.case_meta が定義されているか
 *   StructQA-41 [fatal] case_meta.cases[] は 2 件以上必須
 *   StructQA-42 [fatal] body の横並び比較スライド (COMPARE-3/5/6) 1 枚以上必須
 *   StructQA-43 [fatal] パターン抽出スライド必須
 *   StructQA-44 [warn]  自分への示唆推奨
 *   StructQA-45 [fatal] footer に WEBPAGE-2 必須 + cases[].source が全件揃う + 出典 ≥ 事例数
 *   StructQA-46 [fatal] header[3] に一望比較表 (COMPARE-3/5/6/DATA-2) 必須 ★ v2.0 NEW
 *
 * v2.0 変更点:
 *   - header[3] に一望比較表を追加 (4 必須 → 5 必須)
 *   - header の比較表 (低密度俯瞰) と body の比較表 (高密度抽出) は役割が違う
 *   - 既存 v1.0 plan.json は header に比較表が無いため fatal で停止 → 移行が必要
 */

'use strict';

const { z } = require('zod');
const { defineDeckStructure, getAllSlides } = require('./_helper');

// ───────────────────────────────────────────────────────
// 基本構造
// ───────────────────────────────────────────────────────

const baseDeck = defineDeckStructure({
  id: 'case-study-deck',
  version: '2.0',
  description:
    '事例集約デッキ。同種の事例を 2-5 件集めて、横並びで比較し、共通パターンを抽出する構成。' +
    '読了後に「N 件の事例から共通パターンが X / Y / Z」と言える状態がゴール。' +
    '競合分析・業界事例カタログ・社内成功事例集約に使う。' +
    'v2.0 で header に一望比較表を追加し、「最初に全事例を一望 → ディテール → パターン抽出」の読書体験を構造で保証。',
  // セーフティで questions[] が空なら実質 false。
  qa_driven_default: true,

  // ─────────────────────────────────────────────
  // header: 5 必須 (★ v2.0 で 4 → 5 に拡張)
  //   header[2] = SECSUMMARY-1 (全景ビジュアル)
  //   header[3] = 一望比較表 (COMPARE-3/5/6/DATA-2) ★ v2.0 NEW
  //   header[4] = SECTION-6 (目次)
  // ─────────────────────────────────────────────
  header: [
    {
      position: 0, template_id: 'SECTION-1', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[0] は SECTION-1 (表紙) 必須',
    },
    {
      position: 1, template_id: 'FRAMING-1', required: true, rule: 'StructQA-01',
      message:
        'StructQA-01: header[1] は FRAMING-1 (テーマ提示 = なぜこのテーマで事例を集めるか / 観点) 必須',
    },
    {
      position: 2, template_id: 'SECSUMMARY-1', required: true, rule: 'StructQA-01',
      message:
        'StructQA-01: header[2] は SECSUMMARY-1 (事例カタログ全景 = 全事例を 1 枚絵で並べる SVG) 必須。' +
        'svg / svg_file を必ず指定し、全事例の名前・象徴を viewBox 1920x1080 に並べる',
    },
    // ★ v2.0 NEW: header[3] 一望比較表
    {
      position: 3,
      template_id: ['COMPARE-3', 'COMPARE-5', 'COMPARE-6', 'DATA-2'],
      required: true,
      rule: 'StructQA-46',
      message:
        'StructQA-46: header[3] は一望比較表 (COMPARE-3 / COMPARE-5 / COMPARE-6 / DATA-2) 必須。' +
        '全事例の "存在" と "ざっくり差分" を 1 枚で渡し、ディテールに潜る前の俯瞰を作る。' +
        'body の横並び比較 (StructQA-42) とは役割が違う ─ ' +
        'header= 低密度俯瞰 (各事例 1 行 + 4-6 列) / body= 高密度抽出 (各事例 1 列 + 多項目)',
    },
    {
      position: 4, template_id: 'SECTION-6', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[4] は SECTION-6 (目次) 必須',
    },
  ],

  // ─────────────────────────────────────────────
  // body: 3-7 章
  //   推奨運用: 事例 2-5 章 + 抽出 1-2 章 (Zod は強制しない、章名で識別)
  // ─────────────────────────────────────────────
  body: {
    count: { min: 3, max: 7 },

    head: [
      {
        position: 0,
        template_id: ['SECTION-2', 'SECTION-4', 'SECTION-5'],
        required: true, rule: 'StructQA-12',
        message: 'StructQA-12: chapter.head[0] は章扉 (SECTION-2 / SECTION-4 / SECTION-5) 必須',
      },
      {
        position: 1, template_id: 'SECSUMMARY-1', required: true, rule: 'StructQA-12',
        message:
          'StructQA-12: chapter.head[1] は SECSUMMARY-1 (主役ビジュアル) 必須。' +
          'svg / svg_file を必ず指定 (事例章は事例の象徴、抽出章は比較全景)',
      },
    ],

    content: {
      count: { min: 1, max: 8 },
      allowedTemplates: 'any',
      severity: { min: 'warn', max: 'warn' },
    },

    tail: [
      {
        position: 0, template_id: 'FRAMING-5', required: true, rule: 'StructQA-13',
        message:
          'StructQA-13: chapter.tail[0] は FRAMING-5 必須。' +
          '事例章は事例まとめ (mode: comprehension/recap)、抽出章は抽出まとめ (mode: pattern-summary 等)',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // footer
  // ─────────────────────────────────────────────
  footer: [
    {
      position: 0, template_id: 'SECTION-3', required: false, rule: 'StructQA-02',
      message: 'StructQA-02: footer の SECTION-3 (クロージング) は任意',
    },
    {
      position: 1, template_id: 'DATA-4', required: true, rule: 'StructQA-02',
      message: 'StructQA-02: footer に DATA-4 (参考資料) 必須',
    },
    {
      position: 2, template_id: 'WEBPAGE-2', required: true, rule: 'StructQA-45',
      message:
        'StructQA-45: footer に WEBPAGE-2 (各事例の出典クレジット集) 必須。' +
        'cases[].source が全件揃い、出典数 ≥ 事例数 を満たすこと',
    },
    {
      position: 3, template_id: 'FRAMING-4', required: true, rule: 'StructQA-02',
      message:
        'StructQA-02: footer に FRAMING-4 (持ち帰り = 自分の案件にどう適用するかテンプレ) 必須',
    },
    {
      position: 4, template_id: 'FRAMING-3', required: true, rule: 'StructQA-02',
      message: 'StructQA-02: footer 末尾は FRAMING-3 (会社紹介) 必須',
    },
  ],

  // ─────────────────────────────────────────────
  // globalConstraints
  // ─────────────────────────────────────────────
  globalConstraints: {
    totalSlides: { min: 14, max: 60 },

    requiredTags: [
      // StructQA-42: 横並び比較スライド必須
      {
        tag: 'comparison-matrix',
        min: 1,
        rule: 'StructQA-42',
        templates: ['COMPARE-3', 'COMPARE-5', 'COMPARE-6'],
        appliesIf: () => true,
        message:
          'StructQA-42: case-study-deck は横並び比較スライド (COMPARE-3 / COMPARE-5 / COMPARE-6) を 1 枚以上必須。' +
          '比較軸を固定して全事例を 1 枚マトリクスに並べることが「事例集」と「比較分析」を分ける核',
      },
    ],

    maxTags: [
      {
        tag: 'hub-and-spoke', max: 1, rule: 'StructQA-22',
        nestedDiagrams: ['SCENE-02'],
        message:
          'StructQA-22: ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚まで。' +
          '5 並列要素なら LIST-3 / LIST-2、軸ベース配置なら DIAGRAM-1 を検討',
      },
    ],
  },
});

// ───────────────────────────────────────────────────────
// case-study-deck 専用検査 (StructQA-40 / 41 / 43 / 44 / 45)
// ───────────────────────────────────────────────────────

const caseStudySchema = baseDeck.schema.superRefine((deckJson, ctx) => {
  const doc = deckJson && deckJson.doc;
  if (!doc) return;

  // ───── StructQA-40: case_meta 推奨 ─────
  const meta = doc.case_meta;
  if (!meta || typeof meta !== 'object') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc', 'case_meta'],
      message:
        'StructQA-40: doc.case_meta の定義を推奨します。' +
        'cases[] / patterns[] / takeaways[] を構造化して置くと StructQA-41/43/44/45 が事例集約の品質を支援します',
    });
    // case_meta が無いと 41/43/44/45 は走らない (StructQA-40 単発 warn で停止)
    return;
  }

  // ───── StructQA-41: cases[] >= 2 (fatal) ─────
  const cases = Array.isArray(meta.cases) ? meta.cases : null;
  if (!cases) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc', 'case_meta', 'cases'],
      message:
        'StructQA-41: doc.case_meta.cases は array で 2 件以上必須です。' +
        '事例 1 件のみは「事例集」として構造的に成立しません',
    });
  } else if (cases.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc', 'case_meta', 'cases'],
      message:
        `StructQA-41: case_meta.cases は 2 件以上必須 (現状 ${cases.length} 件)。` +
        '事例 1 件のみは比較できないため別 deckStructure (例: company-research) を検討してください',
    });
  }

  // ───── StructQA-43: パターン抽出スライド必須 (fatal) ─────
  // 判定:
  //   1. case_meta.patterns が 1 件以上の string array → pass
  //   2. もしくは スライド (任意) に is_pattern_extraction: true フラグが付いている → pass
  //   3. どちらも欠けたら fatal
  const patterns = meta.patterns;
  const hasPatternsMeta = Array.isArray(patterns)
    && patterns.filter(p => typeof p === 'string' && p.trim().length > 0).length > 0;

  let hasPatternsSlide = false;
  if (!hasPatternsMeta) {
    const all = getAllSlides(deckJson);
    hasPatternsSlide = all.some(sl => sl && sl.is_pattern_extraction === true);
  }

  if (!hasPatternsMeta && !hasPatternsSlide) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc', 'case_meta', 'patterns'],
      message:
        'StructQA-43: パターン抽出が定義されていません。' +
        'doc.case_meta.patterns に共通パターンを 1 件以上書くか、' +
        '抽出章のスライドに is_pattern_extraction: true フラグを 1 枚以上立ててください。' +
        '事例集デッキは「集めて並べる」だけでなく「共通パターンを抽出する」が核です',
    });
  }

  // ───── StructQA-44: 自分への示唆推奨 (warn) ─────
  // 判定:
  //   1. case_meta.takeaways が 1 件以上 → pass
  //   2. もしくは footer に FRAMING-4 (omiyage) が存在 → pass (footer 必須なので通常通る)
  const takeaways = meta.takeaways;
  const hasTakeaways = Array.isArray(takeaways)
    && takeaways.filter(t => typeof t === 'string' && t.trim().length > 0).length > 0;

  const footer = Array.isArray(deckJson.footer) ? deckJson.footer : [];
  const hasFraming4 = footer.some(s => s && s.template_id === 'FRAMING-4'
    && s.omiyage && typeof s.omiyage === 'object');

  if (!hasTakeaways && !hasFraming4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc', 'case_meta', 'takeaways'],
      message:
        'StructQA-44: 自分への示唆 (takeaways) を推奨します。' +
        'doc.case_meta.takeaways に「自分の案件にどう適用するか」を 1 件以上書くか、' +
        'footer の FRAMING-4 omiyage で持ち帰りテンプレを渡してください',
    });
  }

  // ───── StructQA-45: 出典 ≥ 事例数 (fatal) ─────
  // 判定:
  //   1. footer に WEBPAGE-2 が存在しない → fatal (base footer 検査でも捕まるが念のため明示)
  //   2. cases[i].source (= { label, ... }) が全件で揃わない → fatal
  //   3. WEBPAGE-2.items.length < cases.length → fatal (出典不足)
  const webpage2 = footer.find(s => s && s.template_id === 'WEBPAGE-2');
  if (!webpage2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['footer'],
      message:
        'StructQA-45: footer に WEBPAGE-2 (各事例の出典クレジット集) が必須です。' +
        '事例集デッキは「どこの事例か = 出典」が信頼性の根幹',
    });
  }

  if (Array.isArray(cases)) {
    cases.forEach((c, i) => {
      const hasSourceLabel = c && c.source && typeof c.source === 'object'
        && typeof c.source.label === 'string' && c.source.label.trim().length > 0;
      if (!hasSourceLabel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['doc', 'case_meta', 'cases', i, 'source'],
          message:
            `StructQA-45: cases[${i}].source.label が欠落しています。` +
            '全事例で source { label, url? } を必須化 (出典は事例数 × 1 以上)',
        });
      }
    });

    // WEBPAGE-2 の items 数が事例数を下回っていたら fatal
    if (webpage2 && Array.isArray(webpage2.items) && webpage2.items.length < cases.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['footer'],
        message:
          `StructQA-45: WEBPAGE-2.items.length (${webpage2.items.length}) が cases.length (${cases.length}) を下回ります。` +
          '出典は事例数 × 1 以上で揃える必要があります',
      });
    }
  }
});

// ───────────────────────────────────────────────────────
// export
// ───────────────────────────────────────────────────────

module.exports = {
  spec:               baseDeck.spec,
  headerSchema:       baseDeck.headerSchema,
  chapterSchema:      baseDeck.chapterSchema,
  footerSchema:       baseDeck.footerSchema,
  id:                 baseDeck.id,
  version:            baseDeck.version,
  description:        baseDeck.description,
  qa_driven_default:  baseDeck.qa_driven_default,
  schema:             caseStudySchema,
};
