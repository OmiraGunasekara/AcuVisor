const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");

export function apiUrl(path = "") {
  if (!path) return BASE;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function handleJsonResponse(res, path) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function postJson(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleJsonResponse(res, path);
}

async function postForm(path, formData) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    body: formData,
  });
  return handleJsonResponse(res, path);
}

async function getJson(path) {
  const res = await fetch(apiUrl(path));
  return handleJsonResponse(res, path);
}

export const api = {
  health: () => getJson("/health"),
  segmentSurfaces: (formData) => postForm("/segment-surfaces", formData),
  suggestMaterial: (formData) => postForm("/suggest-material", formData),
  // Replaced by suggestMaterialsFromBboxes; kept commented for easy rollback.
  // suggestMaterialFromBbox: (formData) => postForm("/suggest-material-from-bbox", formData),
  suggestMaterialsFromBboxes: (formData) => postForm("/suggest-materials-from-bboxes", formData),
  recommendPanels: (payload) => postJson("/recommend-panels", payload),
  predictRt60: (payload) => postJson("/predict-rt60", payload),
  generateAudio: (payload) => postJson("/generate-audio", payload),
  generateAudioUpload: (formData) => postForm("/generate-audio-upload", formData),
};
