/**
 * ADK session.state の merge ユーティリティ (feature store 共通).
 *
 * kinmodb 準拠: ワンストップ (run + poll) / 対話 (SSE) いずれも
 * `stateDelta` または GET session の state を同じ形でマージする.
 */

export type AdkUseCase = "dialogue" | "oneStop";

export const mergeAgentState = (params: {
  base: Record<string, unknown>;
  patch: Record<string, unknown> | null | undefined;
}): Record<string, unknown> => {
  const { base, patch } = params;
  if (!patch || typeof patch !== "object") return { ...base };
  return { ...base, ...patch };
};

export const applyStateDelta = (params: {
  base: Record<string, unknown>;
  stateDelta: unknown;
}): Record<string, unknown> => {
  const { base, stateDelta } = params;
  if (!stateDelta || typeof stateDelta !== "object") return { ...base };
  return mergeAgentState({
    base,
    patch: stateDelta as Record<string, unknown>,
  });
};

/** gcsPath 等で重複除外しながら配列にマージ */
export const mergeArtifactsByKey = <T extends { gcsPath?: string }>(params: {
  existing: T[];
  incoming: T[];
  keyOf?: (item: T) => string;
}): T[] => {
  const {
    existing,
    incoming,
    keyOf = (item) => item.gcsPath ?? "",
  } = params;
  const seen = new Set(existing.map(keyOf).filter(Boolean));
  const merged = [...existing];
  for (const item of incoming) {
    const key = keyOf(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(item);
  }
  return merged;
};
