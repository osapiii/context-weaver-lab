/** Firestore / ADK オブジェクトを JSON 表示用に正規化する */
export const sanitizeValueForJsonDisplay = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValueForJsonDisplay(item));
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.toDate === "function" &&
    typeof record.seconds === "number"
  ) {
    try {
      return (record.toDate as () => Date)().toISOString();
    } catch {
      /* fall through */
    }
  }

  if (
    typeof record.seconds === "number" &&
    typeof record.nanoseconds === "number"
  ) {
    return new Date(
      record.seconds * 1000 + record.nanoseconds / 1_000_000
    ).toISOString();
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    out[key] = sanitizeValueForJsonDisplay(nested);
  }
  return out;
};

export const formatJsonForDebugDisplay = (value: unknown): string => {
  try {
    return JSON.stringify(sanitizeValueForJsonDisplay(value), null, 2);
  } catch {
    return String(value);
  }
};
