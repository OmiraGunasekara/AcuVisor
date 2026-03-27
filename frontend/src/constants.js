export const MATERIALS = {
  painted_plaster: { label: "Painted plaster", a: 0.07 },
  gypsum: { label: "Gypsum board", a: 0.1 },
  concrete: { label: "Concrete", a: 0.03 },
  wood: { label: "Wood", a: 0.2 },
  carpet: { label: "Carpet", a: 0.45 },
  tile: { label: "Tile", a: 0.05 },
  brick: { label: "Brick", a: 0.04 },
  glass: { label: "Glass", a: 0.02 },
  curtain: { label: "Curtain", a: 0.35 },
};

export const FLOW_STEPS = [
  { id: 1, label: "Room Setup", hint: "Dimensions and photo" },
  { id: 2, label: "Materials", hint: "Surface detection" },
  { id: 3, label: "Layout", hint: "Source, listener, exclusions" },
  { id: 4, label: "Results", hint: "Panels and audio preview" },
];
