/** 取引先登録 Step1: URL / 法人番号 lookup */
export const BUSINESS_PARTNER_LOOKUP_LOADING_MESSAGES = [
  "公式サイトを解析しています...",
  "AIが会社情報を登録しています...",
  "もう少しで完了します...",
] as const;

/** AIマスタ登録: Draft 抽出 */
export const AI_MASTER_EXTRACT_LOADING_MESSAGES = [
  "参考データを解析しています...",
  "AIがマスタの下書きを生成しています...",
  "もう少しで完了します...",
] as const;
