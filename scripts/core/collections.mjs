export function hasValues(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Set || value instanceof Map) return value.size > 0;
  if (typeof value !== "string" && typeof value[Symbol.iterator] === "function") {
    return Array.from(value).length > 0;
  }
  return false;
}

export function firstNonEmptyCollection(...collections) {
  return collections.find(hasValues) ?? null;
}
