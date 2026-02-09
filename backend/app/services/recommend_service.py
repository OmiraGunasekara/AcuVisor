VALID_WALLS = {"north", "south", "east", "west"}

def _rect_area(r):
    return max(0.0, r["x2"] - r["x1"]) * max(0.0, r["z2"] - r["z1"])

def _clamp01(v):
    return float(max(0.0, min(1.0, v)))

def _normalize_rect(wall, x1, x2, z1, z2):
    x1, x2 = sorted([_clamp01(x1), _clamp01(x2)])
    z1, z2 = sorted([_clamp01(z1), _clamp01(z2)])
    return {"wall": wall, "x1": x1, "x2": x2, "z1": z1, "z2": z2}

def _overlaps(a, b):
    return not (a["x2"] <= b["x1"] or a["x1"] >= b["x2"] or a["z2"] <= b["z1"] or a["z1"] >= b["z2"])

def _apply_exclusions(candidate, exclusions):
    for ex in exclusions:
        if ex["wall"] == candidate["wall"] and _overlaps(candidate, ex):
            return False
    return True

def recommend_panels(target_coverage: float, exclusions: list[dict]) -> dict:
    candidates = [
        _normalize_rect("north", 0.15, 0.45, 0.25, 0.65),
        _normalize_rect("north", 0.55, 0.85, 0.25, 0.65),
        _normalize_rect("east",  0.20, 0.50, 0.25, 0.65),
        _normalize_rect("west",  0.20, 0.50, 0.25, 0.65),
        _normalize_rect("south", 0.35, 0.65, 0.30, 0.60),
    ]

    panels = []
    used_area = 0.0

    for c in candidates:
        if not _apply_exclusions(c, exclusions):
            continue
        a = _rect_area(c)
        if used_area + a <= target_coverage + 1e-6:
            panels.append(c)
            used_area += a
        if used_area >= target_coverage:
            break

    return {"used_coverage": float(used_area), "panels": panels}
