import io
import gc
from typing import Dict, Optional, Tuple

import numpy as np
from PIL import Image
from transformers import AutoImageProcessor, Mask2FormerForUniversalSegmentation

_DEVICE = None
_MODEL_NAME = "facebook/mask2former-swin-small-ade-semantic"
_processor = None
_model = None


def _ensure_model_loaded():
    global _processor, _model, _DEVICE
    if _processor is None or _model is None:
        import torch
        _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading surface segmentation model: {_MODEL_NAME}")
        _processor = AutoImageProcessor.from_pretrained(_MODEL_NAME)
        _model = Mask2FormerForUniversalSegmentation.from_pretrained(_MODEL_NAME).to(_DEVICE)
        _model.eval()
        print("Surface segmentation model loaded successfully")


def _unload_model():
    global _processor, _model, _DEVICE
    import torch
    _processor = None
    _model = None
    _DEVICE = None
    gc.collect()
    torch.cuda.empty_cache()


def _normalize_label(label: str) -> str:
    return label.strip().lower().replace("-", " ").replace("_", " ")


def _find_label_id(id2label: Dict[int, str], target: str) -> Optional[int]:
    target = _normalize_label(target)
    for idx, label in id2label.items():
        if _normalize_label(label) == target:
            return int(idx)
    for idx, label in id2label.items():
        if target in _normalize_label(label):
            return int(idx)
    return None


def _bbox_from_mask(mask: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def _bbox_to_normalized(bbox, width: int, height: int) -> Dict[str, float]:
    x1, y1, x2, y2 = bbox
    return {
        "x1": round(float(x1 / width), 4),
        "y1": round(float(y1 / height), 4),
        "x2": round(float(x2 / width), 4),
        "y2": round(float(y2 / height), 4),
    }


def _surface_area_threshold(surface: str) -> float:
    thresholds = {"wall": 0.08, "floor": 0.04, "ceiling": 0.03}
    return thresholds.get(surface, 0.03)


# Uses Mask2Former to automatically detect and segment walls, floors, and ceilings
def segment_room_surfaces(image_bytes: bytes) -> Dict:
    import torch
    import torch.nn.functional as F

    _ensure_model_loaded()

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise ValueError("Invalid image file")

    width, height = image.size
    max_dim = 1024
    if max(width, height) > max_dim:
        scale = max_dim / max(width, height)
        image = image.resize((int(width * scale), int(height * scale)))
        width, height = image.size

    try:
        inputs = _processor(images=image, return_tensors="pt")
        inputs = {k: v.to(_DEVICE) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = _model(**inputs)

        processed = _processor.post_process_semantic_segmentation(
            outputs,
            target_sizes=[(height, width)]
        )
        semantic_map = processed[0].cpu().numpy()

        mask_logits = outputs.masks_queries_logits
        class_logits = outputs.class_queries_logits
        mask_probs = mask_logits.sigmoid()
        class_probs = class_logits.softmax(dim=-1)[..., :-1]

        semantic_scores = torch.einsum("bqc,bqhw->bchw", class_probs, mask_probs)
        semantic_scores = F.interpolate(
            semantic_scores,
            size=(height, width),
            mode="bilinear",
            align_corners=False,
        )
        semantic_probs = semantic_scores.softmax(dim=1)[0]

        id2label = _model.config.id2label
        target_ids = {
            "wall": _find_label_id(id2label, "wall"),
            "floor": _find_label_id(id2label, "floor"),
            "ceiling": _find_label_id(id2label, "ceiling"),
        }

        surfaces = {}
        fallback_required = False

        for surface_name, class_id in target_ids.items():
            if class_id is None:
                surfaces[surface_name] = None
                fallback_required = True
                continue

            mask = semantic_map == class_id
            area_ratio = float(mask.mean())

            if area_ratio <= 0:
                surfaces[surface_name] = None
                fallback_required = True
                continue

            bbox = _bbox_from_mask(mask)
            if bbox is None:
                surfaces[surface_name] = None
                fallback_required = True
                continue

            confidence = float(semantic_probs[class_id][mask].mean().item()) if mask.any() else 0.0
            surfaces[surface_name] = {
                "bbox": _bbox_to_normalized(bbox, width, height),
                "confidence": round(confidence, 4),
                "mask_area_ratio": round(area_ratio, 4),
            }

            if area_ratio < _surface_area_threshold(surface_name):
                fallback_required = True

        if any(surfaces.get(k) is None for k in ["wall", "floor", "ceiling"]):
            fallback_required = True

        return {
            "success": True,
            "model": _MODEL_NAME,
            "image_size": {"width": width, "height": height},
            "fallback_required": fallback_required,
            "surfaces": surfaces,
        }

    finally:
        _unload_model()