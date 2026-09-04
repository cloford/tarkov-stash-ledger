export function parseStoredRecord(value) {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}
