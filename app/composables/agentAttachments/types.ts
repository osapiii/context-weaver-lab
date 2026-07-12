/**
 * Agent 参考資料 添付 (ブリーフィング段階で渡す) の型.
 *
 * Firebase Storage にアップロードし、URL を session record / prompt に
 * 含める形で AI に渡す. 将来 BE 側で agent ごとに PDF テキスト抽出や
 * Vision でリファレンス画像化など fancy な扱いをするが、PR-1 では URL の
 * 単純な羅列までを最低限の動作とする.
 */

export interface AttachmentRef {
  /** ローカル発番の一意 ID. Storage path にも入る */
  id: string;
  /** ユーザー視点のファイル名 */
  name: string;
  /** ダウンロード可能な URL (getDownloadURL の戻り) */
  url: string;
  /** Storage のフルパス. 削除時に必要 */
  storagePath: string;
  /** gs://{bucket}/{storagePath} — RequestDoc / ADK invoke 用 */
  gcsPath?: string;
  /** バイト数 */
  size: number;
  /** MIME type (例: application/pdf, image/png) */
  mimeType: string;
  /** UnixMS */
  uploadedAt: number;
}

/** 受け入れる種別 (UI のアイコン分岐 + accept attribute 構築用) */
export const ATTACHMENT_KIND = {
  image: { accept: "image/*", icon: "material-symbols:image" },
  document: {
    accept:
      ".pdf,.txt,.md,.docx,.csv,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv",
    icon: "material-symbols:description",
  },
} as const;
