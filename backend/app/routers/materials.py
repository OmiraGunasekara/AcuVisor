import io

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image

from app.services.cv_service import crop_by_click, crop_by_bbox, suggest_material_from_crop
from app.services.material_library import MATERIAL_LIBRARY

router = APIRouter()


def _attach_material_metadata(result: dict) -> dict:
    best_label = result["suggested_label"]
    best = MATERIAL_LIBRARY[best_label]

    result["alpha"] = float(best["alpha"])
    result["display_name"] = best["display"]

    for c in result["candidates"]:
        lib = MATERIAL_LIBRARY[c["label"]]
        c["alpha"] = float(lib["alpha"])
        c["display_name"] = lib["display"]

    return result


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
    result = suggest_material_from_crop(crop, surface)
    return _attach_material_metadata(result)


@router.post("/suggest-material-from-bbox")
async def suggest_material_from_bbox(
    image: UploadFile = File(...),
    surface: str = Form(..., description="wall|floor|ceiling"),
    x1: float = Form(..., ge=0, le=1),
    y1: float = Form(..., ge=0, le=1),
    x2: float = Form(..., ge=0, le=1),
    y2: float = Form(..., ge=0, le=1),
):
    surface = surface.strip().lower()
    if surface not in {"wall", "floor", "ceiling"}:
        raise HTTPException(status_code=400, detail="surface must be wall|floor|ceiling")

    content = await image.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    crop = crop_by_bbox(img, x1=x1, y1=y1, x2=x2, y2=y2)
    result = suggest_material_from_crop(crop, surface)
    return _attach_material_metadata(result) 