export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function fmt(x, d = 3) {
  return typeof x === "number" && isFinite(x) ? x.toFixed(d) : "-";
}

export function normalizeLabel(raw) {
  return raw?.toLowerCase?.().replace(/\s+/g, "_").trim() ?? null;
}
