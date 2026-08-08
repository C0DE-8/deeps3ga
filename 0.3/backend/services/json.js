function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toJson(value) {
  return JSON.stringify(value == null ? null : value);
}

function keyFromName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || `entry-${Date.now()}`;
}

module.exports = {
  keyFromName,
  parseJson,
  toJson
};
