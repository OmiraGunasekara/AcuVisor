from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

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

    x1: float
    x2: float
    z1: float
    z2: float

    x1_m: float
    x2_m: float
    z1_m: float
    z2_m: float
    width_m: float
    height_m: float

    panel_w_m: float
    panel_h_m: float
    panel_label: str


class RecommendResponse(BaseModel):
    used_coverage: float
    panels: List[PanelRect]
    rt60_before: float
    rt60_after: float
    rt60_delta: float
    total_panel_area_m2: float


def _panel_label(width_m: float, height_m: float) -> str:
    w_mm = int(round(width_m * 1000))
    h_mm = int(round(height_m * 1000))
    return f"{w_mm}x{h_mm}mm"


def _add_physical_dimensions(panel: dict, L: float, W: float, H: float) -> PanelRect:
    wall = panel["wall"]

    if wall in ["north", "south"]:
        wall_width = L
    else:
        wall_width = W

    wall_height = H

    x1_m = panel["x1"] * wall_width
    x2_m = panel["x2"] * wall_width
    z1_m = panel["z1"] * wall_height
    z2_m = panel["z2"] * wall_height

    width_m = x2_m - x1_m
    height_m = z2_m - z1_m

    panel_w_m = float(panel.get("panel_w_m", width_m))
    panel_h_m = float(panel.get("panel_h_m", height_m))

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
        panel_w_m=round(panel_w_m, 3),
        panel_h_m=round(panel_h_m, 3),
        panel_label=_panel_label(panel_w_m, panel_h_m),
    )


@router.post("", response_model=RecommendResponse)
async def recommend_panels(req: RecommendRequest):
    try:
        exclusions = [ex.model_dump() for ex in req.exclusions]

        result = run_ga(
            L=req.L,
            W=req.W,
            H=req.H,
            wall_a=req.wall_a,
            floor_a=req.floor_a,
            ceil_a=req.ceil_a,
            exclusions=exclusions,
            max_coverage=req.target_coverage,
            population=40,
            generations=30,
            seed=None,#Change to None for deterministic results
        )

        panels_with_dims = [
            _add_physical_dimensions(p, req.L, req.W, req.H)
            for p in result["panels"]
        ]

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