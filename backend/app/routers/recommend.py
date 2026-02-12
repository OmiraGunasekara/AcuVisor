# from fastapi import APIRouter
# from pydantic import BaseModel, Field
# from app.services.recommend_service import recommend_panels, VALID_WALLS

# router = APIRouter()

# class ExclusionRect(BaseModel):
#     wall: str = Field(..., description="north|south|east|west")
#     x1: float = Field(..., ge=0, le=1)
#     x2: float = Field(..., ge=0, le=1)
#     z1: float = Field(..., ge=0, le=1)
#     z2: float = Field(..., ge=0, le=1)

# class RecommendRequest(BaseModel):
#     target_coverage: float = Field(0.5, ge=0, le=1)
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

# @router.post("/recommend-panels", response_model=RecommendResponse)
# def recommend(req: RecommendRequest):
#     exclusions = [e.model_dump() for e in req.exclusions if e.wall in VALID_WALLS]
#     out = recommend_panels(req.target_coverage, exclusions)
#     return out


# backend/app/routers/recommend.py - CORRECTED FOR ga_service.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

# ✅ CORRECTED: Import from ga_service (your actual file name)
from app.services.ga_service import run_ga

router = APIRouter(prefix="/recommend-panels", tags=["recommend"])


class ExclusionRect(BaseModel):
    wall: str = Field(..., description="north|south|east|west")
    x1: float = Field(..., ge=0, le=1)
    x2: float = Field(..., ge=0, le=1)
    z1: float = Field(..., ge=0, le=1)
    z2: float = Field(..., ge=0, le=1)


class RecommendRequest(BaseModel):
    L: float = Field(..., gt=0, description="Room length (meters)")
    W: float = Field(..., gt=0, description="Room width (meters)")
    H: float = Field(..., gt=0, description="Room height (meters)")
    wall_a: float = Field(..., ge=0, le=1)
    floor_a: float = Field(..., ge=0, le=1)
    ceil_a: float = Field(..., ge=0, le=1)
    target_coverage: float = Field(0.5, ge=0, le=1)
    exclusions: List[ExclusionRect] = Field(default_factory=list)


class PanelRect(BaseModel):
    wall: str
    # Normalized coordinates (0-1)
    x1: float
    x2: float
    z1: float
    z2: float
    # Physical dimensions (meters)
    x1_m: float
    x2_m: float
    z1_m: float
    z2_m: float
    width_m: float
    height_m: float


class RecommendResponse(BaseModel):
    used_coverage: float
    panels: List[PanelRect]
    rt60_before: float
    rt60_after: float
    rt60_delta: float
    total_panel_area_m2: float


def _add_physical_dimensions(panel: dict, L: float, W: float, H: float) -> PanelRect:
    """
    Convert normalized panel coordinates to physical dimensions in meters.
    
    Args:
        panel: Dict with wall, x1, x2, z1, z2 (normalized 0-1)
        L: Room length (meters)
        W: Room width (meters)
        H: Room height (meters)
    
    Returns:
        PanelRect with both normalized and physical dimensions
    """
    wall = panel["wall"]
    
    # Determine wall dimensions
    if wall in ["north", "south"]:
        wall_width = L  # Length of room
    else:  # east, west
        wall_width = W  # Width of room
    
    wall_height = H
    
    # Convert normalized (0-1) to meters
    x1_m = panel["x1"] * wall_width
    x2_m = panel["x2"] * wall_width
    z1_m = panel["z1"] * wall_height
    z2_m = panel["z2"] * wall_height
    
    width_m = x2_m - x1_m
    height_m = z2_m - z1_m
    
    return PanelRect(
        wall=wall,
        x1=panel["x1"],
        x2=panel["x2"],
        z1=panel["z1"],
        z2=panel["z2"],
        x1_m=round(x1_m, 3),
        x2_m=round(x2_m, 3),
        z1_m=round(z1_m, 3),
        z2_m=round(z2_m, 3),
        width_m=round(width_m, 3),
        height_m=round(height_m, 3),
    )


@router.post("", response_model=RecommendResponse)
async def recommend_panels(req: RecommendRequest):
    """
    Use genetic algorithm to optimize panel placement.
    
    The GA uses your ML model to predict RT60 for each layout,
    then evolves better solutions over multiple generations.
    
    Returns panel layout with both normalized coords and physical dimensions.
    """
    try:
        # Convert exclusions to dict format
        exclusions = [ex.model_dump() for ex in req.exclusions]
        
        # 🎯 Call GA optimizer (from ga_service.py)
        result = run_ga(
            L=req.L,
            W=req.W,
            H=req.H,
            wall_a=req.wall_a,
            floor_a=req.floor_a,
            ceil_a=req.ceil_a,
            exclusions=exclusions,
            max_coverage=req.target_coverage,
            population=40,      # Population size
            generations=30,     # Number of generations
            seed=None,          # Random seed (None for variety)
        )
        
        # Add physical dimensions to each panel
        panels_with_dims = [
            _add_physical_dimensions(p, req.L, req.W, req.H)
            for p in result["panels"]
        ]
        
        # Calculate total panel area in m²
        total_area_m2 = sum(p.width_m * p.height_m for p in panels_with_dims)
        
        return RecommendResponse(
            used_coverage=result["used_coverage"],
            panels=panels_with_dims,
            rt60_before=result["rt60_before"],
            rt60_after=result["rt60_after"],
            rt60_delta=result["rt60_delta"],
            total_panel_area_m2=round(total_area_m2, 2),
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
