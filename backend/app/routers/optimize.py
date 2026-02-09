from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List

from app.services.ga_service import run_ga

router = APIRouter()

class ExclusionRect(BaseModel):
    wall: str = Field(..., description="north|south|east|west")
    x1: float = Field(..., ge=0, le=1)
    x2: float = Field(..., ge=0, le=1)
    z1: float = Field(..., ge=0, le=1)
    z2: float = Field(..., ge=0, le=1)

class OptimizeRequest(BaseModel):
    L: float = Field(..., gt=0)
    W: float = Field(..., gt=0)
    H: float = Field(..., gt=0)

    wall_a: float = Field(..., ge=0, le=1)
    floor_a: float = Field(..., ge=0, le=1)
    ceil_a: float = Field(..., ge=0, le=1)

    exclusions: List[ExclusionRect] = Field(default_factory=list)

    max_coverage: float = Field(0.6, ge=0, le=1)
    population: int = Field(30, ge=10, le=120)
    generations: int = Field(25, ge=5, le=200)
    seed: int = Field(42, ge=0, le=10_000)

@router.post("/optimize-panels-ga")
def optimize_panels_ga(req: OptimizeRequest):
    exclusions = [e.model_dump() for e in req.exclusions]
    result = run_ga(
        L=req.L, W=req.W, H=req.H,
        wall_a=req.wall_a, floor_a=req.floor_a, ceil_a=req.ceil_a,
        exclusions=exclusions,
        max_coverage=req.max_coverage,
        population=req.population,
        generations=req.generations,
        seed=req.seed
    )
    return result
