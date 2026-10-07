// Nullable columns come back as null, but domain types model absence as undefined
// (t.Optional), and Elysia's response validation rejects null for optional fields.
export function withoutNulls<T extends object>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)) as T;
}
