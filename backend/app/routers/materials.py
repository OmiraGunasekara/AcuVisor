import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image

from app.services.cv_service import crop_by_click, suggest_material_from_crop
from app.services.material_library import MATERIAL_LIBRARY

router = APIRouter()

@router.post("/suggest-material")
async def suggest_material(
    image: UploadFile = File(...),
    surface: str = Form(..., description="wall|floor|ceiling"),
    x: float = Form(..., ge=0, le=1, description="Normalized x click [0..1]"),
    y: float = Form(..., ge=0, le=1, description="Normalized y click [0..1]"),
    box_size: int = Form(160, ge=64, le=512, description="Crop box size in pixels")
):
    surface = surface.strip().lower()
    if surface not in {"wall", "floor", "ceiling"}:
        raise HTTPException(status_code=400, detail="surface must be wall|floor|ceiling")

    content = await image.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    crop = crop_by_click(img, x_norm=x, y_norm=y, box_size=box_size)
    suggestion = suggest_material_from_crop(crop, surface)

    # Map suggested label -> absorption coefficient
    best = MATERIAL_LIBRARY[suggestion["suggested_label"]]
    suggestion["alpha"] = float(best["alpha"])
    suggestion["display_name"] = best["display"]

    # Also attach alpha for each candidate
    for c in suggestion["candidates"]:
        c["alpha"] = float(MATERIAL_LIBRARY[c["label"]]["alpha"])
        c["display_name"] = MATERIAL_LIBRARY[c["label"]]["display"]

    return suggestion
