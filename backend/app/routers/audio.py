from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional

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

    panels: List[Panel] = []

    src_x: Optional[float] = Field(None, ge=0)
    src_y: Optional[float] = Field(None, ge=0)
    src_z: Optional[float] = Field(None, ge=0)

    mic_x: Optional[float] = Field(None, ge=0)
    mic_y: Optional[float] = Field(None, ge=0)
    mic_z: Optional[float] = Field(None, ge=0)


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
        src_x=req.src_x,
        src_y=req.src_y,
        src_z=req.src_z,
        mic_x=req.mic_x,
        mic_y=req.mic_y,
        mic_z=req.mic_z,
    )