# import io
# from PIL import Image
# import torch
# import torch.nn.functional as F
# from torchvision import models, transforms

# from app.services.material_library import MVP_LABELS

# # ---- Load pretrained model once ----
# # NOTE: This is a pragmatic MVP approach:
# # We use a pretrained CNN as a feature extractor and map to a small label set.
# # User confirmation is required to handle uncertainty.

# _device = "cuda" if torch.cuda.is_available() else "cpu"

# _model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
# _model.eval()
# _model.to(_device)

# # We’ll use the penultimate layer features (2048-dim) for similarity
# _feature_extractor = torch.nn.Sequential(*list(_model.children())[:-1]).to(_device)
# _feature_extractor.eval()

# _preprocess = transforms.Compose([
#     transforms.Resize((224, 224)),
#     transforms.ToTensor(),
#     transforms.Normalize(
#         mean=[0.485, 0.456, 0.406],
#         std=[0.229, 0.224, 0.225]
#     )
# ])

# # ---- Prototype “material embeddings” (MVP) ----
# # We approximate label prototypes using fixed “anchor” RGB colors + texture-ish images is not feasible.
# # Instead: we do a simple, transparent baseline:
# # classify crop into a *small* set using a tiny linear head trained on-the-fly is not allowed.
# #
# # So for MVP: we do a heuristic mapping from ImageNet top labels → our material labels.
# # This works “good enough” when combined with user confirmation.

# _IMAGENET_TO_MATERIAL = {
#     # walls/ceilings
#     "wall": ["wall", "plaster", "concrete", "brick", "stone", "tile", "window"],
#     "floor": ["wood", "tile", "carpet", "rug", "floor"],
#     "ceiling": ["ceiling", "plaster", "drywall", "tile"],
# }

# # Very small keyword mapping from ImageNet-like concepts to our material labels
# _KEYWORD_TO_MATERIAL = [
#     (["carpet", "rug"], "carpet"),
#     (["curtain", "drape"], "curtain"),
#     (["tile", "ceramic"], "tile"),
#     (["wood", "timber"], "wood"),
#     (["brick"], "brick"),
#     (["concrete", "cement", "stone"], "concrete"),
#     (["glass", "window"], "glass"),
#     (["drywall", "gypsum", "plaster", "wall"], "painted_plaster"),
# ]

# # ---- Image crop helper ----
# def crop_by_click(img: Image.Image, x_norm: float, y_norm: float, box_size: int = 160) -> Image.Image:
#     """
#     x_norm, y_norm are normalized [0..1] click coords relative to original image.
#     box_size is crop square size in pixels (in original image space).
#     """
#     w, h = img.size
#     x = int(max(0, min(w - 1, x_norm * w)))
#     y = int(max(0, min(h - 1, y_norm * h)))

#     half = box_size // 2
#     left = max(0, x - half)
#     top = max(0, y - half)
#     right = min(w, x + half)
#     bottom = min(h, y + half)

#     return img.crop((left, top, right, bottom))

# def _extract_features(img: Image.Image) -> torch.Tensor:
#     t = _preprocess(img).unsqueeze(0).to(_device)
#     with torch.no_grad():
#         feats = _feature_extractor(t)  # [1, 2048, 1, 1]
#         feats = feats.flatten(1)       # [1, 2048]
#         feats = F.normalize(feats, dim=1)
#     return feats[0].cpu()

# def suggest_material_from_crop(crop: Image.Image, surface: str) -> dict:
#     """
#     MVP: returns a coarse material suggestion + a confidence-like score (0..1),
#     and a short explanation. User will confirm/override in FE.
#     """
#     # Extract features (kept for later upgrades)
#     _ = _extract_features(crop)

#     # SUPER simple heuristic baseline (defensible as MVP):
#     # Use the main colors/brightness to guess common cases like carpet/wood/tile vs painted walls.
#     # Then return a ranked list with low-to-medium confidence.
#     crop_small = crop.resize((64, 64))
#     arr = torch.tensor(list(crop_small.getdata()), dtype=torch.float32).view(64, 64, 3)
#     mean_rgb = arr.mean(dim=(0,1)) / 255.0
#     brightness = float(mean_rgb.mean().item())

#     # Heuristic guesses
#     candidates = []

#     if surface == "floor":
#         # dark + low variance often carpet; mid warm often wood; bright often tile
#         if brightness < 0.35:
#             candidates = [("carpet", 0.65), ("wood", 0.25), ("tile", 0.10)]
#         elif brightness < 0.65:
#             candidates = [("wood", 0.55), ("carpet", 0.25), ("tile", 0.20)]
#         else:
#             candidates = [("tile", 0.55), ("wood", 0.25), ("carpet", 0.20)]
#     elif surface == "ceiling":
#         # ceilings often bright and uniform
#         if brightness > 0.7:
#             candidates = [("gypsum", 0.55), ("painted_plaster", 0.35), ("tile", 0.10)]
#         else:
#             candidates = [("painted_plaster", 0.55), ("gypsum", 0.30), ("concrete", 0.15)]
#     else:  # wall
#         if brightness > 0.7:
#             candidates = [("painted_plaster", 0.60), ("gypsum", 0.25), ("glass", 0.15)]
#         elif brightness < 0.35:
#             candidates = [("wood", 0.45), ("concrete", 0.35), ("brick", 0.20)]
#         else:
#             candidates = [("painted_plaster", 0.55), ("wood", 0.25), ("brick", 0.20)]

#     # Ensure only MVP labels
#     candidates = [(lab, conf) for lab, conf in candidates if lab in MVP_LABELS]

#     best_label, best_conf = candidates[0]
#     return {
#         "surface": surface,
#         "suggested_label": best_label,
#         "confidence": float(best_conf),
#         "candidates": [{"label": lab, "confidence": float(conf)} for lab, conf in candidates],
#         "note": "MVP coarse material suggestion from clicked crop; user confirmation recommended."
#     }

import io
from PIL import Image
import torch
import torch.nn.functional as F

from app.services.material_library import MVP_LABELS

# ---- Load CLIP model (lazy initialization to avoid startup errors) ----
_device = "cuda" if torch.cuda.is_available() else "cpu"
_model = None
_processor = None

def _ensure_model_loaded():
    """Lazy load CLIP model on first use"""
    global _model, _processor
    
    if _model is None:
        print("Loading CLIP model...")
        from transformers import CLIPProcessor, CLIPModel
        
        _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(_device)
        _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _model.eval()
        print("CLIP model loaded successfully")

# IMPROVED Material descriptions - more distinctive for each material
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
        "rough gray concrete with porous texture",
        "industrial cement surface with aggregate",
        "raw unfinished concrete material",
        "gray stone-like concrete texture"
    ],
    "brick": [
        "red rectangular bricks with mortar joints",
        "exposed masonry wall with brick pattern",
        "terracotta colored bricks in rows",
        "textured brick wall with offset pattern"
    ],
    "glass": [
        # CRITICAL: Emphasize hardness, transparency, reflections
        "hard transparent glass window pane",
        "rigid see-through glass surface with reflections",
        "smooth solid glass with mirror-like shine",
        "clear inflexible glass material showing objects behind it",
        "stiff translucent glass barrier with gloss"
    ],
    "curtain": [
        # CRITICAL: Emphasize softness, opacity, fabric texture
        "soft opaque fabric hanging with folds",
        "flexible textile curtain with wrinkles and creases",
        "thick cloth drapery blocking light",
        "hanging fabric material with visible weave texture",
        "limp textile with draped appearance and no transparency"
    ]
}

# HARD CONSTRAINTS - Materials that are VALID for each surface type
_SURFACE_VALID_MATERIALS = {
    "floor": [
        "wood",
        "tile",
        "carpet",
        "concrete"
    ],
    "ceiling": [
        "gypsum",
        "painted_plaster",
        "tile",
        "wood",
        "concrete"
    ],
    "wall": [
        "painted_plaster",
        "gypsum",
        "wood",
        "brick",
        "concrete",
        "glass",
        "tile",
        "curtain"
    ]
}

def crop_by_click(img: Image.Image, x_norm: float, y_norm: float, box_size: int = 160) -> Image.Image:
    """
    x_norm, y_norm are normalized [0..1] click coords relative to original image.
    box_size is crop square size in pixels (in original image space).
    """
    w, h = img.size
    x = int(max(0, min(w - 1, x_norm * w)))
    y = int(max(0, min(h - 1, y_norm * h)))

    half = box_size // 2
    left = max(0, x - half)
    top = max(0, y - half)
    right = min(w, x + half)
    bottom = min(h, y + half)

    return img.crop((left, top, right, bottom))

def suggest_material_from_crop(crop: Image.Image, surface: str) -> dict:
    """
    Use CLIP to match crop against material descriptions.
    Applies HARD CONSTRAINTS based on surface type.
    
    Args:
        crop: PIL Image of the cropped region
        surface: One of "floor", "ceiling", or "wall"
    
    Returns:
        dict with suggested_label, confidence, and candidates
    """
    # Ensure CLIP is loaded
    _ensure_model_loaded()
    
    # Get valid materials for this surface type
    valid_materials = _SURFACE_VALID_MATERIALS.get(surface, list(MVP_LABELS))
    
    # Prepare all text descriptions (ONLY for valid materials)
    all_texts = []
    text_to_material = []
    
    for material, descriptions in _MATERIAL_DESCRIPTIONS.items():
        if material in MVP_LABELS and material in valid_materials:
            for desc in descriptions:
                all_texts.append(desc)
                text_to_material.append(material)
    
    # Handle edge case: no valid materials
    if not all_texts:
        fallback = "painted_plaster" if surface == "wall" else ("gypsum" if surface == "ceiling" else "wood")
        return {
            "surface": surface,
            "suggested_label": fallback,
            "confidence": 0.5,
            "candidates": [{"label": fallback, "confidence": 0.5}],
            "note": "No valid materials found in MVP_LABELS for this surface"
        }
    
    # Process image and text through CLIP
    try:
        inputs = _processor(
            text=all_texts,
            images=crop,
            return_tensors="pt",
            padding=True
        )
        
        # Move to device
        inputs = {k: v.to(_device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = _model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)[0]
    
    except Exception as e:
        print(f"CLIP inference error: {e}")
        fallback = "painted_plaster" if surface == "wall" else ("gypsum" if surface == "ceiling" else "wood")
        return {
            "surface": surface,
            "suggested_label": fallback,
            "confidence": 0.5,
            "candidates": [{"label": fallback, "confidence": 0.5}],
            "note": f"Error during inference: {str(e)}"
        }
    
    # Aggregate scores by material (use MAX instead of AVERAGE for better discrimination)
    material_scores = {}
    for idx, material in enumerate(text_to_material):
        if material not in material_scores:
            material_scores[material] = []
        material_scores[material].append(float(probs[idx].item()))
    
    # Use MAX score instead of average - helps with distinctive descriptions
    material_max_scores = {
        material: max(scores)  # Changed from average to max
        for material, scores in material_scores.items()
    }
    
    # Sort by score
    sorted_materials = sorted(material_max_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Add some debugging info
    print(f"\n=== Material Detection Debug ===")
    print(f"Surface: {surface}")
    print(f"Top 3 matches:")
    for i, (mat, score) in enumerate(sorted_materials[:3]):
        print(f"  {i+1}. {mat}: {score:.3f}")
    print("================================\n")
    
    # Normalize scores to 0-1 range
    if sorted_materials:
        max_score = sorted_materials[0][1]
        if max_score > 0:
            candidates = [(mat, min(1.0, score / max_score * 0.95)) for mat, score in sorted_materials[:5]]
        else:
            candidates = [(mat, 0.5) for mat, score in sorted_materials[:5]]
    else:
        fallback = "painted_plaster" if surface == "wall" else ("gypsum" if surface == "ceiling" else "wood")
        candidates = [(fallback, 0.5)]
    
    best_label, best_conf = candidates[0]
    
    return {
        "surface": surface,
        "suggested_label": best_label,
        "confidence": float(best_conf),
        "candidates": [{"label": lab, "confidence": float(conf)} for lab, conf in candidates],
        "note": f"CLIP zero-shot classification (confidence: {best_conf:.2f})"
    }