/** Remove `undefined` values so Firestore setDoc/updateDoc do not reject payloads. */
export const omitFirestoreUndefined = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => omitFirestoreUndefined(entry))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) {
        continue;
      }
      const cleaned = omitFirestoreUndefined(entry);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    return out;
  }
  return value;
};
