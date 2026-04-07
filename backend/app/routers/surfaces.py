import io

from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image

from app.services.surface_segmentation_service import segment_room_surfaces

router = APIRouter()


# Analyzes an image to detect major room surfaces
@router.post("/segment-surfaces")
async def segment_surfaces(image: UploadFile = File(...)):
    content = await image.read()

    try:
        Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    try:
        return segment_room_surfaces(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Surface segmentation failed: {str(e)}")