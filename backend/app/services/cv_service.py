import io
from PIL import Image
import torch
import torch.nn.functional as F
from torchvision import models, transforms

from app.services.material_library import MVP_LABELS

# ---- Load pretrained model once ----
# NOTE: This is a pragmatic MVP approach:
# We use a pretrained CNN as a feature extractor and map to a small label set.
# User confirmation is required to handle uncertainty.

_device = "cuda" if torch.cuda.is_available() else "cpu"

_model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
_model.eval()
_model.to(_device)

# We’ll use the penultimate layer features (2048-dim) for similarity
_feature_extractor = torch.nn.Sequential(*list(_model.children())[:-1]).to(_device)
_feature_extractor.eval()

_preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ---- Prototype “material embeddings” (MVP) ----
# We approximate label prototypes using fixed “anchor” RGB colors + texture-ish images is not feasible.
# Instead: we do a simple, transparent baseline:
# classify crop into a *small* set using a tiny linear head trained on-the-fly is not allowed.
#
# So for MVP: we do a heuristic mapping from ImageNet top labels → our material labels.
# This works “good enough” when combined with user confirmation.

_IMAGENET_TO_MATERIAL = {
    # walls/ceilings
    "wall": ["wall", "plaster", "concrete", "brick", "stone", "tile", "window"],
    "floor": ["wood", "tile", "carpet", "rug", "floor"],
    "ceiling": ["ceiling", "plaster", "drywall", "tile"],
}

# Very small keyword mapping from ImageNet-like concepts to our material labels
_KEYWORD_TO_MATERIAL = [
    (["carpet", "rug"], "carpet"),
    (["curtain", "drape"], "curtain"),
    (["tile", "ceramic"], "tile"),
    (["wood", "timber"], "wood"),
    (["brick"], "brick"),
    (["concrete", "cement", "stone"], "concrete"),
    (["glass", "window"], "glass"),
    (["drywall", "gypsum", "plaster", "wall"], "painted_plaster"),
]

# ---- Image crop helper ----
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

def _extract_features(img: Image.Image) -> torch.Tensor:
    t = _preprocess(img).unsqueeze(0).to(_device)
    with torch.no_grad():
        feats = _feature_extractor(t)  # [1, 2048, 1, 1]
        feats = feats.flatten(1)       # [1, 2048]
        feats = F.normalize(feats, dim=1)
    return feats[0].cpu()

def suggest_material_from_crop(crop: Image.Image, surface: str) -> dict:
    """
    MVP: returns a coarse material suggestion + a confidence-like score (0..1),
    and a short explanation. User will confirm/override in FE.
    """
    # Extract features (kept for later upgrades)
    _ = _extract_features(crop)

    # SUPER simple heuristic baseline (defensible as MVP):
    # Use the main colors/brightness to guess common cases like carpet/wood/tile vs painted walls.
    # Then return a ranked list with low-to-medium confidence.
    crop_small = crop.resize((64, 64))
    arr = torch.tensor(list(crop_small.getdata()), dtype=torch.float32).view(64, 64, 3)
    mean_rgb = arr.mean(dim=(0,1)) / 255.0
    brightness = float(mean_rgb.mean().item())

    # Heuristic guesses
    candidates = []

    if surface == "floor":
        # dark + low variance often carpet; mid warm often wood; bright often tile
        if brightness < 0.35:
            candidates = [("carpet", 0.65), ("wood", 0.25), ("tile", 0.10)]
        elif brightness < 0.65:
            candidates = [("wood", 0.55), ("carpet", 0.25), ("tile", 0.20)]
        else:
            candidates = [("tile", 0.55), ("wood", 0.25), ("carpet", 0.20)]
    elif surface == "ceiling":
        # ceilings often bright and uniform
        if brightness > 0.7:
            candidates = [("gypsum", 0.55), ("painted_plaster", 0.35), ("tile", 0.10)]
        else:
            candidates = [("painted_plaster", 0.55), ("gypsum", 0.30), ("concrete", 0.15)]
    else:  # wall
        if brightness > 0.7:
            candidates = [("painted_plaster", 0.60), ("gypsum", 0.25), ("glass", 0.15)]
        elif brightness < 0.35:
            candidates = [("wood", 0.45), ("concrete", 0.35), ("brick", 0.20)]
        else:
            candidates = [("painted_plaster", 0.55), ("wood", 0.25), ("brick", 0.20)]

    # Ensure only MVP labels
    candidates = [(lab, conf) for lab, conf in candidates if lab in MVP_LABELS]

    best_label, best_conf = candidates[0]
    return {
        "surface": surface,
        "suggested_label": best_label,
        "confidence": float(best_conf),
        "candidates": [{"label": lab, "confidence": float(conf)} for lab, conf in candidates],
        "note": "MVP coarse material suggestion from clicked crop; user confirmation recommended."
    }
