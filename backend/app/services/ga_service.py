import random
from typing import List, Dict
from app.services.ml_service import predict_rt60

WALLS = ["north", "south", "east", "west"]

MAX_PANELS = 24        
MIN_PANELS = 6          
TARGET_MIN_PANELS = 10   

OVERLAP_TOL = 0.002      
EDGE_MARGIN = 0.03       

PANEL_SIZES = [
    (0.12, 0.20),  # small
    (0.15, 0.25),  # small-medium
    (0.18, 0.30),
    (0.20, 0.35),
    (0.22, 0.40),
]


def clamp01(x: float) -> float:
    """Clamp value to [0, 1] range"""
    return max(0.0, min(1.0, x))


def rect_area(r: Dict) -> float:
    """Calculate rectangle area"""
    return max(0.0, r["x2"] - r["x1"]) * max(0.0, r["z2"] - r["z1"])


def overlaps(a: Dict, b: Dict) -> bool:
    # tolerance = 0.01  # 1% buffer to prevent touching panels
    tolerance = OVERLAP_TOL
    return not (
        a["x2"] <= b["x1"] + tolerance or
        a["x1"] >= b["x2"] - tolerance or
        a["z2"] <= b["z1"] + tolerance or
        a["z1"] >= b["z2"] - tolerance
    )


def valid_rect(r: Dict) -> bool:
    return (
        0 <= r["x1"] < r["x2"] <= 1 and
        0 <= r["z1"] < r["z2"] <= 1 and
        r["wall"] in WALLS and
        r["x2"] - r["x1"] >= 0.12 and  # Minimum width
        r["z2"] - r["z1"] >= 0.18       # Minimum height
    )


def make_random_panel() -> Dict:
    # Pick a standard size with variation
    w, h = random.choice(PANEL_SIZES)
    
    # Add ±10% variation
    w *= random.uniform(0.9, 1.1)
    h *= random.uniform(0.9, 1.1)
    
    # Clamp to reasonable range
    w = clamp01(max(0.15, min(w, 0.40)))
    h = clamp01(max(0.20, min(h, 0.60)))
    
    # Position with margins (avoid edges)
    margin = EDGE_MARGIN
    x1 = random.uniform(margin, 1.0 - w - margin)
    z1 = random.uniform(margin, 1.0 - h - margin)
    
    return {
        "wall": random.choice(WALLS),
        "x1": x1,
        "x2": x1 + w,
        "z1": z1,
        "z2": z1 + h
    }


def distribute_panels_evenly(n_panels: int) -> List[Dict]:
    panels = []
    panels_per_wall = max(1, n_panels // 4)  # Distribute across 4 walls
    
    for wall in WALLS:
        for i in range(panels_per_wall):
            w, h = random.choice(PANEL_SIZES)
            w *= random.uniform(0.9, 1.1)
            h *= random.uniform(0.9, 1.1)
            
            # Space panels horizontally along wall
            x1 = 0.05 + (i * 0.9 / panels_per_wall)
            z1 = random.uniform(0.15, 0.70 - h)  # Mid-height range
            
            panel = {
                "wall": wall,
                "x1": clamp01(x1),
                "x2": clamp01(x1 + w),
                "z1": clamp01(z1),
                "z2": clamp01(z1 + h),
            }
            
            if valid_rect(panel):
                panels.append(panel)
    
    return panels


def total_coverage(panels: List[Dict]) -> float:
    return sum(rect_area(p) for p in panels)


def violates_exclusions(panels: List[Dict], exclusions: List[Dict]) -> bool:
    for p in panels:
        for ex in exclusions:
            if p["wall"] == ex["wall"] and overlaps(p, ex):
                return True
    return False


def overlap_penalty(panels: List[Dict]) -> float:
    penalty = 0.0
    for i in range(len(panels)):
        for j in range(i + 1, len(panels)):
            a, b = panels[i], panels[j]
            if a["wall"] == b["wall"] and overlaps(a, b):
                # Calculate overlap area
                x_overlap = max(0.0, min(a["x2"], b["x2"]) - max(a["x1"], b["x1"]))
                z_overlap = max(0.0, min(a["z2"], b["z2"]) - max(a["z1"], b["z1"]))
                penalty += x_overlap * z_overlap * 100  # Heavy penalty
    return penalty


def mutate_layout(layout: List[Dict], mutation_rate: float = 0.3) -> List[Dict]:
    new_layout = [dict(p) for p in layout]
    
    for i in range(len(new_layout)):
        if random.random() < mutation_rate:
            p = new_layout[i]
            
            # Choose mutation type
            mut_type = random.random()
            
            if mut_type < 0.4:  # Move panel (40%)
                dx = random.uniform(-0.10, 0.10)
                dz = random.uniform(-0.10, 0.10)
                p["x1"] = clamp01(p["x1"] + dx)
                p["x2"] = clamp01(p["x2"] + dx)
                p["z1"] = clamp01(p["z1"] + dz)
                p["z2"] = clamp01(p["z2"] + dz)
                
            elif mut_type < 0.7:  # Resize panel (30%)
                w = p["x2"] - p["x1"]
                h = p["z2"] - p["z1"]
                
                w *= random.uniform(0.85, 1.15)
                h *= random.uniform(0.85, 1.15)
                
                w = clamp01(max(0.15, min(w, 0.40)))
                h = clamp01(max(0.20, min(h, 0.60)))
                
                p["x2"] = min(1.0, p["x1"] + w)
                p["z2"] = min(1.0, p["z1"] + h)
                
            else:  # Change wall (30%)
                p["wall"] = random.choice(WALLS)
            
            new_layout[i] = p
    
    # Add/remove panels (tuned)
    if random.random() < 0.45 and len(new_layout) < MAX_PANELS:
        new_layout.append(make_random_panel())

    if random.random() < 0.12 and len(new_layout) > MIN_PANELS:
        new_layout.pop(random.randrange(len(new_layout)))
    
    return new_layout


def crossover(a: List[Dict], b: List[Dict]) -> List[Dict]:
    if not a:
        return [dict(p) for p in b]
    if not b:
        return [dict(p) for p in a]
    
    # Take random subset from each parent
    cut_a = random.randint(1, len(a))
    cut_b = random.randint(0, len(b))
    
    child = [dict(p) for p in a[:cut_a]] + [dict(p) for p in b[cut_b:]]
    
    # Limit size
    if len(child) > 12:
        child = random.sample(child, 12)
    
    return child


def fitness(
    layout: List[Dict],
    L: float,
    W: float,
    H: float,
    wall_a: float,
    floor_a: float,
    ceil_a: float,
    exclusions: List[Dict],
    max_coverage: float
) -> float:

    # Hard constraint penalties
    if any(not valid_rect(p) for p in layout):
        return 1e9
    
    if violates_exclusions(layout, exclusions):
        return 1e9
    
    cov = total_coverage(layout)
    if cov > max_coverage:
        return 1e9 + (cov - max_coverage) * 10000
    
    overlap_pen = overlap_penalty(layout)
    if overlap_pen > 0:
        return 1e9 + overlap_pen
    
    panel_coverage = clamp01(cov)
    rt60_after = predict_rt60(L, W, H, wall_a, floor_a, ceil_a, panel_coverage)

    # --- Layout realism terms (Option A) ---
    walls_used = len(set(p["wall"] for p in layout))
    empty_wall_penalty = (4 - walls_used) * 0.15   # tune 0.10 - 0.25

    count_penalty = 0.0
    if len(layout) < TARGET_MIN_PANELS:
        count_penalty = (TARGET_MIN_PANELS - len(layout)) * 0.04  # tune 0.03 - 0.06
    
    # Bonus for better coverage utilization (encourages using available space)
    coverage_bonus = abs(cov - max_coverage) * 0.5
    
    return rt60_after + coverage_bonus + empty_wall_penalty + count_penalty


def run_ga(
    L: float,
    W: float,
    H: float,
    wall_a: float,
    floor_a: float,
    ceil_a: float,
    exclusions: List[Dict],
    max_coverage: float = 0.6,
    population: int = 40,
    generations: int = 30,
    seed: int = None
) -> Dict:
   
    if seed is not None:
        random.seed(seed)
    
    room_vol = L * W * H
    scaled_max_panels = MAX_PANELS + int(room_vol / 30.0)  # tune divisor
    scaled_max_panels = min(scaled_max_panels, 24)  # hard cap safety (tune)


    # Initialize population with diverse strategies
    pop: List[List[Dict]] = []
    
    for _ in range(population // 3):
        n_panels = random.randint(10, 16)   # distributed start
        layout = distribute_panels_evenly(n_panels)
        pop.append(layout)
    
    for _ in range(population - len(pop)):
        n_panels = random.randint(10, 20)   # random start
        layout = [make_random_panel() for _ in range(n_panels)]
        pop.append(layout)
    
    best_layout = None
    best_fit = float("inf")
  
    no_improvement_gens = 0

    for gen in range(generations):
        improved_this_gen = False

        scored = []
        for layout in pop:
            f = fitness(layout, L, W, H, wall_a, floor_a, ceil_a, exclusions, max_coverage)
            scored.append((f, layout))

            if f < best_fit:
                best_fit = f
                best_layout = [dict(p) for p in layout]
                improved_this_gen = True

        if improved_this_gen:
            no_improvement_gens = 0
        else:
            no_improvement_gens += 1

        if no_improvement_gens >= 8:
            break

        scored.sort(key=lambda x: x[0])

        # Elitism: keep top 25%
        elite_count = max(3, int(0.25 * population))
        elites = [layout for _, layout in scored[:elite_count]]
        
        # Create new population
        new_pop = [[dict(p) for p in layout] for layout in elites]
        
        while len(new_pop) < population:
            if random.random() < 0.7:  # 70% crossover
                p1 = random.choice(elites)
                p2 = random.choice(elites)
                child = crossover(p1, p2)
            else:  # 30% fresh random
                n_panels = random.randint(3, 10)
                child = [make_random_panel() for _ in range(n_panels)]
            
            # Mutate
            child = mutate_layout(child, mutation_rate=0.25)
            new_pop.append(child)
        
        pop = new_pop
    
    # Calculate final metrics
    if best_layout is None:
        best_layout = []
    
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
