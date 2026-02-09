import React, { useMemo, useRef, useState } from "react";
import { api } from "./api";
import PanelView from "./components/PanelView";

const MATERIALS = {
  painted_plaster: { label: "Painted plaster", a: 0.07 },
  gypsum: { label: "Gypsum board", a: 0.10 },
  concrete: { label: "Concrete", a: 0.03 },
  wood: { label: "Wood", a: 0.20 },
  carpet: { label: "Carpet", a: 0.45 },
};

const BASE = "http://127.0.0.1:8000";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function fmt(x, d = 3) {
  return typeof x === "number" && isFinite(x) ? x.toFixed(d) : "-";
}

export default function App() {
  // ---------- inputs ----------
  const [L, setL] = useState(5.2);
  const [W, setW] = useState(4.1);
  const [H, setH] = useState(2.8);

  // ---------- image upload ----------
  const [imageFile, setImageFile] = useState(null);
  const [imageURL, setImageURL] = useState("");
  const imgRef = useRef(null);
  const overlayRef = useRef(null);

  // ---------- rectangle selection mode ----------
  // mode: "wall" | "floor" | "ceiling" | "exclude" | null
  const [mode, setMode] = useState(null);
  const [drag, setDrag] = useState(null); // {x0,y0,x1,y1} in normalized coords

  // samples: {wall:{x1,y1,x2,y2}, floor:..., ceiling:...}
  const [samples, setSamples] = useState({
    wall: null,
    floor: null,
    ceiling: null,
  });

  const [exclusions, setExclusions] = useState([]); // array of rects

  // ---------- material suggestion + override ----------
  const [suggestions, setSuggestions] = useState({
    wall: null,
    floor: null,
    ceiling: null,
  });

  const [override, setOverride] = useState({
    wall: "painted_plaster",
    floor: "wood",
    ceiling: "painted_plaster",
  });

  const wall_a = useMemo(() => MATERIALS[override.wall].a, [override.wall]);
  const floor_a = useMemo(() => MATERIALS[override.floor].a, [override.floor]);
  const ceil_a = useMemo(() => MATERIALS[override.ceiling].a, [override.ceiling]);

  // ---------- outputs ----------
  const [recommendation, setRecommendation] = useState(null);
  const [audio, setAudio] = useState(null);

  // ---------- UI state ----------
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState({ suggest: false, rec: false, audio: false });

  // ---------- handlers ----------
  const onPickImage = (file) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageURL(url);
    setSamples({ wall: null, floor: null, ceiling: null });
    setExclusions([]);
    setSuggestions({ wall: null, floor: null, ceiling: null });
    setRecommendation(null);
    setAudio(null);
  };

  const getNormPos = (evt) => {
    const box = overlayRef.current.getBoundingClientRect();
    const x = clamp01((evt.clientX - box.left) / box.width);
    const y = clamp01((evt.clientY - box.top) / box.height);
    return { x, y };
  };

  const onMouseDown = (evt) => {
    if (!mode) return;
    if (!imageURL) return;
    const { x, y } = getNormPos(evt);
    setDrag({ x0: x, y0: y, x1: x, y1: y });
  };

  const onMouseMove = (evt) => {
    if (!drag) return;
    const { x, y } = getNormPos(evt);
    setDrag((d) => ({ ...d, x1: x, y1: y }));
  };

  const finalizeRect = (r) => {
    const x1 = Math.min(r.x0, r.x1);
    const x2 = Math.max(r.x0, r.x1);
    const y1 = Math.min(r.y0, r.y1);
    const y2 = Math.max(r.y0, r.y1);

    // ignore tiny boxes
    if ((x2 - x1) < 0.03 || (y2 - y1) < 0.03) return null;

    return { x1, y1, x2, y2 };
  };

  const onMouseUp = () => {
    if (!drag) return;
    const rect = finalizeRect(drag);
    setDrag(null);
    if (!rect) return;

    if (mode === "exclude") {
      setExclusions((xs) => [...xs, rect]);
    } else {
      setSamples((s) => ({ ...s, [mode]: rect }));
    }
  };

  const clearAll = () => {
    setSamples({ wall: null, floor: null, ceiling: null });
    setExclusions([]);
    setSuggestions({ wall: null, floor: null, ceiling: null });
    setRecommendation(null);
    setAudio(null);
    setErr("");
  };

  const callSuggestOne = async (surface) => {
    if (!imageFile) throw new Error("Upload an image first.");
    const rect = samples[surface];
    if (!rect) throw new Error(`Draw a ${surface} sample rectangle first.`);

    // use center of rectangle as click x,y
    const cx = (rect.x1 + rect.x2) / 2;
    const cy = (rect.y1 + rect.y2) / 2;
    const boxSize = Math.round(Math.max((rect.x2 - rect.x1), (rect.y2 - rect.y1)) * 600);
    const box_size = Math.max(96, Math.min(512, boxSize));

    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("surface", surface);         // wall/floor/ceiling
    fd.append("x", String(cx));            // normalized 0..1
    fd.append("y", String(cy));            // normalized 0..1
    fd.append("box_size", String(box_size));

    const res = await api.suggestMaterial(fd);
    return res; // expected {surface, predicted_label, confidence?, absorption? ...}
  };

  const onSuggestMaterials = async () => {
    setErr("");
    setBusy((b) => ({ ...b, suggest: true }));
    try {
      const wallRes = await callSuggestOne("wall");
      const floorRes = await callSuggestOne("floor");
      const ceilRes = await callSuggestOne("ceiling");

      setSuggestions({
        wall: wallRes,
        floor: floorRes,
        ceiling: ceilRes,
      });

      // If backend returns a label that matches our keys, auto-select it:
      const tryMap = (res, fallback) => {
        const lbl = res?.predicted_label;
        if (lbl && MATERIALS[lbl]) return lbl;
        return fallback;
      };

      setOverride((o) => ({
        wall: tryMap(wallRes, o.wall),
        floor: tryMap(floorRes, o.floor),
        ceiling: tryMap(ceilRes, o.ceiling),
      }));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy((b) => ({ ...b, suggest: false }));
    }
  };

  const onRecommendPanels = async () => {
    setErr("");
    setAudio(null);
    setBusy((b) => ({ ...b, rec: true }));
    try {
      const payload = {
        L: Number(L), W: Number(W), H: Number(H),
        wall_a: Number(wall_a),
        floor_a: Number(floor_a),
        ceil_a: Number(ceil_a),
        exclusions: exclusions, // normalized rects (we’ll use later in GA)
      };
      const res = await api.recommendPanels(payload);
      setRecommendation(res);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy((b) => ({ ...b, rec: false }));
    }
  };

  const onGenerateAudio = async () => {
    setErr("");
    setBusy((b) => ({ ...b, audio: true }));
    try {
      if (!recommendation?.panels) throw new Error("Generate panels first.");
      const payload = {
        L: Number(L), W: Number(W), H: Number(H),
        wall_a: Number(wall_a),
        floor_a: Number(floor_a),
        ceil_a: Number(ceil_a),
        panels: recommendation.panels,
      };
      const res = await api.generateAudio(payload);
      setAudio(res);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy((b) => ({ ...b, audio: false }));
    }
  };

  const canSuggest = !!imageFile && samples.wall && samples.floor && samples.ceiling;
  const canRecommend = !!suggestions.wall || (!imageFile && true); // allow manual without CV
  const canAudio = !!recommendation;

  // ---------- render helpers ----------
  const RectOverlay = ({ rect, color, label }) => {
    if (!rect) return null;
    const left = rect.x1 * 100;
    const top = rect.y1 * 100;
    const w = (rect.x2 - rect.x1) * 100;
    const h = (rect.y2 - rect.y1) * 100;
    return (
      <div
        style={{
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          width: `${w}%`,
          height: `${h}%`,
          border: `2px solid ${color}`,
          borderRadius: 8,
          boxSizing: "border-box",
          background: "rgba(0,0,0,0.05)",
        }}
      >
        <div style={{
          position: "absolute",
          left: 6,
          top: 6,
          padding: "2px 6px",
          borderRadius: 999,
          fontSize: 12,
          background: color,
          color: "#fff",
          fontWeight: 700,
        }}>
          {label}
        </div>
      </div>
    );
  };

  const DragOverlay = () => {
    if (!drag) return null;
    const rect = finalizeRect(drag);
    if (!rect) return null;
    return <RectOverlay rect={rect} color="#ffffff" label="Drawing" />;
  };

  // ---------- UI ----------
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(1000px 600px at 20% 10%, rgba(47,111,237,0.25), transparent), #0b0c10",
      color: "#eaeaea",
      padding: 24,
      boxSizing: "border-box",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>AcuVisor MVP</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Flow: Upload → Sample materials → (Optional exclusions) → Recommend panels → Generate audio
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
            Backend: <code style={{ color: "#fff" }}>{BASE}</code>
          </div>
        </header>

        {err && (
          <div style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            background: "rgba(255,80,80,0.15)",
            border: "1px solid rgba(255,80,80,0.35)",
            color: "#ffd9d9",
          }}>
            {err}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16, marginTop: 16 }}>
          {/* LEFT PANEL */}
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Step 1 — Inputs</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label>
                <div style={{ fontSize: 12, opacity: 0.8 }}>L (m)</div>
                <input value={L} onChange={(e) => setL(e.target.value)} style={inputStyle} />
              </label>
              <label>
                <div style={{ fontSize: 12, opacity: 0.8 }}>W (m)</div>
                <input value={W} onChange={(e) => setW(e.target.value)} style={inputStyle} />
              </label>
              <label>
                <div style={{ fontSize: 12, opacity: 0.8 }}>H (m)</div>
                <input value={H} onChange={(e) => setH(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Step 2 — Upload room photo</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && onPickImage(e.target.files[0])}
              />
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                Upload 1 photo for MVP. Later you can support multiple photos.
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Step 3 — Select material samples</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={btn(mode === "wall")} disabled={!imageURL} onClick={() => setMode("wall")}>Draw WALL sample</button>
                  <button style={btn(mode === "floor")} disabled={!imageURL} onClick={() => setMode("floor")}>Draw FLOOR sample</button>
                  <button style={btn(mode === "ceiling")} disabled={!imageURL} onClick={() => setMode("ceiling")}>Draw CEILING sample</button>
                </div>

                <button style={btnPrimary} disabled={!canSuggest || busy.suggest} onClick={onSuggestMaterials}>
                  {busy.suggest ? "Suggesting materials..." : "Suggest materials (CV) → confirm/override"}
                </button>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Tip: click a draw button, then drag a rectangle on the image.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Materials (override allowed)</div>
              <div style={{ display: "grid", gap: 10 }}>
                <MaterialRow label="Wall" value={override.wall} setValue={(v) => setOverride((o) => ({ ...o, wall: v }))} />
                <MaterialRow label="Floor" value={override.floor} setValue={(v) => setOverride((o) => ({ ...o, floor: v }))} />
                <MaterialRow label="Ceiling" value={override.ceiling} setValue={(v) => setOverride((o) => ({ ...o, ceiling: v }))} />
              </div>

              <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13 }}>
                Absorption used in MVP: wall_a <b>{wall_a}</b> • floor_a <b>{floor_a}</b> • ceil_a <b>{ceil_a}</b>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Optional — Exclusion zones</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={btn(mode === "exclude")} disabled={!imageURL} onClick={() => setMode("exclude")}>Draw EXCLUSION</button>
                <button style={btn(false)} disabled={exclusions.length === 0} onClick={() => setExclusions([])}>Clear exclusions</button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                You can skip this in MVP if you want. It’s optional.
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <button style={btnPrimary} disabled={!canRecommend || busy.rec} onClick={onRecommendPanels}>
                {busy.rec ? "Running GA + MLP..." : "Recommend panels (GA + MLP)"}
              </button>

              <button style={btnPrimary} disabled={!canAudio || busy.audio} onClick={onGenerateAudio}>
                {busy.audio ? "Generating audio..." : "Generate audio (clap + speech)"}
              </button>

              <button style={btn(false)} onClick={clearAll}>
                Reset session
              </button>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Image + overlays */}
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 800 }}>Room photo</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Mode: {mode || "none"}</div>
              </div>

              {!imageURL ? (
                <div style={{ marginTop: 12, padding: 18, borderRadius: 16, border: "1px dashed rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)" }}>
                  Upload a room image to start selecting samples.
                </div>
              ) : (
                <div style={{ marginTop: 12, position: "relative" }}>
                  <img ref={imgRef} src={imageURL} alt="room" style={{ width: "100%", borderRadius: 16, display: "block" }} />
                  <div
                    ref={overlayRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 16,
                      cursor: mode ? "crosshair" : "default",
                    }}
                  >
                    <RectOverlay rect={samples.wall} color="#2f6fed" label="WALL" />
                    <RectOverlay rect={samples.floor} color="#2fbf71" label="FLOOR" />
                    <RectOverlay rect={samples.ceiling} color="#f2b84b" label="CEILING" />
                    {exclusions.map((r, i) => (
                      <RectOverlay key={i} rect={r} color="#ff5a5a" label={`EXCL ${i+1}`} />
                    ))}
                    <DragOverlay />
                  </div>
                </div>
              )}
            </div>

            {/* Panels + audio */}
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Predictions</div>

              {!recommendation ? (
                <div style={{ opacity: 0.75 }}>Click “Recommend panels” to see placements.</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <Kpi label="Used coverage" value={fmt(recommendation.used_coverage)} />
                    {"rt60_before" in recommendation && <Kpi label="RT60 before (pred)" value={`${fmt(recommendation.rt60_before)} s`} />}
                    {"rt60_after" in recommendation && <Kpi label="RT60 after (pred)" value={`${fmt(recommendation.rt60_after)} s`} />}
                    {"rt60_delta" in recommendation && <Kpi label="ΔRT60 (pred)" value={`${fmt(recommendation.rt60_delta)} s`} />}
                  </div>

                  <PanelView panels={recommendation.panels || []} title="Recommended panels (2D + pseudo-3D)" />
                </>
              )}

              {audio && (
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>Audio (Auralisation)</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Kpi label="RT60 before (audio)" value={`${fmt(audio.rt60_before)} s`} />
                    <Kpi label="RT60 after (audio)" value={`${fmt(audio.rt60_after)} s`} />
                    <Kpi label="ΔRT60 (audio)" value={`${fmt(audio.rt60_delta)} s`} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <AudioCard title="Clap (Before)" url={`${BASE}${audio.clap_before_audio}`} />
                    <AudioCard title="Clap (After)" url={`${BASE}${audio.clap_after_audio}`} />
                    <AudioCard title="Speech (Before)" url={`${BASE}${audio.speech_before_audio}`} />
                    <AudioCard title="Speech (After)" url={`${BASE}${audio.speech_after_audio}`} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, opacity: 0.65, fontSize: 12 }}>
          MVP note: CV suggestions are sample-based (3 rectangles). Users can override materials before GA+MLP optimisation.
        </div>
      </div>
    </div>
  );
}

function MaterialRow({ label, value, setValue }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{label} material</div>
      <select value={value} onChange={(e) => setValue(e.target.value)} style={selectStyle}>
        {Object.entries(MATERIALS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label} (a={v.a})
          </option>
        ))}
      </select>
    </label>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={{
      padding: 10,
      borderRadius: 14,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      minWidth: 160,
    }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function AudioCard({ title, url }) {
  return (
    <div style={{ padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <audio controls src={url} style={{ width: "100%" }} />
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>{url}</div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "#fff",
  outline: "none",
};

const selectStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "#fff",
  outline: "none",
};

const btn = (active) => ({
  padding: "10px 12px",
  borderRadius: 12,
  border: active ? "1px solid rgba(47,111,237,0.8)" : "1px solid rgba(255,255,255,0.18)",
  background: active ? "rgba(47,111,237,0.25)" : "rgba(0,0,0,0.25)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
});

const btnPrimary = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.20)",
  background: "linear-gradient(135deg, rgba(47,111,237,0.9), rgba(47,111,237,0.55))",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};
