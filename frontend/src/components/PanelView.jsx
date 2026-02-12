// import React from "react";

// function wallLabel(w) {
//   return w?.toUpperCase?.() ?? "";
// }

// // panels: [{wall,x1,x2,z1,z2}] coords are normalized 0..1
// export default function PanelView({ panels = [], title = "Panel Layout" }) {
//   const walls = ["north", "east", "south", "west"];
//   const byWall = {};
//   for (const w of walls) byWall[w] = [];
//   for (const p of panels) {
//     if (byWall[p.wall]) byWall[p.wall].push(p);
//   }

//   return (
//     <div style={{ display: "grid", gap: 12 }}>
//       <div style={{ fontWeight: 700 }}>{title}</div>

//       {/* 2D top-down: show walls as strips + panels on each wall strip */}
//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//           gap: 12,
//         }}
//       >
//         {walls.map((w) => (
//           <div
//             key={w}
//             style={{
//               border: "1px solid #ddd",
//               borderRadius: 10,
//               padding: 10,
//               background: "#fff",
//             }}
//           >
//             <div style={{ fontWeight: 600, marginBottom: 8 }}>
//               {wallLabel(w)} wall
//             </div>

//             {/* Wall canvas area (simple div grid) */}
//             <div
//               style={{
//                 position: "relative",
//                 height: 160,
//                 background: "#f6f7f9",
//                 borderRadius: 8,
//                 overflow: "hidden",
//                 border: "1px solid #eee",
//               }}
//             >
//               {/* pseudo 3D shadow layer */}
//               <div
//                 style={{
//                   position: "absolute",
//                   inset: 0,
//                   transform: "translate(6px, 6px)",
//                   opacity: 0.25,
//                   pointerEvents: "none",
//                 }}
//               >
//                 {byWall[w].map((p, idx) => (
//                   <div
//                     key={idx}
//                     style={{
//                       position: "absolute",
//                       left: `${p.x1 * 100}%`,
//                       width: `${(p.x2 - p.x1) * 100}%`,
//                       top: `${(1 - p.z2) * 100}%`,
//                       height: `${(p.z2 - p.z1) * 100}%`,
//                       background: "#000",
//                       borderRadius: 6,
//                     }}
//                   />
//                 ))}
//               </div>

//               {/* main panel layer */}
//               {byWall[w].map((p, idx) => (
//                 <div
//                   key={idx}
//                   title={`${w}: x(${p.x1.toFixed(2)}-${p.x2.toFixed(
//                     2
//                   )}), z(${p.z1.toFixed(2)}-${p.z2.toFixed(2)})`}
//                   style={{
//                     position: "absolute",
//                     left: `${p.x1 * 100}%`,
//                     width: `${(p.x2 - p.x1) * 100}%`,
//                     top: `${(1 - p.z2) * 100}%`,
//                     height: `${(p.z2 - p.z1) * 100}%`,
//                     background: "#2f6fed",
//                     border: "2px solid rgba(255,255,255,0.9)",
//                     borderRadius: 8,
//                     boxSizing: "border-box",
//                   }}
//                 />
//               ))}

//               {/* hint text */}
//               {byWall[w].length === 0 && (
//                 <div
//                   style={{
//                     position: "absolute",
//                     inset: 0,
//                     display: "grid",
//                     placeItems: "center",
//                     color: "#888",
//                     fontSize: 13,
//                   }}
//                 >
//                   No panels on this wall
//                 </div>
//               )}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// components/PanelView.jsx - IMPROVED VERSION
import React, { useState } from "react";
import { Ruler, Info } from "lucide-react";

function wallLabel(w) {
  return w?.toUpperCase?.() ?? "";
}

// Format dimensions nicely
function formatDim(m) {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  return `${m.toFixed(2)} m`;
}

export default function PanelView({ panels = [], title = "Panel Layout" }) {
  const [selectedPanel, setSelectedPanel] = useState(null);
  
  const walls = ["north", "east", "south", "west"];
  const byWall = {};
  for (const w of walls) byWall[w] = [];
  for (const p of panels) {
    if (byWall[p.wall]) byWall[p.wall].push(p);
  }

  const totalPanels = panels.length;
  const totalArea = panels.reduce((sum, p) => sum + (p.width_m * p.height_m), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header with stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
          <span><strong>{totalPanels}</strong> panels</span>
          <span><strong>{totalArea.toFixed(2)} m²</strong> total</span>
        </div>
      </div>

      {/* Panel details if one is selected */}
      {selectedPanel && (
        <div style={{
          padding: 12,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 8,
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#1e40af" }}>
            Selected Panel Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
            <span style={{ color: "#64748b" }}>Wall:</span>
            <span style={{ fontWeight: 600 }}>{wallLabel(selectedPanel.wall)}</span>
            
            <span style={{ color: "#64748b" }}>Width:</span>
            <span style={{ fontWeight: 600 }}>{formatDim(selectedPanel.width_m)}</span>
            
            <span style={{ color: "#64748b" }}>Height:</span>
            <span style={{ fontWeight: 600 }}>{formatDim(selectedPanel.height_m)}</span>
            
            <span style={{ color: "#64748b" }}>Area:</span>
            <span style={{ fontWeight: 600 }}>
              {(selectedPanel.width_m * selectedPanel.height_m).toFixed(3)} m²
            </span>
            
            <span style={{ color: "#64748b" }}>Position:</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>
              x: {selectedPanel.x1_m.toFixed(2)}-{selectedPanel.x2_m.toFixed(2)}m, 
              z: {selectedPanel.z1_m.toFixed(2)}-{selectedPanel.z2_m.toFixed(2)}m
            </span>
          </div>
          <button
            onClick={() => setSelectedPanel(null)}
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#2563eb",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* 2D wall views */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {walls.map((w) => {
          const wallPanels = byWall[w];
          
          return (
            <div
              key={w}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 12,
                background: "#ffffff",
              }}
            >
              {/* Wall header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {wallLabel(w)} Wall
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {wallPanels.length} panel{wallPanels.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Wall canvas */}
              <div
                style={{
                  position: "relative",
                  height: 180,
                  background: "#f8fafc",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                }}
              >
                {/* Shadow layer (pseudo-3D effect) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: "translate(4px, 4px)",
                    opacity: 0.15,
                    pointerEvents: "none",
                  }}
                >
                  {wallPanels.map((p, idx) => (
                    <div
                      key={`shadow-${idx}`}
                      style={{
                        position: "absolute",
                        left: `${p.x1 * 100}%`,
                        width: `${(p.x2 - p.x1) * 100}%`,
                        top: `${(1 - p.z2) * 100}%`,
                        height: `${(p.z2 - p.z1) * 100}%`,
                        background: "#000000",
                        borderRadius: 6,
                      }}
                    />
                  ))}
                </div>

                {/* Main panel layer */}
                {wallPanels.map((p, idx) => {
                  const isSelected = selectedPanel === p;
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedPanel(p)}
                      title={`${formatDim(p.width_m)} × ${formatDim(p.height_m)} panel\nClick for details`}
                      style={{
                        position: "absolute",
                        left: `${p.x1 * 100}%`,
                        width: `${(p.x2 - p.x1) * 100}%`,
                        top: `${(1 - p.z2) * 100}%`,
                        height: `${(p.z2 - p.z1) * 100}%`,
                        background: isSelected ? "#3b82f6" : "#2563eb",
                        border: isSelected ? "3px solid #1e40af" : "2px solid rgba(255,255,255,0.8)",
                        borderRadius: 8,
                        boxSizing: "border-box",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "white",
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = "scale(1.05)";
                          e.currentTarget.style.zIndex = "10";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.zIndex = "1";
                      }}
                    >
                      {/* Show dimensions on hover/select */}
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        opacity: isSelected ? 1 : 0.9,
                      }}>
                        <Ruler style={{ width: 12, height: 12 }} />
                        <span>{formatDim(p.width_m)}</span>
                        <span>×</span>
                        <span>{formatDim(p.height_m)}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Empty state */}
                {wallPanels.length === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: 12,
                    }}
                  >
                    No panels on this wall
                  </div>
                )}
              </div>

              {/* Panel list for this wall */}
              {wallPanels.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                  {wallPanels.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "4px 6px",
                        background: selectedPanel === p ? "#eff6ff" : "transparent",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedPanel(p)}
                    >
                      Panel {idx + 1}: {formatDim(p.width_m)} × {formatDim(p.height_m)} 
                      ({(p.width_m * p.height_m).toFixed(2)} m²)
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div style={{
        padding: 12,
        background: "#f0f9ff",
        borderRadius: 8,
        border: "1px solid #bae6fd",
        display: "flex",
        gap: 12,
        fontSize: 13,
      }}>
        <Info style={{ width: 18, height: 18, color: "#0284c7", flexShrink: 0, marginTop: 2 }} />
        <div style={{ color: "#0c4a6e" }}>
          <strong>Panel placement optimized using genetic algorithm.</strong> Coordinates shown are 
          normalized (0-1 range) for wall mapping. Physical dimensions provided in meters. 
          Click any panel to see detailed specifications.
        </div>
      </div>
    </div>
  );
}
