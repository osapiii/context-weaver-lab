/**
 * deck-structures/proposal-deck.js
 * =================================
 * 「何かを提案して相手に意思決定してもらう」用途の構造定義。
 *
 * 仕様書:
 *   - `references/deck-structures/proposal-deck.md`
 *   - `references/phase2-information-design/plan-json-v9-structure.md`
 *
 * StructureQA で適用されるルール (16 ルール):
 *   StructQA-00 (Template メタ)
 *   StructQA-01 (header の順序・必須 / 全 4 枚)
 *   StructQA-02 (footer の必須スライド)
 *   StructQA-03 (章構造 head[2] / content / tail[1])
 *   StructQA-04 (章数 3-6)
 *   StructQA-05 (章内本文 1-8 枚) [warn]
 *   StructQA-06 (総スライド 12-50 枚)
 *   StructQA-12 (章扉直後の SECSUMMARY-1)
 *   StructQA-13 (章末 FRAMING-5)
 *   StructQA-22 (HubSpoke 上限)
 *
 * proposal-deck 専用ルール (StructQA-30〜35):
 *   StructQA-30 [warn]  doc.proposal_meta が定義されているか
 *   StructQA-31 [warn]  benefit_horizons が short/mid/long のうち 2 つ以上 (single_horizon: true で skip)
 *   StructQA-32 [fatal] risks[] は {risk, mitigation} ペア必須
 *   StructQA-33 [fatal] scenarios に best / median / worst の 3 ケース必須
 *   StructQA-34 [fatal] footer に FRAMING-5 (判断軸チェックリスト) 1 枚必須
 *   StructQA-35 [warn]  Decision flow (DIAGRAM-3 / SCENE-06) 推奨 (decision_focused: false で skip)
 *
 * 実装方針:
 *   - `_helper.js` の `defineDeckStructure(spec)` を呼んで基本 schema を組み立てた後、
 *     `.superRefine` を追加することで proposal-deck 専用の StructQA-30〜34 を後付けする。
 *   - これにより既存 deckStructure (learning-deck / news-summary) の挙動には影響しない。
 *   - StructQA-35 (Decision flow) は spec.globalConstraints.requiredTags で表現できるため
 *     defineDeckStructure 内のルートで処理。
 */

'use strict';

const { z } = require('zod');
const { defineDeckStructure, getAllSlides } = require('./_helper');

// ───────────────────────────────────────────────────────
// 基本構造を defineDeckStructure で組む
// ───────────────────────────────────────────────────────

const baseDeck = defineDeckStructure({
  id: 'proposal-deck',
  version: '1.0',
  description:
    '提案デッキ。意思決定者 (家族/上司/顧客) の YES/NO を取りに行く構成。' +
    '背景 → 提案 → メリット時間軸 → リスク×軽減 → シナリオ別 → 体制 → 判断軸チェックリスト → 次の一歩。' +
    '読了後に判断保留せず踏み込ませることがゴール。',
  // セーフティで questions[] が空なら実質 false。
  qa_driven_default: true,

  // ─────────────────────────────────────────────
  // header: 序盤固定枠 (4 必須)
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
      message: 'StructQA-01: header[1] は FRAMING-1 (状況の起点 = なぜ今提案するのか) 必須',
    },
    {
      position: 2,
      template_id: 'FRAMING-2',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[2] は FRAMING-2 (提案で起きる変化 = Before/After) 必須',
    },
    {
      position: 3,
      template_id: 'SECTION-6',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[3] は SECTION-6 (目次) 必須',
    },
  ],

  // ─────────────────────────────────────────────
  // body: 章繰り返し (3-6 章)
  // ─────────────────────────────────────────────
  body: {
    count: { min: 3, max: 6 },

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
        position: 1,
        template_id: 'SECSUMMARY-1',
        required: true,
        rule: 'StructQA-12',
        message:
          'StructQA-12: chapter.head[1] は SECSUMMARY-1 (主役ビジュアル一発) 必須。' +
          'svg / svg_file を必ず指定し、提案章の世界観を 1 枚絵で渡す',
      },
    ],

    content: {
      count: { min: 1, max: 8 },
      allowedTemplates: 'any',
      severity: { min: 'warn', max: 'warn' },
    },

    tail: [
      {
        position: 0,
        template_id: 'FRAMING-5',
        required: true,
        rule: 'StructQA-13',
        message:
          'StructQA-13: chapter.tail[0] は FRAMING-5 (章末判断材料) 必須。' +
          'mode: comprehension / recap で章ごとの判断材料を 3 件に圧縮',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // footer: 末尾固定枠
  // ─────────────────────────────────────────────
  // 注意: FRAMING-5 (判断軸チェックリスト) は StructQA-34 として後段で superRefine 追加検査する。
  //       footerRuleToZod は footer 内に required template_id が存在するかを検査するので、
  //       FRAMING-5 を required: true で渡せばここでも一定検査される。
  //       より厳格な「mode: decision-checklist」「FRAMING-5 1 枚以上」検査は superRefine 側で。
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
      message: 'StructQA-02: footer に DATA-4 (参考資料) 必須',
    },
    {
      position: 2,
      template_id: 'FRAMING-5',
      required: true,
      rule: 'StructQA-34',
      message:
        'StructQA-34: footer に FRAMING-5 (判断軸チェックリスト = mode: decision-checklist) 必須。' +
        '章末 FRAMING-5 とは別に、デッキ最終で「YES と言う前に確認すべき項目」を 3-7 件並べる',
    },
    {
      position: 3,
      template_id: 'FRAMING-4',
      required: true,
      rule: 'StructQA-02',
      message:
        'StructQA-02: footer に FRAMING-4 (次の一歩 = お土産枠を「明日から何をするか」に流用) 必須',
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
    totalSlides: { min: 12, max: 50 },

    requiredTags: [
      // StructQA-35: Decision flow 推奨 (warn)
      // 注意: _helper.js の defineDeckStructure superRefine は z.ZodIssueCode.custom で
      //       issue を addIssue するため、severity (warn) は structure-qa.js 側で
      //       RULE_DEFAULT_LEVEL に基づいて決まる。ここでは message に StructQA-35 を埋める。
      {
        tag: 'flowchart',
        min: 1,
        rule: 'StructQA-35',
        templates: ['DIAGRAM-3'],
        nestedDiagrams: ['SCENE-06'],
        appliesIf: (deckJson) =>
          deckJson.doc && deckJson.doc.decision_focused !== false,
        message:
          'StructQA-35: 提案デッキは Decision flow (DIAGRAM-3 / SCENE-06 vertical-decision) を 1 枚以上推奨。' +
          '判断ロジックが文章で散らばらず 1 枚に収束する。' +
          'doc.decision_focused: false で skip 可',
      },
    ],

    maxTags: [
      {
        tag: 'hub-and-spoke',
        max: 1,
        rule: 'StructQA-22',
        nestedDiagrams: ['SCENE-02'],
        message:
          'StructQA-22: ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚まで。' +
          '5 並列要素なら LIST-3 / LIST-2、軸ベース配置なら DIAGRAM-1 を検討',
      },
    ],
  },
});

// ───────────────────────────────────────────────────────
// proposal-deck 専用検査 (StructQA-30〜34) を superRefine で追加
//
// _helper.js の `defineDeckStructure` で組まれた baseDeck.schema に対して
// 追加で `.superRefine` を重ねる。Zod の chaining で実現する。
// ───────────────────────────────────────────────────────

/**
 * StructQA-30: doc.proposal_meta が定義されているか (warn)
 * StructQA-31: benefit_horizons が short/mid/long のうち 2 つ以上 (warn, single_horizon: true で skip)
 * StructQA-32: risks[] は {risk, mitigation} ペア必須 (fatal)
 * StructQA-33: scenarios に best / median / worst の 3 ケース必須 (fatal)
 * StructQA-34: footer に FRAMING-5 (判断軸チェックリスト) 1 枚必須 (fatal)
 *
 * 注意:
 *   - severity (fatal/warn) は `structure-qa.js::RULE_DEFAULT_LEVEL` で決まる。
 *     ここでは `addIssue` するだけで、message に "StructQA-XX:" を必ず埋め込む
 *     (extractRuleId が message から rule_id を抽出する)。
 */
const proposalSchema = baseDeck.schema.superRefine((deckJson, ctx) => {
  const doc = deckJson && deckJson.doc;
  if (!doc) return; // doc が無い場合は base schema が既に fatal を出している

  // ───── StructQA-30: proposal_meta 推奨 ─────
  const meta = doc.proposal_meta;
  if (!meta || typeof meta !== 'object') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc', 'proposal_meta'],
      message:
        'StructQA-30: doc.proposal_meta の定義を推奨します。' +
        'risks / scenarios / benefit_horizons の構造化メタを置くと、StructQA-31〜33 が運営判断を支援します',
    });
    // proposal_meta が無いと 31/32/33 は走れないので早期 return
  } else {
    // ───── StructQA-31: benefit_horizons (warn) ─────
    if (meta.single_horizon !== true) {
      const bh = meta.benefit_horizons || {};
      const filledHorizons = ['short', 'mid', 'long'].filter(k => {
        const v = bh[k];
        return typeof v === 'string' && v.trim().length > 0;
      });
      if (filledHorizons.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['doc', 'proposal_meta', 'benefit_horizons'],
          message:
            `StructQA-31: benefit_horizons は short / mid / long のうち最低 2 つ以上で記述してください ` +
            `(現状 ${filledHorizons.length} 個: [${filledHorizons.join(', ') || '空'}])。` +
            '単一時間軸で十分な提案であれば doc.proposal_meta.single_horizon: true で warn を skip 可',
        });
      }
    }

    // ───── StructQA-32: risks[] の risk × mitigation ペア (fatal) ─────
    if (Array.isArray(meta.risks)) {
      meta.risks.forEach((r, i) => {
        const hasRisk = typeof r === 'object' && r !== null
          && typeof r.risk === 'string' && r.risk.trim().length > 0;
        const hasMitigation = typeof r === 'object' && r !== null
          && typeof r.mitigation === 'string' && r.mitigation.trim().length > 0;
        if (!hasRisk) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['doc', 'proposal_meta', 'risks', i, 'risk'],
            message:
              `StructQA-32: risks[${i}].risk が空です。リスクは必ず文字列で書いてください ` +
              '(リスク単独 / 軽減策単独 はどちらも fatal)',
          });
        }
        if (!hasMitigation) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['doc', 'proposal_meta', 'risks', i, 'mitigation'],
            message:
              `StructQA-32: risks[${i}] に mitigation (軽減策) がありません。` +
              'リスクと軽減策はペアで必須 (= リスクを挙げたら必ず軽減策を 1:1 で書く)',
          });
        }
      });
    }

    // ───── StructQA-33: scenarios best/median/worst (fatal) ─────
    if (Array.isArray(meta.scenarios)) {
      const kinds = new Set(
        meta.scenarios
          .map(s => (s && typeof s === 'object' ? s.kind : null))
          .filter(k => typeof k === 'string')
      );
      const required = ['best', 'median', 'worst'];
      const missing = required.filter(k => !kinds.has(k));
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['doc', 'proposal_meta', 'scenarios'],
          message:
            `StructQA-33: scenarios は best / median / worst の 3 ケース必須 ` +
            `(欠落: [${missing.join(', ')}])。` +
            '提案は最低 3 シナリオで「うまく行く / 普通 / 想定外」を描いてはじめて意思決定者の信頼を得る',
        });
      }
      if (meta.scenarios.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['doc', 'proposal_meta', 'scenarios'],
          message:
            `StructQA-33: scenarios は 3 ケース以上必須 (現状 ${meta.scenarios.length} 件)`,
        });
      }
    } else if (meta.scenarios !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['doc', 'proposal_meta', 'scenarios'],
        message: 'StructQA-33: scenarios は array で記述してください',
      });
    }
  }

  // ───── StructQA-34: footer に FRAMING-5 (判断軸チェックリスト) 1 枚必須 (fatal) ─────
  // baseDeck の footerRuleToZod も FRAMING-5 を required で検査するが、
  // メッセージとルール ID を StructQA-34 として明示するためにここで再検査する。
  const footer = Array.isArray(deckJson.footer) ? deckJson.footer : [];
  const framing5Count = footer.filter(s => s && s.template_id === 'FRAMING-5').length;
  if (framing5Count === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['footer'],
      message:
        'StructQA-34: footer に FRAMING-5 (判断軸チェックリスト) が 1 枚必須。' +
        'mode: "decision-checklist" で「YES と言う前に確認すべき項目」を 3-7 件並べる。' +
        '章末 FRAMING-5 (mode: comprehension/recap) とは別の 1 枚として配置すること',
    });
  }
});

// ───────────────────────────────────────────────────────
// export
// ───────────────────────────────────────────────────────

module.exports = {
  // baseDeck の spec / 個別 schema をそのまま流用 (print-deck-structure.js が参照)
  spec:               baseDeck.spec,
  headerSchema:       baseDeck.headerSchema,
  chapterSchema:      baseDeck.chapterSchema,
  footerSchema:       baseDeck.footerSchema,
  id:                 baseDeck.id,
  version:            baseDeck.version,
  description:        baseDeck.description,
  qa_driven_default:  baseDeck.qa_driven_default,
  // schema は superRefine 重ねたものを使う (これが validateDeckStructure から呼ばれる)
  schema:             proposalSchema,
};
