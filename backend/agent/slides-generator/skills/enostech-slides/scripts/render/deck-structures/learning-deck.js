/**
 * deck-structures/learning-deck.js
 * =================================
 * 「1 テーマを順番に教える学習デッキ」用の構造定義。
 *
 * 仕様書:
 *   - `references/deck-structures/learning-deck.md`
 *   - `references/phase2-information-design/plan-json-v9-structure.md`
 *
 * StructureQA で適用されるルール:
 *   StructQA-00 (Template メタ)
 *   StructQA-01 (header の順序・必須)
 *   StructQA-02 (footer の必須スライド)
 *   StructQA-03 (章構造 head/content/tail)
 *   StructQA-04 (章数 2-6)
 *   StructQA-05 (章内本文 1-8 枚) [warn]
 *   StructQA-06 (総スライド 14-60 枚)
 *   StructQA-12 (章扉直後の見取り図)
 *   StructQA-13 (章末 FRAMING-5)
 *   StructQA-21 (FlowChart 必須)
 *   StructQA-22 (HubSpoke 上限)
 */

'use strict';

const { defineDeckStructure, countGlossaryTerms } = require('./_helper');

module.exports = defineDeckStructure({
  id: 'learning-deck',
  version: '1.0',
  description:
    '学習デッキ。1 テーマを順番に教えていく構成。読者は学びたい人。' +
    '読了後に「判断軸」を獲得し、現場で動けることがゴール。',
  // 既存デッキ regression を防ぐため、resolveQADrivenFlag (lib/structure-qa.js) に
  // 「questions[] が空または未指定の時は実質 false 扱い」のセーフティを実装済。
  // → 新規デッキで questions[] を書いた時点で自動 opt-in、既存デッキは無影響。
  qa_driven_default: true,

  // ─────────────────────────────────────────────
  // header: 序盤固定枠 (4 必須 + 1 任意)
  // ─────────────────────────────────────────────
  header: [
    {
      position: 0,
      template_id: 'SECTION-1',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[0] は SECTION-1 (表紙) 必須',
    },
    {
      position: 1,
      template_id: 'FRAMING-1',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[1] は FRAMING-1 (構築背景) 必須',
      // SchemaQA-01 と二重検査だが許容 (Template の自己完結性のため)
      fields: {
        detail_blocks: {
          block_kikkake: { type: 'string', minLength: 1 },
          block_kizuki:  { type: 'string', minLength: 1 },
          block_gimon:   { type: 'string', minLength: 1 },
        },
      },
    },
    {
      position: 2,
      template_id: 'FRAMING-2',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[2] は FRAMING-2 (Before/After) 必須',
      fields: {
        items: { minLength: 4, maxLength: 6 },
      },
    },
    {
      position: 3,
      template_id: 'SECTION-6',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[3] は SECTION-6 (統合目次) 必須',
    },
    {
      position: 4,
      template_id: ['VISUAL-8', 'QA-INDEX'],
      required: false,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[4] は任意 (VISUAL-8 グラレコサマリー / qa_driven=true 時は QA-INDEX)',
    },
    {
      position: 5,
      template_id: 'QA-INDEX',
      required: false,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[5] は任意 (VISUAL-8 と QA-INDEX を両方使う時のみ)',
    },
  ],

  // ─────────────────────────────────────────────
  // body: 章繰り返し
  // ─────────────────────────────────────────────
  body: {
    count: { min: 2, max: 6 },         // 章数 2-6 (volumeConstraints で上書き可)

    head: [
      {
        position: 0,
        template_id: ['SECTION-2', 'SECTION-4', 'SECTION-5'],
        required: true,
        rule: 'StructQA-12',
        message:
          'StructQA-12: chapter.head[0] は章扉 (SECTION-2 / SECTION-4 / SECTION-5) 必須',
      },
      {
        // SVG が走らず S6 のみ SECSUMMARY、他章 LIST-3 という偏りが起きていた。
        // フォールバック理由が消滅。学習デッキの章扉直後は必ず SVG で「絵で覚える」
        // 読書体験を作る方針に統一する。
        position: 1,
        template_id: 'SECSUMMARY-1',
        required: true,
        rule: 'StructQA-12',
        message:
          'StructQA-12: chapter.head[1] は SECSUMMARY-1 (SVG 主役の章見取り図) 必須。' +
          'svg / svg_file を指定し、viewBox 1920x1080 + Noto Sans JP で描く (dbt-semantic 流の amber 系レイアウト)。' +
          'LIST-3 フォールバックは撤廃。SVG が描けない場合は章を分割して別構造を検討すること',
      },
    ],

    content: {
      count: { min: 1, max: 8 },       // 章本文 1-8 枚 (volumeConstraints で上書き可)
      allowedTemplates: 'any',         // 'any' = 全テンプレ許可
      severity: { min: 'warn', max: 'warn' },
    },

    tail: [
      {
        position: 0,
        template_id: 'FRAMING-5',
        required: true,
        rule: 'StructQA-13',
        message:
          'StructQA-13: chapter.tail[0] は FRAMING-5 (章末まとめ) 必須',
        fields: {
          mode: { enum: ['comprehension', 'recap'] },
          items: { length: 3 },
        },
      },
    ],
  },

  // ─────────────────────────────────────────────
  // footer: 末尾固定枠
  // ─────────────────────────────────────────────
  footer: [
    {
      position: 0,
      template_id: 'SECTION-3',
      required: false,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer の SECTION-3 (クロージング) は任意',
    },
    {
      position: 1,
      template_id: 'DATA-4',
      required: true,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer に DATA-4 (参考情報集 SR) 必須',
    },
    {
      position: 2,
      template_id: 'DATA-5',
      required: false,
      rule: 'StructQA-02',
      conditional: {
        if: (deckJson) => countGlossaryTerms(deckJson) >= 3,
        message: 'StructQA-02: 用語 3 件以上のため DATA-5 (用語集) 必須',
      },
    },
    {
      position: 3,
      template_id: 'FRAMING-4',
      required: true,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer に FRAMING-4 (お土産) 必須',
    },
    {
      position: 4,
      template_id: 'FRAMING-3',
      required: true,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer 末尾は FRAMING-3 (会社紹介) 必須',
    },
  ],

  // ─────────────────────────────────────────────
  // globalConstraints: デッキ全体ルール
  // ─────────────────────────────────────────────
  globalConstraints: {
    totalSlides: { min: 14, max: 60 },

    requiredTags: [
      {
        tag: 'flowchart',
        min: 1,
        rule: 'StructQA-21',
        templates: ['DIAGRAM-3'],
        nestedDiagrams: ['SCENE-06'],
        appliesIf: (deckJson) => deckJson.doc && deckJson.doc.decision_focused !== false,
        message:
          'StructQA-21: FlowChart スライド (DIAGRAM-3 / SCENE-06) が 1 枚以上必須。' +
          '判断ロジックを絵で見せる学習デッキの最重要ルール。' +
          'doc.decision_focused: false で警告に格下げ可',
      },
    ],

    maxTags: [
      {
        tag: 'hub-and-spoke',
        max: 1,
        rule: 'StructQA-22',
        nestedDiagrams: ['SCENE-02'],
        message:
          'StructQA-22: ハブ&スポーク図 (SCENE-02) は 1 デッキ 1 枚まで。' +
          '5 並列要素なら LIST-3 / LIST-2、軸ベース配置なら DIAGRAM-1 を検討',
      },
    ],
  },
});
