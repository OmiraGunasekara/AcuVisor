from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.recommend_service import recommend_panels, VALID_WALLS

router = APIRouter()

class ExclusionRect(BaseModel):
    wall: str = Field(..., description="north|south|east|west")
    x1: float = Field(..., ge=0, le=1)
    x2: float = Field(..., ge=0, le=1)
    z1: float = Field(..., ge=0, le=1)
    z2: float = Field(..., ge=0, le=1)

class RecommendRequest(BaseModel):
    target_coverage: float = Field(0.5, ge=0, le=1)
    exclusions: list[ExclusionRect] = Field(default_factory=list)

class PanelRect(BaseModel):
    wall: str
    x1: float
    x2: float
    z1: float
    z2: float

class RecommendResponse(BaseModel):
    used_coverage: float
    panels: list[PanelRect]

@router.post("/recommend-panels", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    exclusions = [e.model_dump() for e in req.exclusions if e.wall in VALID_WALLS]
    out = recommend_panels(req.target_coverage, exclusions)
    return out
