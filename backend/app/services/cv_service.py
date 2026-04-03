import io
import gc
from typing import Dict, List

from PIL import Image
import numpy as np

from app.services.material_library import SUPPORTED_MATERIAL_LABELS

_device = None
_model = None
_processor = None


def _ensure_model_loaded():
    global _model, _processor, _device
    if _model is None:
        import torch
        from transformers import CLIPProcessor, CLIPModel
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        print("Loading CLIP model...")
        _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(_device)
        _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _model.eval()
        print("CLIP model loaded successfully")


def _unload_model():
    global _model, _processor, _device
    import torch
    _model = None
    _processor = None
    _device = None
    gc.collect()
    torch.cuda.empty_cache()


_MATERIAL_DESCRIPTIONS = {
    "wood": [
        "wooden floor with natural grain lines running in one direction",
        "brown timber planks with organic wood grain texture",
        "hardwood floor with long parallel grain streaks",
        "natural wood surface with knots and irregular grain pattern",
        "warm brown wooden boards with visible wood fiber texture",
    ],
    "painted_plaster": [
        "smooth painted wall with completely uniform matte finish and no texture",
        "flat solid color painted surface with no pattern or grain",
        "interior wall painted in single color with no visible texture",
        "matte painted plaster wall with perfectly smooth flat surface",
        "uniform painted surface with slight sheen and no grout or grain",
    ],
    "gypsum": [
        "plain flat white ceiling with no texture or pattern",
        "smooth white drywall surface with no grain or joints",
        "uniform white ceiling board with matte flat finish",
        "featureless white plasterboard ceiling surface",
        "blank white interior ceiling with no markings",
    ],
    "carpet": [
        "soft carpet floor with dense fiber pile texture",
        "fuzzy fabric floor covering with textile fiber loops",
        "plush carpet with soft raised fiber surface",
        "woven carpet material with uniform fiber pile",
        "fabric floor with soft matte surface and textile texture",
    ],
    "tile": [
        "ceramic floor tiles with clearly visible straight grout lines forming a grid",
        "square or rectangular tiles separated by thin grout joints in a regular pattern",
        "glossy ceramic tile surface with repeating geometric grid of grout lines",
        "hard floor tiles with uniform size and visible grout between each tile",
        "polished stone or ceramic tiles with sharp edges and grout spacing",
    ],
    "concrete": [
        "rough gray concrete surface with porous texture",
        "bare gray cement floor with no coating or grain",
        "industrial gray concrete with aggregate texture",
        "unfinished gray concrete surface with subtle roughness",
        "flat gray cement material with matte finish and no pattern",
    ],
    "brick": [
        "red rectangular clay bricks arranged in rows with white mortar joints",
        "exposed brick wall with terracotta colored blocks and visible mortar",
        "masonry wall with uniform brick pattern and horizontal mortar lines",
        "rough textured red bricks separated by gray mortar joints",
        "stacked rectangular bricks with offset alternating pattern",
    ],
    "glass": [
        "transparent glass window showing objects clearly through it",
        "clear reflective glass surface with mirror like shine",
        "smooth transparent glass pane with light reflection",
        "see through glass material with high gloss finish",
        "rigid transparent glass with strong specular reflection",
    ],
    "curtain": [
        "hanging fabric curtain with soft folds and draping",
        "textile drape with vertical wrinkles and soft folds",
        "thick cloth hanging from a rod with gathered folds",
        "soft opaque fabric panel hanging with flowing drape",
        "flexible woven curtain material with creases and folds",
    ],
}

_SURFACE_VALID_MATERIALS = {
    "floor": ["wood", "tile", "carpet", "concrete"],
    "ceiling": ["gypsum", "painted_plaster", "tile", "wood", "concrete"],
    "wall": ["painted_plaster", "gypsum", "wood", "brick", "concrete", "glass", "tile", "curtain"],
}


def crop_by_click(img: Image.Image, x_norm: float, y_norm: float, box_size: int = 160) -> Image.Image:
    w, h = img.size
    x = int(max(0, min(w - 1, x_norm * w)))
    y = int(max(0, min(h - 1, y_norm * h)))

    half = box_size // 2
    left = max(0, x - half)
    top = max(0, y - half)
    right = min(w, x + half)
    bottom = min(h, y + half)

    return img.crop((left, top, right, bottom))


def crop_by_bbox(img: Image.Image, x1: float, y1: float, x2: float, y2: float, pad_ratio: float = 0.04) -> Image.Image:
 
    w, h = img.size

    x1 = max(0.0, min(1.0, float(x1)))
    y1 = max(0.0, min(1.0, float(y1)))
    x2 = max(0.0, min(1.0, float(x2)))
    y2 = max(0.0, min(1.0, float(y2)))

    left = min(x1, x2)
    right = max(x1, x2)
    top = min(y1, y2)
    bottom = max(y1, y2)

    pad_x = (right - left) * pad_ratio
    pad_y = (bottom - top) * pad_ratio

    left = max(0.0, left - pad_x)
    right = min(1.0, right + pad_x)
    top = max(0.0, top - pad_y)
    bottom = min(1.0, bottom + pad_y)

    px1 = int(round(left * w))
    py1 = int(round(top * h))
    px2 = int(round(right * w))
    py2 = int(round(bottom * h))

    if px2 <= px1 or py2 <= py1:
        return img.copy()

    return img.crop((px1, py1, px2, py2))


def _analyze_color(crop: Image.Image) -> Dict:
    small = crop.resize((64, 64))
    arr = np.array(small, dtype=np.float32) / 255.0

    mean_rgb = arr.mean(axis=(0, 1))
    std_rgb = arr.std(axis=(0, 1))

    r, g, b = mean_rgb
    brightness = float(mean_rgb.mean())

    is_brownish = r > b * 1.15 and g > b * 1.05 and r > 0.3
    is_warm = r > b
    is_neutral_gray = std_rgb.mean() < 0.08 and abs(r - g) < 0.05 and abs(g - b) < 0.05
    is_very_light = brightness > 0.7
    is_very_dark = brightness < 0.3
    is_reddish = r > g * 1.2 and r > b * 1.3 and r > 0.4

    return {
        "mean_rgb": mean_rgb,
        "brightness": brightness,
        "is_brownish": is_brownish,
        "is_warm": is_warm,
        "is_neutral_gray": is_neutral_gray,
        "is_very_light": is_very_light,
        "is_very_dark": is_very_dark,
        "is_reddish": is_reddish,
    }


def _apply_color_penalties(material_scores: Dict[str, float], color_info: Dict) -> Dict[str, float]:
    penalties = {}

    # Wood must be warm and brownish
    if not color_info["is_brownish"] and not color_info["is_warm"]:
        penalties["wood"] = 0.50
    if color_info["is_neutral_gray"]:
        penalties["wood"] = 0.70
    if color_info["is_very_light"]:
        penalties["wood"] = 0.60

    # Tile is hard and light - penalize if very dark or brownish
    if color_info["is_very_dark"]:
        penalties["tile"] = 0.50
    if color_info["is_brownish"] and not color_info["is_neutral_gray"]:
        penalties["tile"] = 0.40

    # Carpet is soft - penalize if very light or gray
    if color_info["is_very_light"] or color_info["is_neutral_gray"]:
        penalties["carpet"] = 0.30

    # Concrete must be gray - penalize if warm or brownish
    if color_info["is_brownish"] or color_info["is_reddish"]:
        penalties["concrete"] = 0.50

    # Brick must be reddish
    if not color_info["is_reddish"]:
        penalties["brick"] = 0.60

    adjusted = {}
    for mat, score in material_scores.items():
        adjusted[mat] = float(score) * float(penalties.get(mat, 1.0))

    return adjusted


def _surface_fallback(surface: str, color_info: Dict) -> str:
    if surface == "floor":
        return "concrete" if color_info["is_neutral_gray"] else "wood"
    if surface == "ceiling":
        return "gypsum" if color_info["is_very_light"] else "painted_plaster"
    return "concrete" if color_info["is_neutral_gray"] else "painted_plaster"


def _normalize_candidates(sorted_materials: List, top_k: int = 5) -> List[Dict]:
    if not sorted_materials:
        return []

    top_materials = sorted_materials[:top_k]
    max_score = top_materials[0][1]

    if max_score <= 0:
        return [{"label": mat, "confidence": 0.5} for mat, _ in top_materials]

    normalized = []
    for mat, score in top_materials:
        conf = float(score / max_score)
        conf = min(0.95, max(0.05, conf))
        normalized.append({"label": mat, "confidence": round(conf, 4)})

    return normalized


def _suggest_material_from_crop_loaded(crop: Image.Image, surface: str) -> Dict:
    import torch

    color_info = _analyze_color(crop)
    valid_materials = _SURFACE_VALID_MATERIALS.get(surface, list(SUPPORTED_MATERIAL_LABELS))

    all_texts = []
    text_to_material = []

    for material, descriptions in _MATERIAL_DESCRIPTIONS.items():
        if material in SUPPORTED_MATERIAL_LABELS and material in valid_materials:
            for desc in descriptions:
                all_texts.append(desc)
                text_to_material.append(material)

    if not all_texts:
        fallback = _surface_fallback(surface, color_info)
        return {
            "surface": surface,
            "suggested_label": fallback,
            "confidence": 0.5,
            "candidates": [{"label": fallback, "confidence": 0.5}],
            "note": "No valid materials found for this surface",
        }

    try:
        crop = crop.resize((224, 224))
        inputs = _processor(
            text=all_texts,
            images=crop,
            return_tensors="pt",
            padding=True,
        )
        inputs = {k: v.to(_device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = _model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)[0]

    except Exception as e:
        fallback = _surface_fallback(surface, color_info)
        return {
            "surface": surface,
            "suggested_label": fallback,
            "confidence": 0.5,
            "candidates": [{"label": fallback, "confidence": 0.5}],
            "note": f"CLIP inference failed, fallback used: {str(e)}",
        }

    material_scores: Dict[str, List[float]] = {}
    for idx, material in enumerate(text_to_material):
        material_scores.setdefault(material, []).append(float(probs[idx].item()))

    material_max_scores = {
        material: max(scores)
        for material, scores in material_scores.items()
    }

    adjusted_scores = _apply_color_penalties(material_max_scores, color_info)
    sorted_materials = sorted(adjusted_scores.items(), key=lambda x: x[1], reverse=True)
    candidates = _normalize_candidates(sorted_materials, top_k=5)

    if not candidates:
        fallback = _surface_fallback(surface, color_info)
        candidates = [{"label": fallback, "confidence": 0.5}]

    best = candidates[0]
    best_label = best["label"]
    best_conf = best["confidence"]

    return {
        "surface": surface,
        "suggested_label": best_label,
        "confidence": float(best_conf),
        "candidates": candidates,
        "note": f"CLIP material suggestion with brightness fallback metadata ({color_info['brightness']:.2f})",
    }


# Uses a pre-trained CLIP model to suggest the most likely material from a single crop
def suggest_material_from_crop(crop: Image.Image, surface: str) -> Dict:
    try:
        _ensure_model_loaded()
        return _suggest_material_from_crop_loaded(crop, surface)
    finally:
        _unload_model()


# Evaluates multiple geometric crops simultaneously using the CLIP model
def suggest_materials_from_crops(crops: Dict[str, Image.Image]) -> Dict[str, Dict]:
    try:
        _ensure_model_loaded()
        return {
            surface: _suggest_material_from_crop_loaded(crop, surface)
            for surface, crop in crops.items()
        }
    finally:
        _unload_model()
