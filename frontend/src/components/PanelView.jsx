import React from "react";

function wallLabel(w) {
  return w?.toUpperCase?.() ?? "";
}

// panels: [{wall,x1,x2,z1,z2}] coords are normalized 0..1
export default function PanelView({ panels = [], title = "Panel Layout" }) {
  const walls = ["north", "east", "south", "west"];
  const byWall = {};
  for (const w of walls) byWall[w] = [];
  for (const p of panels) {
    if (byWall[p.wall]) byWall[p.wall].push(p);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>

      {/* 2D top-down: show walls as strips + panels on each wall strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {walls.map((w) => (
          <div
            key={w}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 10,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {wallLabel(w)} wall
            </div>

            {/* Wall canvas area (simple div grid) */}
            <div
              style={{
                position: "relative",
                height: 160,
                background: "#f6f7f9",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #eee",
              }}
            >
              {/* pseudo 3D shadow layer */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "translate(6px, 6px)",
                  opacity: 0.25,
                  pointerEvents: "none",
                }}
              >
                {byWall[w].map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      left: `${p.x1 * 100}%`,
                      width: `${(p.x2 - p.x1) * 100}%`,
                      top: `${(1 - p.z2) * 100}%`,
                      height: `${(p.z2 - p.z1) * 100}%`,
                      background: "#000",
                      borderRadius: 6,
                    }}
                  />
                ))}
              </div>

              {/* main panel layer */}
              {byWall[w].map((p, idx) => (
                <div
                  key={idx}
                  title={`${w}: x(${p.x1.toFixed(2)}-${p.x2.toFixed(
                    2
                  )}), z(${p.z1.toFixed(2)}-${p.z2.toFixed(2)})`}
                  style={{
                    position: "absolute",
                    left: `${p.x1 * 100}%`,
                    width: `${(p.x2 - p.x1) * 100}%`,
                    top: `${(1 - p.z2) * 100}%`,
                    height: `${(p.z2 - p.z1) * 100}%`,
                    background: "#2f6fed",
                    border: "2px solid rgba(255,255,255,0.9)",
                    borderRadius: 8,
                    boxSizing: "border-box",
                  }}
                />
              ))}

              {/* hint text */}
              {byWall[w].length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "#888",
                    fontSize: 13,
                  }}
                >
                  No panels on this wall
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
