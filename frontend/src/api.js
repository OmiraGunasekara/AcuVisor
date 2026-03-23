const BASE = "http://127.0.0.1:8000";

async function handleJsonResponse(res, path) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleJsonResponse(res, path);
}

async function postForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: formData,
  });
  return handleJsonResponse(res, path);
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  return handleJsonResponse(res, path);
}

export const api = {
  health: () => getJson("/health"),
  segmentSurfaces: (formData) => postForm("/segment-surfaces", formData),
  suggestMaterial: (formData) => postForm("/suggest-material", formData),
  suggestMaterialFromBbox: (formData) => postForm("/suggest-material-from-bbox", formData),
  recommendPanels: (payload) => postJson("/recommend-panels", payload),
  predictRt60: (payload) => postJson("/predict-rt60", payload),
  generateAudio: (payload) => postJson("/generate-audio", payload),
  generateAudioUpload: (formData) => postForm("/generate-audio-upload", formData),
};
