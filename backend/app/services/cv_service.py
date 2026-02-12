import io
from PIL import Image
import torch
import torch.nn.functional as F
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

# Material descriptions
_MATERIAL_DESCRIPTIONS = {
    "wood": [
        "wooden surface with visible grain lines and texture",
        "natural wood material with brown organic patterns",
        "hardwood with linear grain texture",
        "timber planks with natural wood texture"
    ],
    "painted_plaster": [
        "smooth painted wall with uniform matte finish",
        "flat painted surface without texture",
        "solid color painted interior wall",
        "matte painted plaster with no pattern"
    ],
    "gypsum": [
        "white smooth drywall ceiling surface",
        "flat white ceiling material",
        "uniform white gypsum board surface",
        "plain white ceiling with no texture"
    ],
    "carpet": [
        "soft fuzzy carpet with fiber texture",
        "textile floor covering with pile fibers",
        "fabric floor material with woven loops",
        "plush carpet with thick fiber texture"
    ],
    "tile": [
        "hard ceramic tiles with visible grout lines",
        "square tiles with grid pattern and spacing",
        "glossy tile surface with geometric layout",
        "rigid tiles separated by grout joints"
    ],
    "concrete": [
        "smooth gray concrete floor",
        "gray cement surface",
        "industrial concrete material",
        "gray stone-like concrete texture"
    ],
    "brick": [
        "red rectangular bricks with mortar joints",
        "exposed masonry wall with brick pattern",
        "terracotta colored bricks in rows",
        "textured brick wall with offset pattern"
    ],
    "glass": [
        "hard transparent glass window pane",
        "rigid see-through glass surface with reflections",
        "smooth solid glass with mirror-like shine",
        "clear inflexible glass material showing objects behind it",
        "stiff translucent glass barrier with gloss"
    ],
    "curtain": [
        "soft opaque fabric hanging with folds",
        "flexible textile curtain with wrinkles and creases",
        "thick cloth drapery blocking light",
        "hanging fabric material with visible weave texture",
        "limp textile with draped appearance and no transparency"
    ]
}

_SURFACE_VALID_MATERIALS = {
    "floor": ["wood", "tile", "carpet", "concrete"],
    "ceiling": ["gypsum", "painted_plaster", "tile", "wood", "concrete"],
    "wall": ["painted_plaster", "gypsum", "wood", "brick", "concrete", "glass", "tile", "curtain"]
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

def _analyze_color(crop: Image.Image) -> dict:
    # Resize for faster processing
    small = crop.resize((64, 64))
    arr = np.array(small, dtype=np.float32) / 255.0
    
    # Color statistics
    mean_rgb = arr.mean(axis=(0, 1))
    std_rgb = arr.std(axis=(0, 1))
    
    r, g, b = mean_rgb
    brightness = mean_rgb.mean()
    
    # Color characteristics
    is_brownish = r > b * 1.15 and g > b * 1.05 and r > 0.3  
    is_warm = r > b  # More red than blue
    is_neutral_gray = std_rgb.mean() < 0.08 and abs(r - g) < 0.05 and abs(g - b) < 0.05 
    is_very_light = brightness > 0.7
    is_very_dark = brightness < 0.3
    
    # Red-ish (brick)
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

def _apply_color_penalties(material_scores: dict, color_info: dict) -> dict:
    penalties = {}
    # WOOD penalties
    if not color_info["is_brownish"] and not color_info["is_warm"]:
        penalties["wood"] = 0.3  # Heavy penalty if not brownish/warm
    
    # CONCRETE bonuses (gray, neutral)
    if color_info["is_neutral_gray"]:
        penalties["concrete"] = 1.5  # Boost concrete for gray surfaces
        penalties["painted_plaster"] = 1.3  # Also boost plaster
        penalties["gypsum"] = 1.3
    
    # BRICK penalties (must be reddish)
    if not color_info["is_reddish"]:
        penalties["brick"] = 0.2
    
    # CARPET penalties (usually darker, textured)
    if color_info["is_very_light"] and color_info["is_neutral_gray"]:
        penalties["carpet"] = 0.4
    
    # Apply penalties/boosts
    adjusted = {}
    for mat, score in material_scores.items():
        multiplier = penalties.get(mat, 1.0)
        adjusted[mat] = score * multiplier
    
    return adjusted

def suggest_material_from_crop(crop: Image.Image, surface: str) -> dict:
    _ensure_model_loaded()
    
    # Analyze color first
    color_info = _analyze_color(crop)
    
    # Get valid materials for this surface type
    valid_materials = _SURFACE_VALID_MATERIALS.get(surface, list(MVP_LABELS))
    
    # Prepare text descriptions (ONLY for valid materials)
    all_texts = []
    text_to_material = []
    
    for material, descriptions in _MATERIAL_DESCRIPTIONS.items():
        if material in MVP_LABELS and material in valid_materials:
            for desc in descriptions:
                all_texts.append(desc)
                text_to_material.append(material)
    
    if not all_texts:
        fallback = "painted_plaster" if surface == "wall" else ("gypsum" if surface == "ceiling" else "concrete")
        return {
            "surface": surface,
            "suggested_label": fallback,
            "confidence": 0.5,
            "candidates": [{"label": fallback, "confidence": 0.5}],
            "note": "No valid materials found"
        }
    
    # Process through CLIP
    try:
        inputs = _processor(
            text=all_texts,
            images=crop,
            return_tensors="pt",
            padding=True
        )
        
        inputs = {k: v.to(_device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = _model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)[0]
    
    except Exception as e:
        print(f"CLIP error: {e}")
        fallback = "concrete" if color_info["is_neutral_gray"] else "painted_plaster"
        return {
            "surface": surface,
            "suggested_label": fallback,
            "confidence": 0.5,
            "candidates": [{"label": fallback, "confidence": 0.5}],
            "note": f"Error: {str(e)}"
        }
    
    # Aggregate CLIP scores by material
    material_scores = {}
    for idx, material in enumerate(text_to_material):
        if material not in material_scores:
            material_scores[material] = []
        material_scores[material].append(float(probs[idx].item()))
    
    # Use MAX score
    material_max_scores = {
        material: max(scores)
        for material, scores in material_scores.items()
    }
    
    # APPLY COLOR-BASED FILTERING
    adjusted_scores = _apply_color_penalties(material_max_scores, color_info)
    
    # Sort by adjusted score
    sorted_materials = sorted(adjusted_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Debug output
    # print(f"\n=== Material Detection ===")
    # print(f"Surface: {surface}")
    # print(f"Color: brightness={color_info['brightness']:.2f}, neutral_gray={color_info['is_neutral_gray']}, brownish={color_info['is_brownish']}")
    # print(f"Top 3 (after color filtering):")
    # for i, (mat, score) in enumerate(sorted_materials[:3]):
    #     print(f"  {i+1}. {mat}: {score:.3f}")
    # print("==========================\n")
    
    # Normalize scores
    if sorted_materials:
        max_score = sorted_materials[0][1]
        if max_score > 0:
            candidates = [(mat, min(1.0, score / max_score * 0.95)) for mat, score in sorted_materials[:5]]
        else:
            candidates = [(mat, 0.5) for mat, score in sorted_materials[:5]]
    else:
        fallback = "concrete" if color_info["is_neutral_gray"] else "painted_plaster"
        candidates = [(fallback, 0.5)]
    
    best_label, best_conf = candidates[0]
    
    return {
        "surface": surface,
        "suggested_label": best_label,
        "confidence": float(best_conf),
        "candidates": [{"label": lab, "confidence": float(conf)} for lab, conf in candidates],
        "note": f"Hybrid CLIP + color analysis (brightness: {color_info['brightness']:.2f})"
    }