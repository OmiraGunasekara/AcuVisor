const BASE = "http://127.0.0.1:8000";

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function postForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return await res.json();
}

export const api = {
  health: async () => {
    const res = await fetch(`${BASE}/health`);
    return await res.json();
  },
  // adjust these paths if your routers differ
  recommendPanels: (payload) => postJson("/recommend-panels", payload),
  generateAudio: (payload) => postJson("/generate-audio", payload),
  suggestMaterial: (formData) => postForm("/suggest-material", formData),
};
