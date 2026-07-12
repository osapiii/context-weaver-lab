/** チャット履歴など向けの簡易相対時刻表示 */
export const formatRelativeTime = (params: { timestampMs: number }): string => {
  const { timestampMs } = params;
  const diff = Date.now() - timestampMs;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min} 分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 日前`;
  return new Date(timestampMs).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
};
