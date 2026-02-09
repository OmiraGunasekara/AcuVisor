from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List

from app.services.audio_service import generate_audio

router = APIRouter()


class Panel(BaseModel):
    wall: str
    x1: float
    x2: float
    z1: float
    z2: float


class AudioRequest(BaseModel):
    L: float = Field(..., gt=0)
    W: float = Field(..., gt=0)
    H: float = Field(..., gt=0)

    wall_a: float = Field(..., ge=0, le=1)
    floor_a: float = Field(..., ge=0, le=1)
    ceil_a: float = Field(..., ge=0, le=1)

    panels: List[Panel]


@router.post("/generate-audio")
def generate_audio_endpoint(req: AudioRequest):
    return generate_audio(
        L=req.L,
        W=req.W,
        H=req.H,
        wall_a=req.wall_a,
        floor_a=req.floor_a,
        ceil_a=req.ceil_a,
        panels=[p.model_dump() for p in req.panels],
    )
