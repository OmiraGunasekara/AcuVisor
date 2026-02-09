# from fastapi import FastAPI
# from pydantic import BaseModel, Field
# import numpy as np
# import joblib
# from tensorflow.keras.models import load_model
# import os

# APP_DIR = os.path.dirname(os.path.abspath(__file__))
# ML_DIR = os.path.join(APP_DIR, "ml")

# MODEL_PATH = os.path.join(ML_DIR, "mlp_rt60_model.keras")
# SCALER_PATH = os.path.join(ML_DIR, "feature_scaler.pkl")

# app = FastAPI(title="AcuVisor Backend", version="0.1")

# # Load model + scaler once
# model = load_model(MODEL_PATH)
# scaler = joblib.load(SCALER_PATH)

# class PredictRequest(BaseModel):
#     L: float = Field(..., gt=0)
#     W: float = Field(..., gt=0)
#     H: float = Field(..., gt=0)

#     wall_a: float = Field(..., ge=0, le=1)
#     floor_a: float = Field(..., ge=0, le=1)
#     ceil_a: float = Field(..., ge=0, le=1)

#     panel_coverage: float = Field(..., ge=0, le=1)

# class PredictResponse(BaseModel):
#     rt60_before: float
#     rt60_after: float
#     rt60_delta: float

# class ExclusionRect(BaseModel):
#     wall: str = Field(..., description="north|south|east|west")
#     x1: float = Field(..., ge=0, le=1)
#     x2: float = Field(..., ge=0, le=1)
#     z1: float = Field(..., ge=0, le=1)
#     z2: float = Field(..., ge=0, le=1)

# class RecommendRequest(BaseModel):
#     L: float = Field(..., gt=0)
#     W: float = Field(..., gt=0)
#     H: float = Field(..., gt=0)

#     wall_a: float = Field(..., ge=0, le=1)
#     floor_a: float = Field(..., ge=0, le=1)
#     ceil_a: float = Field(..., ge=0, le=1)

#     target_coverage: float = Field(0.5, ge=0, le=1, description="Desired total wall coverage by panels")
#     exclusions: list[ExclusionRect] = Field(default_factory=list)

# class PanelRect(BaseModel):
#     wall: str
#     x1: float
#     x2: float
#     z1: float
#     z2: float

# class RecommendResponse(BaseModel):
#     used_coverage: float
#     panels: list[PanelRect]

# VALID_WALLS = {"north", "south", "east", "west"}

# def _rect_area(r):
#     return max(0.0, r["x2"] - r["x1"]) * max(0.0, r["z2"] - r["z1"])

# def _clamp01(v):
#     return float(max(0.0, min(1.0, v)))

# def _normalize_rect(wall, x1, x2, z1, z2):
#     x1, x2 = sorted([_clamp01(x1), _clamp01(x2)])
#     z1, z2 = sorted([_clamp01(z1), _clamp01(z2)])
#     return {"wall": wall, "x1": x1, "x2": x2, "z1": z1, "z2": z2}

# def _overlaps(a, b):
#     # axis-aligned rectangle overlap in (x,z)
#     return not (a["x2"] <= b["x1"] or a["x1"] >= b["x2"] or a["z2"] <= b["z1"] or a["z1"] >= b["z2"])

# def _apply_exclusions(candidate, exclusions):
#     # MVP: if it overlaps an exclusion on same wall, reject it
#     for ex in exclusions:
#         if ex["wall"] == candidate["wall"] and _overlaps(candidate, ex):
#             return False
#     return True


# @app.get("/health")
# def health():
#     return {"status": "ok"}

# def _predict_rt60(req: PredictRequest, coverage_override: float | None = None) -> float:
#     cov = req.panel_coverage if coverage_override is None else float(coverage_override)
#     x = np.array([[req.L, req.W, req.H, req.wall_a, req.floor_a, req.ceil_a, cov]], dtype=np.float32)
#     x_scaled = scaler.transform(x)
#     y = model.predict(x_scaled, verbose=0).flatten()[0]
#     return float(y)

# @app.post("/predict-rt60", response_model=PredictResponse)
# def predict_rt60(req: PredictRequest):
#     rt60_before = _predict_rt60(req, coverage_override=0.0)
#     rt60_after = _predict_rt60(req, coverage_override=req.panel_coverage)

#     return PredictResponse(
#         rt60_before=rt60_before,
#         rt60_after=rt60_after,
#         rt60_delta=rt60_before - rt60_after
#     )
# @app.post("/recommend-panels", response_model=RecommendResponse)
# def recommend_panels(req: RecommendRequest):
#     # Simple MVP heuristic:
#     # - Place a few medium rectangles on walls (north/east/west first)
#     # - Skip rectangles that overlap exclusion zones
#     # - Return what FE needs to draw

#     exclusions = [ex.model_dump() for ex in req.exclusions if ex.wall in VALID_WALLS]

#     # Candidate templates (normalized coordinates) — looks good in UI
#     candidates = [
#         _normalize_rect("north", 0.15, 0.45, 0.25, 0.65),
#         _normalize_rect("north", 0.55, 0.85, 0.25, 0.65),
#         _normalize_rect("east",  0.20, 0.50, 0.25, 0.65),
#         _normalize_rect("west",  0.20, 0.50, 0.25, 0.65),
#         _normalize_rect("south", 0.35, 0.65, 0.30, 0.60),
#     ]

#     panels = []
#     used_area = 0.0

#     # We interpret target_coverage as "fraction of total wall area" in a normalized sense.
#     # For MVP, we just approximate coverage by counting panel areas in normalized coords.
#     target = float(req.target_coverage)

#     for c in candidates:
#         if not _apply_exclusions(c, exclusions):
#             continue
#         a = _rect_area(c)
#         if used_area + a <= target + 1e-6:
#             panels.append(c)
#             used_area += a

#         if used_area >= target:
#             break

#     # If exclusions removed too much, still return whatever we managed to place
#     return RecommendResponse(
#         used_coverage=float(used_area),
#         panels=[PanelRect(**p) for p in panels]
#     )

# -----------------------------------------------------------
# from fastapi import FastAPI
# from app.routers import predict, recommend, materials


# app = FastAPI(title="AcuVisor Backend", version="0.1")

# @app.get("/health")
# def health():
#     return {"status": "ok"}

# app.include_router(predict.router)
# app.include_router(recommend.router)
# app.include_router(materials.router)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, recommend, materials, optimize, audio
from fastapi.staticfiles import StaticFiles



app = FastAPI(title="AcuVisor Backend", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(materials.router)
app.include_router(optimize.router) 
app.include_router(audio.router)

