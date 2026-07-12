/**
 * lib/structure-qa.js
 * ====================
 * doc field 名を `deck_structure_template` → `deck_structure` に切替。
 *
 * 役割:
 *   - `validateDeckStructure(deckJson)` を export
 *   - deck-structures registry から定義を引き、Zod safeParse → エラーを翻訳
 *   - StructQA-XX の rule_id / level (fatal/warn) / suggestion 付きエラーを返す
 *   - エラーメッセージは必ず日本語 + 修正提案付き
 *
 * 関連:
 *   - `scripts/render/deck-structures/index.js` — deckStructure registry
 *   - `scripts/render/deck-structures/_helper.js` — defineDeckStructure / Zod schema
 *   - `references/qa/structure-qa.md` — ルール定義
 *
 */

'use strict';

const path = require('path');
const deckStructures = require(path.join(__dirname, '..', 'deck-structures'));
const { getAllSlides, countGlossaryTerms } = require(path.join(__dirname, '..', 'deck-structures', '_helper'));
const { QuestionSchema } = require(path.join(__dirname, '..', 'schemas', 'common'));

// ───────────────────────────────────────────────────────
// StructQA-XX ルール一覧
//
// deckStructure 別の適用範囲:
//   - learning-deck:    11 ルール (00/01/02/03/04/05/06/12/13/21/22)
//   - news-summary:     10 ルール (12/13 撤去 + 23 追加)
//   - proposal-deck:   16 ルール (00/01/02/03/04/05/06/12/13/22 + 30〜35)
//   - case-study-deck: 17 ルール (00/01/02/03/04/05/06/12/13/22 + 40〜46)
// ───────────────────────────────────────────────────────

const RULE_CATEGORIES = {
  meta: ['StructQA-00'],
  header: ['StructQA-01', 'StructQA-46'],
  footer: ['StructQA-02', 'StructQA-34', 'StructQA-45'],
  chapter_structure: ['StructQA-03'],
  chapter_count: ['StructQA-04'],
  chapter_content: ['StructQA-05'],
  total_slides: ['StructQA-06'],
  chapter_overview: ['StructQA-12'],
  chapter_tail: ['StructQA-13'],
  flowchart: ['StructQA-21', 'StructQA-35'],
  hub_spoke: ['StructQA-22'],
  web_card: ['StructQA-23'],
  proposal_meta: ['StructQA-30', 'StructQA-31', 'StructQA-32', 'StructQA-33'],
  case_meta: ['StructQA-40', 'StructQA-41', 'StructQA-43', 'StructQA-44'],
  comparison_matrix: ['StructQA-42'],
  qa_driven: ['StructQA-50', 'StructQA-51', 'StructQA-52', 'StructQA-53', 'StructQA-54', 'StructQA-55', 'StructQA-56'],
  // v10.5.0: テンプレ多様性 (learning-deck 専用)
  template_diversity: ['StructQA-70', 'StructQA-71', 'StructQA-72'],
};

const RULE_DEFAULT_LEVEL = {
  'StructQA-00': 'fatal',
  'StructQA-01': 'fatal',
  'StructQA-02': 'fatal',
  'StructQA-03': 'fatal',
  'StructQA-04': 'fatal',
  'StructQA-05': 'warn',
  'StructQA-06': 'fatal',
  'StructQA-12': 'fatal',
  'StructQA-13': 'fatal',
  'StructQA-21': 'fatal',
  'StructQA-22': 'fatal',
  'StructQA-23': 'fatal',
  'StructQA-30': 'warn',
  'StructQA-31': 'warn',
  'StructQA-32': 'fatal',
  'StructQA-33': 'fatal',
  'StructQA-34': 'fatal',
  'StructQA-35': 'warn',
  'StructQA-40': 'warn',     // case_meta 推奨
  'StructQA-41': 'fatal',    // cases >= 2
  'StructQA-42': 'fatal',    // 横並び比較スライド必須
  'StructQA-43': 'fatal',    // パターン抽出必須
  'StructQA-44': 'warn',     // 自分への示唆推奨
  'StructQA-45': 'fatal',    // 出典 ≥ 事例数
  'StructQA-46': 'fatal',    // header[3] 一望比較表必須
  'StructQA-50': 'fatal',    // questions[] 件数 2-15
  'StructQA-51': 'fatal',    // 各 Q に id / text / kind / provisionalDirection 必須
  'StructQA-52': 'fatal',    // phase2_locked 後 shortSummary + sectionIndex 必須
  'StructQA-53': 'fatal',    // slide.answers_questions と doc.questions の双方向整合
  'StructQA-54': 'fatal',    // 全 Q に紐付く slide が >=1 件 (孤立 Q ゼロ)
  'StructQA-55': 'warn',     // 全 body 章に紐付く Q が >=1 件 (孤立章は warn)
  'StructQA-56': 'fatal',    // header[] に QA-INDEX が 1 枚必須
  // v10.5.0: テンプレ多様性 (learning-deck 専用)
  'StructQA-70': 'fatal',    // VISUAL 系比率 < 50% で fatal
  'StructQA-71': 'warn',     // 同一テンプレ過剰使用 (warn/fatal は実装側で動的判定)
  'StructQA-72': 'fatal',    // Card/Text 系 3 連続以上 fatal
};

// ───────────────────────────────────────────────────────
// ルール ID 抽出 (メッセージ先頭から StructQA-XX を引き当てる)
// ───────────────────────────────────────────────────────

/**
 * @param {string} message
 * @returns {string|null}
 */
function extractRuleId(message) {
  if (typeof message !== 'string') return null;
  const m = message.match(/StructQA-\d{2}/);
  return m ? m[0] : null;
}

// ───────────────────────────────────────────────────────
// suggestion (修正提案) を組み立てる
//
// 「学習デッキの章末は…」等の文脈固有メッセージを切り替える。
// ───────────────────────────────────────────────────────

// learning-deck 用の suggestion 一式
const SUGGESTIONS_LEARNING_DECK = {
  'StructQA-00':
    'doc.deck_structure に "learning-deck" 等の deckStructure id を明示してください。' +
    '未指定は fatal です。',
  'StructQA-01':
    'header[] の順序は [SECTION-1, FRAMING-1, FRAMING-2, SECTION-6, (任意 VISUAL-8)] です。' +
    '中盤に紛れ込ませず、必ず header[] フィールドの先頭 4 枚に配置してください。',
  'StructQA-02':
    'footer[] には DATA-4 / FRAMING-4 / FRAMING-3 が必須です。' +
    '用語が 3 件以上あるなら DATA-5 (用語集) も必須化されます。' +
    '末尾は FRAMING-3 (会社紹介) で締めてください。',
  'StructQA-03':
    'body.chapters[i] は [head[2 枚: 章扉 + 見取り図], content[1-8 枚], tail[1 枚: FRAMING-5]] の構造です。' +
    '章扉や見取り図を content[] に入れている場合は head[] へ移動してください。',
  'StructQA-04':
    'learning-deck の章数は 2-6 章です。' +
    '1 章しかないなら別 deckStructure を検討、7 章超なら統合 / 分割を検討してください。' +
    'volumeConstraints.chapters.count で上書き可。',
  'StructQA-05':
    '章内本文 (chapter.content[]) は 1-8 枚を推奨。' +
    '12 枚超は subsection 分割か章を分けるべきです (warn のため build は通る)。',
  'StructQA-06':
    'デッキ総スライド数は 14-60 枚です。' +
    '少なすぎるなら章内 content を厚くし、多すぎるなら章を絞るか別 deckStructure を検討してください。',
  'StructQA-12':
    'chapter.head[1] は SECSUMMARY-1 (SVG 主役の章見取り図) 必須。LIST-3 フォールバックは撤廃しました。' +
    'svg / svg_file を必ず指定し、viewBox 1920x1080 + Noto Sans JP で描いてください (dbt-semantic / gemini-file-search-intro 参照)。' +
    'resvg-js + Noto Sans JP 同梱により日本語レンダリングは解決済みのため、フォントを理由に LIST-3 へ落とす必要はありません。',
  'StructQA-13':
    'chapter.tail[0] は FRAMING-5 (mode: comprehension/recap, items 3 件) 必須。' +
    '学習デッキの章末まとめは Magic Number 3 で固定です。',
  'StructQA-21':
    'デッキに DIAGRAM-3 か SCENE-06 (FlowChart) を 1 枚以上置いてください。' +
    'doc.decision_focused: false にすれば warn に格下げ可能ですが、判断軸を絵で見せるのが学習デッキの核です。',
  'StructQA-22':
    'ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚までです。' +
    '5 並列要素なら LIST-3 / LIST-2、軸配置なら DIAGRAM-1 への置換を検討してください。',
  // v10.5.0: テンプレ多様性 (learning-deck 専用)
  'StructQA-70':
    'body の「ユーザー選択枠」(章扉・見取り図 SECSUMMARY-1・章末まとめ FRAMING-5・QA-INDEX を除いた残り) で、' +
    'VISUAL 系 (CHART / SCENE / DIAGRAM / VISUAL-* / WEBPAGE-*) が最低 50% を占めるよう plan.json を組み直してください。' +
    'pptx の強みは「ビジュアルで支える」こと。原則は VISUAL 系から選び、情報密度が低い・図解する意味がないスライドに限って LIST / COMPARE / DATA-1〜3 / CODE 系に落とします。' +
    '具体的な置き換え候補は references/_common/slide-patterns.md と references/phase2-information-design/R2-16 (VISUAL 優先選択) を参照。' +
    'opt-out: doc.diversity_check: false。',
  'StructQA-71':
    '同一テンプレが「ユーザー選択枠」の 30% を超えると warn、40% で fatal。' +
    '同じテンプレが偏ると読者が「またこの形か」と感じます。' +
    'LIST-3 が偏っているなら一部を LIST-2 (3 カラム) / VISUAL-3 (visual + 3 body) / DIAGRAM-1 (2x2 マトリクス) / SCENE-* に振り替えてください。' +
    'LIST-1 が偏っているなら VISUAL-2 (evidence + 結論) / WEBPAGE-1 / DIAGRAM-3 への置換を検討。' +
    'opt-out: doc.diversity_check: false。',
  'StructQA-72':
    'Card/Text 系 (LIST-* / COMPARE-* / DATA-1〜3 / PROJECT-* / CODE-*) が body 中で 3 連続以上ある状態は、読者の視線が単調になり離脱を誘発します。' +
    '間に VISUAL 系を 1 枚挟んでリズムを作ってください (例: LIST-3 → LIST-3 → VISUAL-3 → LIST-3)。' +
    '挟むテンプレが無いなら、その箇所はそもそも図解で示せる情報のはずなので CHART / SCENE / DIAGRAM への昇格を検討。' +
    'opt-out: doc.diversity_check: false。',
};

// news-summary 用の suggestion 一式
const SUGGESTIONS_NEWS_SUMMARY = {
  'StructQA-00':
    'doc.deck_structure に "news-summary" を明示してください。' +
    '未指定は fatal です。',
  'StructQA-01':
    'header[] は 3 枚: [SECTION-1, (SECSUMMARY-1 / FRAMING-2 / WEBPAGE-1 のいずれか), SECTION-6] です。' +
    'header[1] は「ヘッドライン要約」で、1 枚絵で全景を見せたい→SECSUMMARY-1 / 認識変化を約束→FRAMING-2 / メイン記事→WEBPAGE-1。',
  'StructQA-02':
    'footer[] には WEBPAGE-2 / DATA-4 / FRAMING-4 / FRAMING-3 が必須です。' +
    'WEBPAGE-2 (出典クレジット集) はニュース要約の信頼性の根幹なので外せません。' +
    '末尾は FRAMING-3 (会社紹介) で締めてください。',
  'StructQA-03':
    'body.chapters[i] は [head[1 枚: 章扉のみ], content[2-8 枚], tail[空配列]] の構造です。' +
    'news-summary では章末まとめ (FRAMING-5) は使いません。tail に何か入れている場合は content[] へ移動してください。',
  'StructQA-04':
    'news-summary の章数は 1-3 章です。' +
    '1 章でも成立する deckStructure なので、トピックを 1 つの章にまとめる構成が一番シンプル。' +
    '4 章超なら learning-deck か別 deckStructure を検討してください。',
  'StructQA-05':
    '章内本文 (chapter.content[]) は 2-8 枚 (= ニュース項目 2-8 件) を推奨。' +
    '1 件章は冗長、9 件超は章を分けるか WEBPAGE-3 で深掘り構成へ切り替える判断点です。',
  'StructQA-06':
    'デッキ総スライド数は 8-30 枚です。' +
    '30 枚超は「素早く読む」というニュース要約の主旨と矛盾するので、章を絞るか別 deckStructure を検討してください。',
  // StructQA-12 / 13 は news-summary では適用されない (head 1 枚 / tail 0 枚) が、
  // 万一のために default 文言を残置
  'StructQA-12': '(news-summary では未使用ルール)',
  'StructQA-13': '(news-summary では未使用ルール)',
  'StructQA-21':
    'doc.decision_focused: true を明示した場合のみ FlowChart (DIAGRAM-3 / SCENE-06) を 1 枚以上必須。' +
    'news-summary は通常 decision_focused: false で動かすため、このルールは skip されます。',
  'StructQA-22':
    'ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚までです。' +
    '5 並列要素なら LIST-3 / LIST-2、軸配置なら DIAGRAM-1 への置換を検討してください。',
  'StructQA-23':
    'デッキに WEBPAGE-1 / WEBPAGE-2 / WEBPAGE-3 / WEBPAGE-4 / VISUAL-7 のいずれかを 1 枚以上置いてください。' +
    'news-summary は「どこの媒体のどの記事を引いたか」が読者にとっての判断材料の核です。' +
    '出典が示せない記事はそもそもニュース要約に載せないという原則が、このルールの目的。',
};

// proposal-deck 用の suggestion 一式
const SUGGESTIONS_PROPOSAL_DECK = {
  'StructQA-00':
    'doc.deck_structure に "proposal-deck" を明示してください。' +
    '未指定は fatal です。',
  'StructQA-01':
    'header[] は 4 枚: [SECTION-1, FRAMING-1, FRAMING-2, SECTION-6] です。' +
    'FRAMING-1 は「なぜ今提案するのか」(kikkake/kizuki/gimon)、FRAMING-2 は「提案で起きる Before/After」を渡してください。',
  'StructQA-02':
    'footer[] には DATA-4 / FRAMING-5 (判断軸) / FRAMING-4 (次の一歩) / FRAMING-3 が必須です。' +
    '末尾は FRAMING-3 (会社紹介) で締めてください。判断軸チェックリスト (FRAMING-5) と次の一歩 (FRAMING-4) を必ずペアで置くのが proposal-deck の核です。',
  'StructQA-03':
    'body.chapters[i] は [head[2 枚: 章扉 + SECSUMMARY-1], content[1-8 枚], tail[1 枚: FRAMING-5]] の構造です。' +
    '提案デッキは章ごとに「主役ビジュアル一発」と「章末判断材料」を必ず置く運用です。',
  'StructQA-04':
    'proposal-deck の章数は 3-6 章です。' +
    '提案 + メリット + リスク (or シナリオ) を最低 3 章で描くのが推奨。' +
    '7 章超は意思決定者が読み切れず判断疲労に陥るため別 deckStructure を検討してください。',
  'StructQA-05':
    '章内本文 (chapter.content[]) は 1-8 枚を推奨。' +
    '長すぎる章は subsection で分割するか、章自体を分けるべきです (warn のため build は通る)。',
  'StructQA-06':
    'デッキ総スライド数は 12-50 枚です。' +
    '50 枚超は意思決定者を疲れさせるため、提案を分割するか詳細を別添資料に切り出してください。',
  'StructQA-12':
    'chapter.head[1] は SECSUMMARY-1 (主役ビジュアル) 必須。svg / svg_file を指定してください。' +
    '提案デッキでは章の世界観 (現状 / 提案 / リスク絵 / シナリオ絵) を 1 枚絵で渡すのが意思決定者への配慮です。',
  'StructQA-13':
    'chapter.tail[0] は FRAMING-5 (mode: comprehension/recap, items 3 件) 必須です。' +
    '章末まとめで「この章の判断材料」を 3 件に圧縮してください。footer の判断軸チェックリスト (FRAMING-5 mode: decision-checklist) とは別物です。',
  'StructQA-21':
    '(proposal-deck では未使用ルール。代わりに StructQA-35 [warn] が Decision flow を推奨します)',
  'StructQA-22':
    'ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚までです。' +
    '5 並列要素なら LIST-3 / LIST-2、軸配置なら DIAGRAM-1 への置換を検討してください。',
  // proposal-deck 専用
  'StructQA-30':
    'doc.proposal_meta の定義を推奨します。' +
    'risks / scenarios / benefit_horizons を構造化して置くと、StructQA-31〜33 が判断材料の網羅性を支援します。' +
    'スキーマは references/deck-structures/proposal-deck.md §6 を参照。',
  'StructQA-31':
    'doc.proposal_meta.benefit_horizons は short / mid / long のうち最低 2 つ以上で記述してください。' +
    '時間軸を分けることで「短期で実感、中期で習慣、長期で投資」の物語が組めます。' +
    '単一時間軸で十分なら doc.proposal_meta.single_horizon: true で warn を skip 可。',
  'StructQA-32':
    'doc.proposal_meta.risks[] は { risk, mitigation } のペアで記述してください。' +
    'リスク単独 / 軽減策単独はどちらも fatal。' +
    '提案デッキでは「リスクを挙げたら必ず軽減策を 1:1 で書く」が信頼の根幹です。',
  'StructQA-33':
    'doc.proposal_meta.scenarios は best / median / worst の 3 ケース必須です。' +
    '各 scenarios[].kind に "best" / "median" / "worst" を入れてください。' +
    '3 シナリオで「うまく行く / 普通 / 想定外」を描いてはじめて意思決定者の信頼を得ます。',
  'StructQA-34':
    'footer に FRAMING-5 (mode: decision-checklist) を 1 枚配置してください。' +
    '「YES と言う前に確認したい項目」を 3-7 件並べる、デッキ最後の判断装置です。' +
    '章末 FRAMING-5 (mode: comprehension/recap) とは別の 1 枚として置くこと。',
  'StructQA-35':
    'デッキに DIAGRAM-3 か SCENE-06 (Decision flow / vertical-decision) を 1 枚以上置くことを推奨します。' +
    '判断ロジックを 1 枚絵に収束させると、意思決定者が議論しやすくなります。' +
    'doc.decision_focused: false で skip 可。',
};

// case-study-deck 用の suggestion 一式
const SUGGESTIONS_CASE_STUDY_DECK = {
  'StructQA-00':
    'doc.deck_structure に "case-study-deck" を明示してください。' +
    '未指定は fatal です。',
  'StructQA-01':
    'header[] は 4 枚: [SECTION-1, FRAMING-1 (テーマ提示), SECSUMMARY-1 (事例カタログ全景), SECTION-6] です。' +
    'header[2] が SECSUMMARY-1 になっているのが他 deckStructure との差別化点。全事例の名前と象徴を 1 枚絵で並べる SVG を渡してください。',
  'StructQA-02':
    'footer[] には DATA-4 / WEBPAGE-2 / FRAMING-4 / FRAMING-3 が必須です。' +
    'WEBPAGE-2 (各事例の出典) と FRAMING-4 (持ち帰り) は事例集の信頼性と実用性の根幹です。' +
    '末尾は FRAMING-3 (会社紹介) で締めてください。',
  'StructQA-03':
    'body.chapters[i] は [head[2 枚: 章扉 + SECSUMMARY-1], content[1-8 枚], tail[1 枚: FRAMING-5]] の構造です。' +
    '事例集デッキは章ごとに「主役ビジュアル一発」と「事例 / 抽出のまとめ」を必ず置く運用です。',
  'StructQA-04':
    'case-study-deck の章数は 3-7 章です。' +
    '事例 2-5 章 + 抽出 1-2 章 = 最低 3 章。事例 1 件のみは StructQA-41 で fatal なので、別 deckStructure (例: company-research) を検討してください。',
  'StructQA-05':
    '章内本文 (chapter.content[]) は 1-8 枚を推奨。' +
    '長すぎる事例章は subsection で分割するか、章自体を分けるべきです (warn のため build は通る)。',
  'StructQA-06':
    'デッキ総スライド数は 14-60 枚です。' +
    '事例数を絞るか、各事例の content 枚数を減らして調整してください。',
  'StructQA-12':
    'chapter.head[1] は SECSUMMARY-1 (主役ビジュアル) 必須。svg / svg_file を指定してください。' +
    '事例章は事例の象徴 (ロゴ・施策イメージ等)、抽出章は比較全景や共通パターン図を 1 枚絵で渡します。',
  'StructQA-13':
    'chapter.tail[0] は FRAMING-5 (mode: comprehension/recap, items 3 件) 必須です。' +
    '事例章は事例まとめ (mode: comprehension/recap)、抽出章は抽出まとめ (mode: pattern-summary 等) で使い分け。',
  'StructQA-22':
    'ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚までです。' +
    '5 並列要素なら LIST-3 / LIST-2、軸配置なら DIAGRAM-1 への置換を検討してください。',
  // case-study-deck 専用
  'StructQA-40':
    'doc.case_meta の定義を推奨します。' +
    'cases / patterns / takeaways / observation_axes を構造化して置くと、StructQA-41/43/44/45 が事例集約の品質を支援します。' +
    'スキーマは references/deck-structures/case-study-deck.md §5 を参照。',
  'StructQA-41':
    'doc.case_meta.cases は 2 件以上必須です。' +
    '事例 1 件のみは「事例集」として構造的に成立しません (= 比較不能)。' +
    '1 社深掘りなら別 deckStructure (例: company-research) を、複数事例で集めるなら事例を 1 件追加してください。',
  'StructQA-42':
    'デッキに横並び比較スライド (COMPARE-3 / COMPARE-5 / COMPARE-6) を 1 枚以上置いてください。' +
    '比較軸を固定して全事例を 1 枚マトリクスに並べることが「事例集」と「比較分析」を分ける核です。' +
    '長文比較なら COMPARE-5 / COMPARE-6 を、評価記号 (◎○△×) なら COMPARE-3 を推奨。',
  'StructQA-43':
    'パターン抽出を必ず 1 件以上書いてください。' +
    'doc.case_meta.patterns に共通パターンの string array を入れるか、抽出章のスライドに is_pattern_extraction: true フラグを立てる。' +
    '事例集デッキは「集めて並べる」だけでなく「共通パターンを抽出する」が核です。',
  'StructQA-44':
    'doc.case_meta.takeaways に「自分の案件にどう適用するか」を 1 件以上書くか、' +
    'footer の FRAMING-4 omiyage で持ち帰りテンプレを渡してください。' +
    '事例を集めっぱなしでは読者が動けません。',
  'StructQA-45':
    'footer に WEBPAGE-2 (各事例の出典クレジット集) を必須化し、cases[].source.label を全件で揃え、' +
    'WEBPAGE-2.items.length が cases.length 以上であることを確認してください。' +
    '事例集デッキは「どこの事例か = 出典」が信頼性の根幹で、出典は事例数 × 1 以上必要です。',
  'StructQA-46':
    'header[3] に一望比較表 (COMPARE-3 / COMPARE-5 / COMPARE-6 / DATA-2) を 1 枚配置してください。' +
    '全事例の "存在" と "ざっくり差分" を 4-6 軸で 1 枚に並べ、ディテールに潜る前の俯瞰を作ります。' +
    'body の横並び比較 (StructQA-42) とは役割が違います ─ ' +
    'header= 低密度俯瞰 (各事例 1 行 + 4-6 列) / body= 高密度抽出 (各事例 1 列 + 多項目)。' +
    'header[3] と body の両方が必要です (両方を 1 枚で兼ねることはできません)。',
};

const SUGGESTIONS_BY_DECK_STRUCTURE = {
  'learning-deck':   SUGGESTIONS_LEARNING_DECK,
  'news-summary':    SUGGESTIONS_NEWS_SUMMARY,
  'proposal-deck':   SUGGESTIONS_PROPOSAL_DECK,
  'case-study-deck': SUGGESTIONS_CASE_STUDY_DECK,
};

// ───────────────────────────────────────────────────────
//
// 全 deckStructure 横断で同じ文言を返すため、deckStructure 別 dict には
// 含めず suggestionFor() の fallback で参照する。
// ───────────────────────────────────────────────────────

const SUGGESTIONS_QA_DRIVEN = {
  'StructQA-50':
    'qa_driven=true なら questions[] を 2-15 件で書いてください。' +
    '1 件以下は深掘り不足、16 件以上は焦点がボヤけるため 2 デッキに分割してください。',
  'StructQA-51':
    '各 question に id (Q1, Q2, …) / text (10-80 字) / kind (definitional/comparative/decisional/how_to/risk/other) / ' +
    'provisionalDirection (Phase 1 段階の暫定回答方向性 1-2 文) が必須です。' +
    'references/phase1-hearing/qa-scaffolding.md の叩き台 Q 提示テンプレを参考に。',
  'StructQA-52':
    'Phase 2 完了 (phase2_locked=true) 時は全 Q に shortSummary (≤30 字) と sectionIndex (>=1 件) が必要です。' +
    'shortSummary は QA-INDEX 早見表に表示する 1 行回答、sectionIndex はその Q が解消される章/slide id 配列です。',
  'StructQA-53':
    'slide.answers_questions[] が参照する qid は doc.questions[].id に存在しないといけません。' +
    'スペルミス (Q1 vs q1) や未定義 Q への参照を確認してください。',
  'StructQA-54':
    '全 question は最低 1 枚の slide.answers_questions[] に含まれる必要があります (孤立 Q 検出)。' +
    'その Q を解消する slide を 1 枚以上特定し、slide.answers_questions に当該 qid を追加してください。' +
    '解消する slide が無いなら、その Q はデッキで答えられないので削除を検討。',
  'StructQA-55':
    '全 body 章には answers_questions を持つ slide が最低 1 件あることを推奨。' +
    '「とりあえず章」を防ぐためのチェックです (warn)。章の存在意義が無いなら削除、' +
    '内容はあるが Q に紐付いていないだけなら slide に answers_questions を追加してください。',
  'StructQA-56':
    'qa_driven=true なら header[] に template_id "QA-INDEX" の slide を 1 枚必ず置いてください。' +
    'SECTION-6 (目次) の直後の 5 枚目に配置するのが既定です。' +
    '「解決したい疑問・懸念」の早見表として読者の入口になります。',
};

const RULE_SUGGESTIONS = SUGGESTIONS_LEARNING_DECK;
// 旧称 alias
const SUGGESTIONS_BY_TEMPLATE = SUGGESTIONS_BY_DECK_STRUCTURE;

/**
 * @param {string} ruleId
 * @param {string} [deckStructureId]  deckStructure id ('learning-deck' / 'news-summary' 等)
 *                                    未指定なら learning-deck の suggestion を返す
 * @returns {string}
 */
function suggestionFor(ruleId, deckStructureId) {
  if (SUGGESTIONS_QA_DRIVEN[ruleId]) return SUGGESTIONS_QA_DRIVEN[ruleId];

  const dict = (deckStructureId && SUGGESTIONS_BY_DECK_STRUCTURE[deckStructureId]) || SUGGESTIONS_LEARNING_DECK;
  return dict[ruleId]
    || SUGGESTIONS_LEARNING_DECK[ruleId]   // fallback: learning-deck から拾う
    || '該当 deckStructure の references/deck-structures/{id}.md を参照してください';
}

// ───────────────────────────────────────────────────────
// Zod issue → StructQA issue 翻訳
// ───────────────────────────────────────────────────────

/**
 * Zod の issue を StructQA-XX 形式に翻訳する。
 * path から「どこの章のどのスライド」を再構築 + 日本語化 + suggestion 付与。
 *
 * @param {object} zodIssue
 * @param {object} deckStructure
 * @returns {{ rule, level, target, message, suggestion, path }}
 */
function translateToStructQA(zodIssue, deckStructure) {
  const message = zodIssue.message || '';
  const ruleId = extractRuleId(message) || 'StructQA-00';
  const level = RULE_DEFAULT_LEVEL[ruleId] || 'fatal';
  const deckStructureId = deckStructure && deckStructure.id;

  // path から target を再構築
  // 例: ['header', 0, 'template_id'] → 'header[0].template_id'
  // 例: ['body', 'chapters', 0, 'head', 1, 'template_id'] → 'body.chapters[0].head[1].template_id'
  const target = (zodIssue.path || []).map(p =>
    typeof p === 'number' ? `[${p}]` : `.${p}`
  ).join('').replace(/^\./, '') || 'deck';

  return {
    rule: ruleId,
    level,
    target,
    message,
    suggestion: suggestionFor(ruleId, deckStructureId),
    path: zodIssue.path || [],
  };
}

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

/**
 * doc.qa_driven の resolved 値を返す。
 *
 * 全 deckStructure で qa_driven_default = true になったため、
 * 既存デッキ (questions[] を持たない) を壊さないセーフティを追加。
 *
 *   1. doc.qa_driven が boolean なら明示値を採用 (オプトイン / オプトアウト両方)
 *   2. 未指定: deckStructure.qa_driven_default が true でも、
 *      questions[] が空または未指定なら **false 扱い** (既存デッキ regression 防止)
 *   3. 未指定: deckStructure.qa_driven_default が true で questions[] >= 1 件
 *      なら true (新規デッキの自動 opt-in)
 *   4. 未指定: deckStructure.qa_driven_default が false なら false
 *
 * @param {object} deckJson
 * @param {object} deckStructure  deck-structures/index.js の getDeckStructure() の戻り値
 * @returns {boolean}
 */
function resolveQADrivenFlag(deckJson, deckStructure) {
  const explicit = deckJson && deckJson.doc && deckJson.doc.qa_driven;
  if (typeof explicit === 'boolean') return explicit;

  // 未指定: deckStructure default を見る
  const defaultOn = (deckStructure && deckStructure.qa_driven_default) === true;
  if (!defaultOn) return false;
  // (既存デッキ regression 防止 / 新規デッキは questions[] を書いた時点で自動 opt-in)
  const questions = deckJson && deckJson.doc && deckJson.doc.questions;
  const hasQuestions = Array.isArray(questions) && questions.length > 0;
  return hasQuestions;
}

/**
 * QA 駆動モードの検査 (StructQA-50〜56)。
 *
 * resolveQADrivenFlag で false なら何も検査せず early return。
 * true の時のみ全 7 ルールが走る。
 *
 * @param {object} deckJson
 * @param {object} deckStructure
 * @returns {{ enabled: boolean, issues: Array }}
 */
function validateQADrivenMode(deckJson, deckStructure) {
  const enabled = resolveQADrivenFlag(deckJson, deckStructure);
  if (!enabled) return { enabled: false, issues: [] };

  const issues = [];
  const deckStructureId = deckStructure && deckStructure.id;
  const doc = (deckJson && deckJson.doc) || {};
  const questions = Array.isArray(doc.questions) ? doc.questions : [];
  const phase2Locked = doc.phase2_locked === true;

  // ───── StructQA-50: 件数 2-15 ─────
  if (questions.length < 2) {
    issues.push({
      rule: 'StructQA-50',
      level: RULE_DEFAULT_LEVEL['StructQA-50'],
      target: 'doc.questions',
      message: `StructQA-50: questions[] の件数 ${questions.length} が下限 2 未満`,
      suggestion: suggestionFor('StructQA-50', deckStructureId),
      path: ['doc', 'questions'],
    });
  } else if (questions.length > 15) {
    issues.push({
      rule: 'StructQA-50',
      level: RULE_DEFAULT_LEVEL['StructQA-50'],
      target: 'doc.questions',
      message: `StructQA-50: questions[] の件数 ${questions.length} が上限 15 超過 (2 デッキ分割を検討)`,
      suggestion: suggestionFor('StructQA-50', deckStructureId),
      path: ['doc', 'questions'],
    });
  }

  // ───── StructQA-51: 各 Q の必須フィールド (QuestionSchema 経由) ─────
  questions.forEach((q, i) => {
    const r = QuestionSchema.safeParse(q);
    if (!r.success) {
      for (const zi of r.error.issues) {
        const pathStr = zi.path.length > 0 ? '.' + zi.path.join('.') : '';
        const qLabel = q && typeof q.id === 'string' ? q.id : `questions[${i}]`;
        issues.push({
          rule: 'StructQA-51',
          level: RULE_DEFAULT_LEVEL['StructQA-51'],
          target: `doc.questions[${i}]${pathStr}`,
          message: `StructQA-51: ${qLabel} ${zi.message}`,
          suggestion: suggestionFor('StructQA-51', deckStructureId),
          path: ['doc', 'questions', i, ...zi.path],
        });
      }
    }
  });

  // ───── StructQA-52: phase2_locked 後 shortSummary + sectionIndex 必須 ─────
  if (phase2Locked) {
    questions.forEach((q, i) => {
      const qLabel = q && typeof q.id === 'string' ? q.id : `questions[${i}]`;
      if (typeof q.shortSummary !== 'string' || q.shortSummary.length === 0) {
        issues.push({
          rule: 'StructQA-52',
          level: RULE_DEFAULT_LEVEL['StructQA-52'],
          target: `doc.questions[${i}].shortSummary`,
          message: `StructQA-52: phase2_locked=true なら ${qLabel} の shortSummary (≤30 字) が必須`,
          suggestion: suggestionFor('StructQA-52', deckStructureId),
          path: ['doc', 'questions', i, 'shortSummary'],
        });
      }
      if (!Array.isArray(q.sectionIndex) || q.sectionIndex.length === 0) {
        issues.push({
          rule: 'StructQA-52',
          level: RULE_DEFAULT_LEVEL['StructQA-52'],
          target: `doc.questions[${i}].sectionIndex`,
          message: `StructQA-52: phase2_locked=true なら ${qLabel} の sectionIndex (>=1 件) が必須`,
          suggestion: suggestionFor('StructQA-52', deckStructureId),
          path: ['doc', 'questions', i, 'sectionIndex'],
        });
      }
    });
  }

  // ───── StructQA-53 / 54: Q ⇔ slide の双方向整合 ─────
  const allSlides = getAllSlides(deckJson);
  const definedQids = new Set(
    questions.map(q => (q && typeof q.id === 'string') ? q.id : null).filter(Boolean)
  );
  const referencedQids = new Set();

  for (const slide of allSlides) {
    if (!Array.isArray(slide.answers_questions)) continue;
    for (const qid of slide.answers_questions) {
      referencedQids.add(qid);
      if (!definedQids.has(qid)) {
        // StructQA-53: 未定義 qid を slide が参照している
        issues.push({
          rule: 'StructQA-53',
          level: RULE_DEFAULT_LEVEL['StructQA-53'],
          target: `slide ${slide.id || '?'}.answers_questions`,
          message: `StructQA-53: slide ${slide.id || '?'} が参照する qid "${qid}" は doc.questions[] に未定義`,
          suggestion: suggestionFor('StructQA-53', deckStructureId),
          path: ['slide', slide.id || '?', 'answers_questions'],
        });
      }
    }
  }

  // StructQA-54: 全 Q に >=1 件の slide が紐付き必須 (孤立 Q ゼロ)
  for (const q of questions) {
    if (!q || typeof q.id !== 'string') continue;
    if (!referencedQids.has(q.id)) {
      issues.push({
        rule: 'StructQA-54',
        level: RULE_DEFAULT_LEVEL['StructQA-54'],
        target: `doc.questions ${q.id}`,
        message: `StructQA-54: ${q.id} を answers_questions に含む slide が見つからない (孤立 Q)`,
        suggestion: suggestionFor('StructQA-54', deckStructureId),
        path: ['doc', 'questions', q.id],
      });
    }
  }

  // ───── StructQA-55: 全 body 章に answers_questions を持つ slide が >=1 件 (warn) ─────
  const chapters = (deckJson && deckJson.body && deckJson.body.chapters) || [];
  chapters.forEach((ch, idx) => {
    const chSlides = [
      ...(Array.isArray(ch.head) ? ch.head : []),
      ...(Array.isArray(ch.content) ? ch.content : []),
      ...(Array.isArray(ch.tail) ? ch.tail : []),
    ];
    const hasAnswer = chSlides.some(s => Array.isArray(s.answers_questions) && s.answers_questions.length > 0);
    if (!hasAnswer) {
      const chLabel = ch.title || ch.name || ch.id || `chapters[${idx}]`;
      issues.push({
        rule: 'StructQA-55',
        level: RULE_DEFAULT_LEVEL['StructQA-55'],
        target: `body.chapters[${idx}]`,
        message: `StructQA-55: 章 "${chLabel}" にどの Q も answers_questions で紐付いていない (孤立章)`,
        suggestion: suggestionFor('StructQA-55', deckStructureId),
        path: ['body', 'chapters', idx],
      });
    }
  });

  // ───── StructQA-56: header[] に template_id 'QA-INDEX' が 1 枚必須 ─────
  const header = Array.isArray(deckJson && deckJson.header) ? deckJson.header : [];
  const hasQAIndex = header.some(s => s && s.template_id === 'QA-INDEX');
  if (!hasQAIndex) {
    issues.push({
      rule: 'StructQA-56',
      level: RULE_DEFAULT_LEVEL['StructQA-56'],
      target: 'header[]',
      message: 'StructQA-56: qa_driven=true なら header[] に template_id "QA-INDEX" の slide が 1 枚必須',
      suggestion: suggestionFor('StructQA-56', deckStructureId),
      path: ['header'],
    });
  }

  return { enabled: true, issues };
}

// ─────────────────────────────────────────────────────────────
// v10.5.0: テンプレ多様性検査 (StructQA-70/71/72)
//
// 課題: learning-deck で plan.json を組む時、AI が LIST-1/2/3 等の Card/Text
// 系に偏った構成を出す傾向があり、pptx の強みである「ビジュアルで支える」
// 運用が崩れる。原則は VISUAL / SVG / CHART / DIAGRAM / SCENE 系から選び、
// 情報密度が低いスライドに限って Card/Text 系を使うべきという osanai 氏の
// 方針 (2026-05-11) を機械強制する。
//
// ルール:
//   StructQA-70 [fatal]: ユーザー選択枠の中で VISUAL 系比率 < 50% で fatal
//   StructQA-71 [warn/fatal]: 同一テンプレが分母の > 30% で warn、> 40% で fatal
//   StructQA-72 [fatal]: Card/Text 系が body で 3 連続以上で fatal
//
// 分母 (= ユーザー選択枠):
//   body 全スライド (head + content + tail) から「固定枠」を除外したもの。
//   固定枠 = SECTION-* / SECSUMMARY-* / QA-INDEX / FRAMING-5 / FRAMING-3,4 / DATA-4,5
//   分母 < 6 枚なら全ルール skip (短いデッキは比率の意味が薄い)。
//
// 分子 (VISUAL 系):
//   CHART-* / SCENE-* / DIAGRAM-1〜4 / DIAG-* / VISUAL-1〜12 / WEBPAGE-*
//
// opt-out:
//   doc.diversity_check: false   または   deckStructure !== 'learning-deck'
// ─────────────────────────────────────────────────────────────

// v1.14: SECTION-1G (full-bleed SVG-only) は **VISUAL** カウントに. 他 SECTION-* は fixed.
// FIXED_SLOT は SECTION- のうち 1G 以外 + SECSUMMARY/QA-INDEX/FRAMING-3-5/DATA-4-5.
const VISUAL_TEMPLATE_RE = /^(CHART-|SCENE-|DIAGRAM-[1-4]\b|DIAG-|VISUAL-|WEBPAGE-|SECTION-1G\b)/;
const FIXED_SLOT_TEMPLATE_RE = /^(SECTION-(?!1G\b)|SECSUMMARY-|QA-INDEX$|FRAMING-[345]\b|DATA-[45]\b)/;
const CARD_TEXT_TEMPLATE_RE = /^(LIST-|COMPARE-|PROJECT-|DATA-[123]\b|CODE-|FREE-)/;

function classifyTemplate(templateId) {
  if (!templateId || typeof templateId !== 'string') return 'other';
  if (FIXED_SLOT_TEMPLATE_RE.test(templateId)) return 'fixed';
  if (VISUAL_TEMPLATE_RE.test(templateId)) return 'visual';
  if (CARD_TEXT_TEMPLATE_RE.test(templateId)) return 'card_text';
  return 'other';
}

function _collectBodySlides(deckJson) {
  const slides = [];
  // v9 形式 (body.chapters[]) を優先
  const body = deckJson && deckJson.body;
  const v9chapters = body && Array.isArray(body.chapters) ? body.chapters : null;
  if (v9chapters && v9chapters.length > 0) {
    for (const ch of v9chapters) {
      const head = Array.isArray(ch && ch.head) ? ch.head : [];
      const content = Array.isArray(ch && ch.content) ? ch.content : [];
      const tail = Array.isArray(ch && ch.tail) ? ch.tail : [];
      for (const s of head) slides.push({ template_id: s && s.template_id, slot: 'head' });
      for (const s of content) slides.push({ template_id: s && s.template_id, slot: 'content' });
      for (const s of tail) slides.push({ template_id: s && s.template_id, slot: 'tail' });
    }
    return slides;
  }
  // (sections[]) — _v9_role === 'chapter' の section のみ body 扱い
  const sections = Array.isArray(deckJson && deckJson.sections) ? deckJson.sections : [];
  for (const sec of sections) {
    const role = sec && (sec._v9_role || sec.role);
    if (role !== 'chapter') continue;
    const secSlides = Array.isArray(sec && sec.slides) ? sec.slides : [];
    for (const s of secSlides) {
      slides.push({ template_id: s && s.template_id, slot: 'chapter' });
    }
  }
  return slides;
}

function validateTemplateDiversity(deckJson, deckStructure) {
  // v10.5.0 では learning-deck のみ対応 (他 deckStructure は将来拡大)
  if (!deckStructure || deckStructure.id !== 'learning-deck') {
    return { issues: [] };
  }
  // opt-out
  if (deckJson && deckJson.doc && deckJson.doc.diversity_check === false) {
    return { issues: [] };
  }

  const bodySlides = _collectBodySlides(deckJson);
  if (bodySlides.length === 0) return { issues: [] };

  // 分母 = ユーザー選択枠 (固定枠を除外)
  const userChoice = bodySlides.filter(s => classifyTemplate(s.template_id) !== 'fixed');
  const denom = userChoice.length;

  const issues = [];

  // 分母が 6 枚未満なら全ルール skip
  if (denom < 6) return { issues };

  const deckStructureId = deckStructure.id;

  // ─── StructQA-70: VISUAL 系比率 (v1.14 緩和: 50% fatal → 40% fatal + 50% warn) ───
  //   旧:   50% 未満で fatal (44% で render が止まる事故が頻発していた)
  //   新:   40% 未満で fatal / 40-50% で warn / 50% 以上で OK
  //   skeleton-driven 側で各章 content[] が visual >= 50% を狙う設計と合わせて運用.
  const visualCount = userChoice.filter(s => classifyTemplate(s.template_id) === 'visual').length;
  const ratio = visualCount / denom;
  if (ratio < 0.40) {
    issues.push({
      rule: 'StructQA-70',
      level: 'fatal',
      target: 'body.chapters[].content[]',
      message:
        'StructQA-70: VISUAL 系比率 ' + Math.round(ratio * 100) + '% (' + visualCount + '/' + denom + ' 枚) は下限 40% を下回ります。' +
        'pptx の強みは「ビジュアルで支える」こと。原則は CHART / SCENE / DIAGRAM / VISUAL / WEBPAGE 系から選び、' +
        '情報密度が低い・図解する意味がないスライドに限って LIST / COMPARE / DATA-1〜3 / CODE 系を使ってください',
      suggestion: suggestionFor('StructQA-70', deckStructureId),
      path: ['body', 'chapters'],
    });
  } else if (ratio < 0.50) {
    issues.push({
      rule: 'StructQA-70',
      level: 'warn',
      target: 'body.chapters[].content[]',
      message:
        'StructQA-70: VISUAL 系比率 ' + Math.round(ratio * 100) + '% (' + visualCount + '/' + denom + ' 枚) は推奨ライン 50% に届いていません。' +
        'render は通りますが、もう 1-2 枚を DIAGRAM / VISUAL / CHART 系に振り替えるとリズムが出ます。',
      suggestion: suggestionFor('StructQA-70', deckStructureId),
      path: ['body', 'chapters'],
    });
  }

  // ─── StructQA-71: 同一テンプレ過剰使用 ───
  const counts = {};
  for (const s of userChoice) {
    const t = s.template_id || 'unknown';
    counts[t] = (counts[t] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const [topTpl, topCount] = sorted[0];
    const topRatio = topCount / denom;
    if (topRatio > 0.40) {
      issues.push({
        rule: 'StructQA-71',
        level: 'fatal',
        target: 'body.* (' + topTpl + ')',
        message:
          'StructQA-71: 同一テンプレ "' + topTpl + '" が ' + Math.round(topRatio * 100) + '% (' + topCount + '/' + denom + ' 枚) を占めています (40% 超で fatal)。' +
          '章ごとにテンプレを切り替えて、読者が「またこの形か」とならない構成にしてください',
        suggestion: suggestionFor('StructQA-71', deckStructureId),
        path: ['body', 'chapters'],
      });
    } else if (topRatio > 0.30) {
      issues.push({
        rule: 'StructQA-71',
        level: 'warn',
        target: 'body.* (' + topTpl + ')',
        message:
          'StructQA-71: 同一テンプレ "' + topTpl + '" が ' + Math.round(topRatio * 100) + '% (' + topCount + '/' + denom + ' 枚) を占めています (30% 超で warn)。' +
          '別 VISUAL 系で 1-2 枚置き換えを検討してください',
        suggestion: suggestionFor('StructQA-71', deckStructureId),
        path: ['body', 'chapters'],
      });
    }
  }

  // ─── StructQA-72: Card/Text 系 3 連続以上禁止 ───
  let streak = 0;
  let streakStart = -1;
  function flushStreak() {
    if (streak >= 3) {
      const range = bodySlides.slice(streakStart, streakStart + streak).map(s => s.template_id).join(' → ');
      issues.push({
        rule: 'StructQA-72',
        level: 'fatal',
        target: 'body.chapters[].content[] (連続)',
        message:
          'StructQA-72: Card/Text 系テンプレが ' + streak + ' 連続しています (' + range + ')。' +
          '読者の視線が単調になります。間に VISUAL 系 (CHART / SCENE / DIAGRAM / VISUAL-*) を 1 枚入れてリズムを作ってください',
        suggestion: suggestionFor('StructQA-72', deckStructureId),
        path: ['body', 'chapters'],
      });
    }
  }
  for (let i = 0; i < bodySlides.length; i++) {
    const cls = classifyTemplate(bodySlides[i].template_id);
    if (cls === 'card_text') {
      if (streak === 0) streakStart = i;
      streak += 1;
    } else {
      flushStreak();
      streak = 0;
      streakStart = -1;
    }
  }
  flushStreak();

  return { issues, stats: { denom, visualCount, ratio, top: sorted[0] || null } };
}

// ───────────────────────────────────────────────────────
//
// 段階的廃止スケジュール:
//   - v9.4:        fatal に格上げ
//   - v10.0:       完全削除
// ───────────────────────────────────────────────────────

const LEGACY_DECK_STRUCTURE_FIELD = 'deck_structure_template';
const LEGACY_DECK_STRUCTURE_VERSION_FIELD = 'deck_structure_template_version';

/**
 * doc 配下の旧 field を新 field に alias し、用いられた旧 field 名を返す。
 *
 * 入力 deckJson は破壊しない (浅い clone で doc を上書き)。
 *
 * @param {object} deckJson
 */
function aliasLegacyDeckStructureField(deckJson) {
  if (!deckJson || typeof deckJson !== 'object' || !deckJson.doc) {
    return { deckJson, legacyFields: [] };
  }
  const doc = deckJson.doc;
  const legacy = [];
  let nextDoc = doc;

  if (doc[LEGACY_DECK_STRUCTURE_FIELD] && !doc.deck_structure) {
    legacy.push(LEGACY_DECK_STRUCTURE_FIELD);
    nextDoc = Object.assign({}, nextDoc, {
      deck_structure: doc[LEGACY_DECK_STRUCTURE_FIELD],
    });
  }
  if (doc[LEGACY_DECK_STRUCTURE_VERSION_FIELD] && !doc.deck_structure_version) {
    legacy.push(LEGACY_DECK_STRUCTURE_VERSION_FIELD);
    nextDoc = Object.assign({}, nextDoc, {
      deck_structure_version: doc[LEGACY_DECK_STRUCTURE_VERSION_FIELD],
    });
  }

  if (legacy.length === 0) {
    return { deckJson, legacyFields: [] };
  }
  return {
    deckJson: Object.assign({}, deckJson, { doc: nextDoc }),
    legacyFields: legacy,
  };
}

// ───────────────────────────────────────────────────────
// validateDeckStructure (公開 API)
// ───────────────────────────────────────────────────────

/**
 *
 * @returns {{
 *   skipped: boolean,                // deckStructure 未指定 (= 検査スキップ)
 *   ok: boolean,                     // fatal なし
 *   deckStructureId: string|null,    // 解決した deckStructure id
 *   templateId: string|null,         // 互換 alias (= deckStructureId)
 *   issues: Array<{ rule, level, target, message, suggestion, path }>,
 *   summary: { fatal: number, warn: number, total: number },
 * }}
 */
function validateDeckStructure(deckJson) {
  const aliasResult = aliasLegacyDeckStructureField(deckJson);
  const normalized = aliasResult.deckJson;
  const legacyFields = aliasResult.legacyFields;

  const deckStructureId = normalized && normalized.doc && normalized.doc.deck_structure;

  // ───── (1) deckStructure 未指定: skip ─────
  if (!deckStructureId) {
    return {
      skipped: true,
      ok: true,
      deckStructureId: null,
      templateId: null,    // 互換
      issues: [],
      summary: { fatal: 0, warn: 0, total: 0 },
      legacyFields,
    };
  }

  if (deckStructures.isRemovedDeckStructure(deckStructureId)) {
    const removalMsg = deckStructures.getRemovedDeckStructureMessage(deckStructureId);
    const issue = {
      rule: 'StructQA-00',
      level: 'fatal',
      target: 'doc.deck_structure',
      message: `StructQA-00: ${removalMsg}`,
      suggestion: 'plan.json の doc.deck_structure を案内メッセージの推奨値に書き換えてください。' +
                  '案内に従えば既存スライド構成は概ね移植できます。',
      path: ['doc', 'deck_structure'],
    };
    return {
      skipped: false,
      ok: false,
      deckStructureId,
      templateId: deckStructureId,
      issues: [issue],
      summary: { fatal: 1, warn: 0, total: 1 },
      legacyFields,
    };
  }

  // ───── (2) deckStructure 未登録: StructQA-00 fatal ─────
  const deckStructure = deckStructures.getDeckStructure(deckStructureId);
  if (!deckStructure) {
    const issue = {
      rule: 'StructQA-00',
      level: 'fatal',
      target: 'doc.deck_structure',
      message: `StructQA-00: deckStructure "${deckStructureId}" は未登録です (登録済: ${deckStructures.listDeckStructures().join(', ')})`,
      suggestion: suggestionFor('StructQA-00'),
      path: ['doc', 'deck_structure'],
    };
    return {
      skipped: false,
      ok: false,
      deckStructureId,
      templateId: deckStructureId,
      issues: [issue],
      summary: { fatal: 1, warn: 0, total: 1 },
      legacyFields,
    };
  }

  // ───── (3) Zod safeParse ─────
  const result = deckStructure.schema.safeParse(normalized);
  let zodIssues = [];
  if (!result.success) {
    zodIssues = (result.error.issues || []).map(zi => translateToStructQA(zi, deckStructure));
  }

  // Zod safeParse の合否に関わらず実行 (qa_driven=true の時のみ中身が走る)。
  const qaResult = validateQADrivenMode(normalized, deckStructure);
  const qaIssues = qaResult.issues;

  // ───── (3.6) v10.5.0: テンプレ多様性検査 (StructQA-70/71/72) ─────
  // learning-deck のみ走る。doc.diversity_check: false で opt-out 可。
  const diversityResult = validateTemplateDiversity(normalized, deckStructure);
  const diversityIssues = diversityResult.issues;

  // ───── (4) 統合 ─────
  const issues = [...zodIssues, ...qaIssues, ...diversityIssues];

  // ───── (5) 集計 ─────
  const summary = {
    fatal: issues.filter(i => i.level === 'fatal').length,
    warn:  issues.filter(i => i.level === 'warn').length,
    total: issues.length,
  };

  return {
    skipped: false,
    ok: summary.fatal === 0,
    deckStructureId,
    templateId: deckStructureId,
    issues,
    summary,
    legacyFields,
    qaDrivenEnabled: qaResult.enabled,
  };
}

// ───────────────────────────────────────────────────────
// 集計をカテゴリ別に分けるユーティリティ (CLI / plan.html 表示用)
// ───────────────────────────────────────────────────────

/**
 * issues をカテゴリ別に分類する。
 * @param {Array} issues
 * @returns {object} { meta: [...], header: [...], footer: [...], ... }
 */
function groupIssuesByCategory(issues) {
  const out = {};
  for (const cat of Object.keys(RULE_CATEGORIES)) out[cat] = [];
  out.other = [];
  for (const issue of issues) {
    let placed = false;
    for (const [cat, rules] of Object.entries(RULE_CATEGORIES)) {
      if (rules.includes(issue.rule)) {
        out[cat].push(issue);
        placed = true;
        break;
      }
    }
    if (!placed) out.other.push(issue);
  }
  return out;
}

/**
 * 検査結果を人間可読の文字列に整形する (CLI 表示用)。
 */
function formatValidationReport(result) {
  if (result.skipped) {
    return [
      '[StructureQA] ⚠ doc.deck_structure が未指定のため StructureQA をスキップしました。',
      '              では doc.deck_structure の明示を推奨します。',
    ].join('\n');
  }
  if (result.ok) {
    // deckStructure ごとに適用ルール数が異なる (learning-deck=11 / news-summary=10) ため、
    // 数を固定せず汎用的に表示する。
    return `[StructureQA] ✓ deckStructure "${result.deckStructureId}" 全ルール pass`;
  }

  const lines = [];
  lines.push(`[StructureQA] 🚨 deckStructure "${result.deckStructureId}" 検査 fatal: ${result.summary.fatal} 件 / warn: ${result.summary.warn} 件`);
  const grouped = groupIssuesByCategory(result.issues);
  for (const [cat, items] of Object.entries(grouped)) {
    if (items.length === 0) continue;
    lines.push(`  [${cat}]`);
    for (const it of items) {
      const lvl = it.level === 'fatal' ? '✗' : '⚠';
      lines.push(`    ${lvl} ${it.rule} @ ${it.target}`);
      lines.push(`        ${it.message}`);
      lines.push(`        💡 ${it.suggestion}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  validateDeckStructure,
  translateToStructQA,
  groupIssuesByCategory,
  formatValidationReport,
  aliasLegacyDeckStructureField,
  RULE_CATEGORIES,
  RULE_DEFAULT_LEVEL,
  RULE_SUGGESTIONS,
  SUGGESTIONS_BY_DECK_STRUCTURE,
  // 旧称 alias
  SUGGESTIONS_BY_TEMPLATE,
  resolveQADrivenFlag,
  validateQADrivenMode,
  SUGGESTIONS_QA_DRIVEN,
  // 再 export (build-deck.js から流用しやすく)
  getAllSlides,
  countGlossaryTerms,
};
