import io
from typing import Dict, List

from PIL import Image
import torch
import numpy as np

from app.services.material_library import MVP_LABELS

_device = "cuda" if torch.cuda.is_available() else "cpu"
_model = None
_processor = None


def _ensure_model_loaded():
    global _model, _processor

    if _model is None:
        print("Loading CLIP model...")
        from transformers import CLIPProcessor, CLIPModel

        _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(_device)
        _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _model.eval()
        print("CLIP model loaded successfully")


_MATERIAL_DESCRIPTIONS = {
    "wood": [
        "wooden surface with visible grain lines and texture",
        "natural wood material with brown organic patterns",
        "hardwood with linear grain texture",
        "timber planks with natural wood texture",
    ],
    "painted_plaster": [
        "smooth painted wall with uniform matte finish",
        "flat painted surface without texture",
        "solid color painted interior wall",
        "matte painted plaster with no pattern",
    ],
    "gypsum": [
        "white smooth drywall ceiling surface",
        "flat white ceiling material",
        "uniform white gypsum board surface",
        "plain white ceiling with no texture",
    ],
    "carpet": [
        "soft fuzzy carpet with fiber texture",
        "textile floor covering with pile fibers",
        "fabric floor material with woven loops",
        "plush carpet with thick fiber texture",
    ],
    "tile": [
        "hard ceramic tiles with visible grout lines",
        "square tiles with grid pattern and spacing",
        "glossy tile surface with geometric layout",
        "rigid tiles separated by grout joints",
    ],
    "concrete": [
        "smooth gray concrete floor",
        "gray cement surface",
        "industrial concrete material",
        "gray stone like concrete texture",
    ],
    "brick": [
        "red rectangular bricks with mortar joints",
        "exposed masonry wall with brick pattern",
        "terracotta colored bricks in rows",
        "textured brick wall with offset pattern",
    ],
    "glass": [
        "hard transparent glass window pane",
        "rigid see through glass surface with reflections",
        "smooth solid glass with mirror like shine",
        "clear inflexible glass material showing objects behind it",
        "stiff translucent glass barrier with gloss",
    ],
    "curtain": [
        "soft opaque fabric hanging with folds",
        "flexible textile curtain with wrinkles and creases",
        "thick cloth drapery blocking light",
        "hanging fabric material with visible weave texture",
        "limp textile with draped appearance and no transparency",
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
    """
    Future-friendly helper for Phase 1/2 auto-detected surface boxes.
    Coordinates are normalized [0..1].
    """
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

    if not color_info["is_brownish"] and not color_info["is_warm"]:
        penalties["wood"] = 0.30

    if color_info["is_neutral_gray"]:
        penalties["concrete"] = 1.50
        penalties["painted_plaster"] = 1.30
        penalties["gypsum"] = 1.30

    if not color_info["is_reddish"]:
        penalties["brick"] = 0.20

    if color_info["is_very_light"] and color_info["is_neutral_gray"]:
        penalties["carpet"] = 0.40

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


def suggest_material_from_crop(crop: Image.Image, surface: str) -> Dict:
    _ensure_model_loaded()

    color_info = _analyze_color(crop)
    valid_materials = _SURFACE_VALID_MATERIALS.get(surface, list(MVP_LABELS))

    all_texts = []
    text_to_material = []

    for material, descriptions in _MATERIAL_DESCRIPTIONS.items():
        if material in MVP_LABELS and material in valid_materials:
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

    sorted_materials = sorted(material_max_scores.items(), key=lambda x: x[1], reverse=True)

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