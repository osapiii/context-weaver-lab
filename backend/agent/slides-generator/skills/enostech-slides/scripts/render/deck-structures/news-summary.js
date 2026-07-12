/**
 * deck-structures/news-summary.js
 * ================================
 * 「複数のニュース記事や業界トピックを並べて整理し、読み手に『今この領域で何が
 * 起きているか』を素早く伝える」用の構造定義。
 *
 * 仕様書:
 *   - `references/deck-structures/news-summary.md`
 *   - `references/phase2-information-design/plan-json-v9-structure.md`
 *
 * StructureQA で適用されるルール (10 ルール):
 *   StructQA-00 (Template メタ)
 *   StructQA-01 (header の順序・必須 / 全 3 枚)
 *   StructQA-02 (footer の必須スライド / WEBPAGE-2 含む)
 *   StructQA-03 (章構造 head[1] / content / tail[0])
 *   StructQA-04 (章数 1-3)
 *   StructQA-05 (章内本文 2-8 枚) [warn]
 *   StructQA-06 (総スライド 8-30 枚)
 *   StructQA-21 (FlowChart 条件付き warn = decision_focused === true 明示時のみ)
 *   StructQA-22 (HubSpoke 上限)
 *   StructQA-23 (Web カード必須 = WEBPAGE-1〜4 / VISUAL-7 のいずれか 1 枚以上)
 *
 * learning-deck の StructQA-12 (見取り図) / StructQA-13 (章末まとめ) は
 * news-summary では適用されない (head 1 枚のみ / tail 空配列)。
 */

'use strict';

const { defineDeckStructure } = require('./_helper');

module.exports = defineDeckStructure({
  id: 'news-summary',
  version: '1.0',
  description:
    'ニュース要約デッキ。複数のニュース記事や業界トピックを並べて整理し、' +
    '読み手に「今この領域で何が起きているか」を素早く伝える。' +
    '章概念は最小化、各カードがスタンドアロン、出典明示が最重要。',
  // セーフティで questions[] が空なら実質 false なので news-summary でも regression なし。
  qa_driven_default: true,

  // ─────────────────────────────────────────────
  // header: 序盤固定枠 (3 必須)
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
      template_id: ['SECSUMMARY-1', 'FRAMING-2', 'WEBPAGE-1'],
      required: true,
      rule: 'StructQA-01',
      message:
        'StructQA-01: header[1] はヘッドライン要約必須 ' +
        '(SECSUMMARY-1: 全景 SVG / FRAMING-2: Before/After / WEBPAGE-1: トップ記事)。' +
        '判定基準: 1 枚絵で全景 → SECSUMMARY-1 / 認識変化を約束 → FRAMING-2 / メイン記事 → WEBPAGE-1',
    },
    {
      position: 2,
      template_id: 'SECTION-6',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[2] は SECTION-6 (目次) 必須',
    },
  ],

  // ─────────────────────────────────────────────
  // body: 章繰り返し (1-3 章)
  // ─────────────────────────────────────────────
  body: {
    count: { min: 1, max: 3 },         // 章数 1-3 (learning-deck の 2-6 より下振れ)

    head: [
      {
        position: 0,
        template_id: ['SECTION-2', 'SECTION-4', 'SECTION-5'],
        required: true,
        rule: 'StructQA-12',
        message:
          'StructQA-12: chapter.head[0] は章扉 (SECTION-2 / SECTION-4 / SECTION-5) 必須',
      },
      // ★ 見取り図は強制しない (head[1] なし)
    ],

    content: {
      count: { min: 2, max: 8 },       // ニュース項目 2-8 件 / 章
      allowedTemplates: 'any',
      severity: { min: 'warn', max: 'warn' },
    },

    tail: [],                          // ★ 章末まとめ FRAMING-5 不要 (空配列を強制)
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
      template_id: 'WEBPAGE-2',
      required: true,
      rule: 'StructQA-02',
      message:
        'StructQA-02: footer に WEBPAGE-2 (出典クレジット集 = 関連URLカードグリッド) 必須。' +
        'ニュース要約はソース明示が信頼性の根幹',
    },
    {
      position: 2,
      template_id: 'DATA-4',
      required: true,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer に DATA-4 (参考情報集 SR) 必須',
    },
    {
      position: 3,
      template_id: 'FRAMING-4',
      required: true,
      rule: 'StructQA-02',
      message:
        'StructQA-02: footer に FRAMING-4 (所感・問いかけ = お土産枠の意味付け流用) 必須',
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
    totalSlides: { min: 8, max: 30 },  // 短尺〜中尺 (learning-deck は 14-60)

    requiredTags: [
      {
        tag: 'web-card',
        min: 1,
        rule: 'StructQA-23',
        templates: ['WEBPAGE-1', 'WEBPAGE-2', 'WEBPAGE-3', 'WEBPAGE-4', 'VISUAL-7'],
        appliesIf: () => true,         // ニュース要約は無条件で必須
        message:
          'StructQA-23: news-summary は WEBPAGE-1〜4 / VISUAL-7 のいずれかを 1 枚以上必須。' +
          'ニュース要約は「どこの媒体のどの記事を引いたか」が信頼性の核',
      },
      {
        tag: 'flowchart',
        min: 1,
        rule: 'StructQA-21',
        templates: ['DIAGRAM-3'],
        nestedDiagrams: ['SCENE-06'],
        appliesIf: (deckJson) => deckJson.doc && deckJson.doc.decision_focused === true,
        message:
          'StructQA-21: doc.decision_focused: true 明示時のみ FlowChart (DIAGRAM-3 / SCENE-06) を 1 枚以上必須。' +
          'news-summary はデフォルトで decision_focused: false 想定 (= 検査 skip)',
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
