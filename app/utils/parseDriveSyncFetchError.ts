type DriveApiErrorPayload = {
  status?: string;
  error?: { message?: string } | string;
};

type FetchLikeError = {
  message?: string;
  status?: number;
  statusCode?: number;
  data?: DriveApiErrorPayload;
};

const TRANSIENT_PATTERN =
  /SSL|Broken pipe|UNEXPECTED_EOF|接続が一時的|503|502|500 Internal/i;

/**
 * drive-to-gcs-sync / ofetch のエラーをユーザー向け文言に変換する。
 */
export function humanizeDriveSyncApiMessage(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return "未取り込みファイルの確認に失敗しました";
  }
  if (TRANSIENT_PATTERN.test(text)) {
    return "Google Drive への接続が一時的に失敗しました。しばらく待って「再検索」を押してください。";
  }
  if (/File not found|404|notFound/i.test(text)) {
    return "指定された Drive フォルダが見つかりません。設定のフォルダ ID を確認してください。";
  }
  if (/403|access|アクセス権|Permission/i.test(text)) {
    return "Drive フォルダへのアクセス権がありません。Service Account に共有されているか確認してください。";
  }
  if (text.startsWith("Drive list failed:")) {
    return humanizeDriveSyncApiMessage(text.slice("Drive list failed:".length));
  }
  if (/^\[POST\]/i.test(text)) {
    return "Drive 一覧 API の呼び出しに失敗しました。しばらく待って「再検索」を押してください。";
  }
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

export function extractDriveSyncFetchErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const err = error as FetchLikeError;
  const data = err.data;
  if (data?.error) {
    if (typeof data.error === "string") {
      return humanizeDriveSyncApiMessage(data.error);
    }
    if (data.error.message) {
      return humanizeDriveSyncApiMessage(data.error.message);
    }
  }
  if (typeof err.message === "string" && err.message.trim()) {
    return humanizeDriveSyncApiMessage(err.message);
  }
  return null;
}

export function isRetryableDriveScanError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as FetchLikeError;
  const status = err.status ?? err.statusCode;
  if (status === 503 || status === 502 || status === 500) return true;
  const msg = extractDriveSyncFetchErrorMessage(error) ?? err.message ?? "";
  return TRANSIENT_PATTERN.test(msg);
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
