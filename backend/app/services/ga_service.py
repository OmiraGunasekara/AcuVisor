import random
from turtle import pen
from typing import List, Dict, Tuple
from app.services.ml_service import predict_rt60

WALLS = ["north", "south", "east", "west"]

def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))

def rect_area(r: Dict) -> float:
    return max(0.0, r["x2"] - r["x1"]) * max(0.0, r["z2"] - r["z1"])

def overlaps(a: Dict, b: Dict) -> bool:
    return not (a["x2"] <= b["x1"] or a["x1"] >= b["x2"] or a["z2"] <= b["z1"] or a["z1"] >= b["z2"])

def valid_rect(r: Dict) -> bool:
    return 0 <= r["x1"] < r["x2"] <= 1 and 0 <= r["z1"] < r["z2"] <= 1 and r["wall"] in WALLS

def make_random_panel() -> Dict:
    # panel size range (normalized)
    w = random.uniform(0.18, 0.35)
    h = random.uniform(0.25, 0.50)
    # x1 = random.uniform(0.0, 1.0 - w)
    # z1 = random.uniform(0.0, 1.0 - h)

    #added margins to avoid too close to edges
    margin = 0.02
    x1 = random.uniform(margin, 1.0 - w - margin)
    z1 = random.uniform(margin, 1.0 - h - margin)
    r = {
        "wall": random.choice(WALLS),
        "x1": x1,
        "x2": x1 + w,
        "z1": z1,
        "z2": z1 + h
    }
    return r

def total_coverage(panels: List[Dict]) -> float:
    # MVP: treat total area in normalized space as "coverage"
    return sum(rect_area(p) for p in panels)

def violates_exclusions(panels: List[Dict], exclusions: List[Dict]) -> bool:
    for p in panels:
        for ex in exclusions:
            if p["wall"] == ex["wall"] and overlaps(p, ex):
                return True
    return False

def mutate_layout(layout: List[Dict], mutation_rate: float = 0.25) -> List[Dict]:
    new_layout = [dict(p) for p in layout]
    for i in range(len(new_layout)):
        if random.random() < mutation_rate:
            # randomly shift or resize
            p = new_layout[i]
            dx = random.uniform(-0.08, 0.08)
            dz = random.uniform(-0.08, 0.08)
            dw = random.uniform(-0.05, 0.05)
            dh = random.uniform(-0.05, 0.05)

            x1 = clamp01(p["x1"] + dx)
            z1 = clamp01(p["z1"] + dz)
            w = clamp01((p["x2"] - p["x1"]) + dw)
            h = clamp01((p["z2"] - p["z1"]) + dh)

            # keep minimum sizes
            w = max(0.12, min(w, 0.5))
            h = max(0.18, min(h, 0.7))

            x2 = min(1.0, x1 + w)
            z2 = min(1.0, z1 + h)

            # if squashed, adjust back
            if x2 - x1 < 0.1: x2 = min(1.0, x1 + 0.1)
            if z2 - z1 < 0.15: z2 = min(1.0, z1 + 0.15)

            p["x1"], p["x2"], p["z1"], p["z2"] = x1, x2, z1, z2

            if random.random() < 0.15:
                p["wall"] = random.choice(WALLS)

            new_layout[i] = p

    # sometimes add/remove a panel
    if random.random() < 0.20 and len(new_layout) < 6:
        new_layout.append(make_random_panel())
    if random.random() < 0.15 and len(new_layout) > 1:
        new_layout.pop(random.randrange(len(new_layout)))

    return new_layout

def crossover(a: List[Dict], b: List[Dict]) -> List[Dict]:
    if not a: return b
    if not b: return a
    cut_a = random.randrange(len(a))
    cut_b = random.randrange(len(b))
    child = [dict(p) for p in a[:cut_a]] + [dict(p) for p in b[cut_b:]]
    # limit size
    return child[:6] if len(child) > 6 else child

def fitness(layout: List[Dict],
            L: float, W: float, H: float,
            wall_a: float, floor_a: float, ceil_a: float,
            exclusions: List[Dict],
            max_coverage: float) -> float:
    # Hard penalties
    if any(not valid_rect(p) for p in layout):
        return 1e6
    if violates_exclusions(layout, exclusions):
        return 1e6

    cov = total_coverage(layout)
    if cov > max_coverage:
        return 1e6 + (cov - max_coverage) * 1000

    # Convert layout coverage -> panel_coverage feature (0..1) for MLP
    panel_coverage = clamp01(cov)

    rt60_after = predict_rt60(L, W, H, wall_a, floor_a, ceil_a, panel_coverage)

    pen = overlap_penalty(layout)
    if pen > 0:
        return 1e6 + pen * 10000  # strong penalty so GA avoids overlap

    return rt60_after  # minimize

def run_ga(L: float, W: float, H: float,
           wall_a: float, floor_a: float, ceil_a: float,
           exclusions: List[Dict],
           max_coverage: float = 0.6,
           population: int = 30,
           generations: int = 25,
           seed: int = 42) -> Dict:
    random.seed(seed)

    # init population
    pop: List[List[Dict]] = []
    for _ in range(population):
        n = random.randint(1, 5)
        layout = [make_random_panel() for _ in range(n)]
        pop.append(layout)

    best_layout = None
    best_fit = float("inf")

    for _gen in range(generations):
        scored = []
        for layout in pop:
            f = fitness(layout, L, W, H, wall_a, floor_a, ceil_a, exclusions, max_coverage)
            scored.append((f, layout))
            if f < best_fit:
                best_fit = f
                best_layout = layout

        scored.sort(key=lambda x: x[0])

        # elitism: keep top 30%
        elite_count = max(2, int(0.3 * population))
        elites = [layout for _, layout in scored[:elite_count]]

        # make new population
        new_pop = elites[:]
        while len(new_pop) < population:
            p1 = random.choice(elites)
            p2 = random.choice(elites)
            child = crossover(p1, p2)
            child = mutate_layout(child, mutation_rate=0.25)
            new_pop.append(child)

        pop = new_pop

    # Produce outputs
    used_cov = clamp01(total_coverage(best_layout))
    rt60_before = predict_rt60(L, W, H, wall_a, floor_a, ceil_a, 0.0)
    rt60_after = predict_rt60(L, W, H, wall_a, floor_a, ceil_a, used_cov)

    return {
        "used_coverage": float(used_cov),
        "rt60_before": float(rt60_before),
        "rt60_after": float(rt60_after),
        "rt60_delta": float(rt60_before - rt60_after),
        "panels": best_layout
    }

def overlap_penalty(panels: List[Dict]) -> float:
    penalty = 0.0
    for i in range(len(panels)):
        for j in range(i + 1, len(panels)):
            a, b = panels[i], panels[j]
            if a["wall"] == b["wall"] and overlaps(a, b):
                # penalize by overlapped area approximation
                x_overlap = max(0.0, min(a["x2"], b["x2"]) - max(a["x1"], b["x1"]))
                z_overlap = max(0.0, min(a["z2"], b["z2"]) - max(a["z1"], b["z1"]))
                penalty += x_overlap * z_overlap
    return penalty
