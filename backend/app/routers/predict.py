from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.ml_service import predict_rt60

router = APIRouter()

class PredictRequest(BaseModel):
    L: float = Field(..., gt=0)
    W: float = Field(..., gt=0)
    H: float = Field(..., gt=0)
    wall_a: float = Field(..., ge=0, le=1)
    floor_a: float = Field(..., ge=0, le=1)
    ceil_a: float = Field(..., ge=0, le=1)
    panel_coverage: float = Field(..., ge=0, le=1)

class PredictResponse(BaseModel):
    rt60_before: float
    rt60_after: float
    rt60_delta: float

@router.post("/predict-rt60", response_model=PredictResponse)
def predict(req: PredictRequest):
    rt60_before = predict_rt60(req.L, req.W, req.H, req.wall_a, req.floor_a, req.ceil_a, 0.0)
    rt60_after  = predict_rt60(req.L, req.W, req.H, req.wall_a, req.floor_a, req.ceil_a, req.panel_coverage)

    return PredictResponse(
        rt60_before=rt60_before,
        rt60_after=rt60_after,
        rt60_delta=rt60_before - rt60_after
    )
