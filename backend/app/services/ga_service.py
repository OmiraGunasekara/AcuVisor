import hashlib
import random
from typing import Dict, List, Optional, Tuple

from app.services.ml_service import predict_rt60

# -- Constants ---------------------------------------------------------------

WALLS: List[str] = ["north", "south", "east", "west"]

PANEL_SIZES_M: List[Tuple[float, float]] = [
    (0.6, 1.2),   # 0 - tall portrait
    (1.2, 1.2),   # 1 - large square
    (0.6, 0.6),   # 2 - small square / accent panel
]

Z_MIN_M  = 0.6
Z_STEP_M = 0.1


def _max_top(H: float) -> float:
    if H <= 3.2:
        return min(float(H) - 0.3, 2.4)
    return min(float(H) - 0.3, float(H) * 0.75)


def _z_options(H: float) -> List[float]:
    z_max_bottom = _max_top(H) - 0.6
    n = max(1, int(round((z_max_bottom - Z_MIN_M) / Z_STEP_M)) + 1)
    return [round(Z_MIN_M + i * Z_STEP_M, 1) for i in range(n)]


ZONES: Dict[str, float] = {
    "left_third":  0.30,
    "centre":      0.50,
    "right_third": 0.70,
}
ZONE_NAMES = list(ZONES.keys())

PANEL_GAP_M   = 0.05
EDGE_MARGIN_M = 0.25
SOURCE_WALL_BLOCK_TRIGGER_M = 0.3
SOURCE_WALL_BLOCK_HALF_WIDTH_M = 0.35
SOURCE_WALL_BLOCK_HALF_HEIGHT_M = 0.4

MAX_CLUSTERS = 8
MIN_PANELS   = 4
MAX_COLS     = 3
MAX_ROWS     = 2
POPULATION   = 40
GENERATIONS  = 50


# -- Helpers ----------------------------------------------------------------

def _ww(wall: str, L: float, W: float) -> float:
    return float(L) if wall in ("north", "south") else float(W)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _seed_from_inputs(L: float, W: float, H: float,
                      wall_a: float, floor_a: float, ceil_a: float,
                      max_coverage: float,
                      src: Optional[List[float]] = None,
                      mic: Optional[List[float]] = None) -> int:
    src_key = (
        "none"
        if not src else
        f"{float(src[0]):.4f}_{float(src[1]):.4f}_{float(src[2]):.4f}"
    )
    mic_key = (
        "none"
        if not mic else
        f"{float(mic[0]):.4f}_{float(mic[1]):.4f}_{float(mic[2]):.4f}"
    )
    key = (f"{L:.4f}_{W:.4f}_{H:.4f}_"
           f"{wall_a:.4f}_{floor_a:.4f}_{ceil_a:.4f}_{max_coverage:.4f}_"
           f"{src_key}_{mic_key}")
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % (2 ** 31)


def _overlaps(a: Dict, b: Dict) -> bool:
    t = 0.001
    return not (
        a["x2"] <= b["x1"] + t or a["x1"] >= b["x2"] - t or
        a["z2"] <= b["z1"] + t or a["z1"] >= b["z2"] - t
    )


def _clamp_position(pos: List[float], L: float, W: float, H: float) -> List[float]:
    margin = 0.05
    return [
        max(margin, min(float(L) - margin, float(pos[0]))),
        max(margin, min(float(W) - margin, float(pos[1]))),
        max(margin, min(float(H) - margin, float(pos[2]))),
    ]



def _source_near_wall_exclusions(
    L: float,
    W: float,
    H: float,
    src: Optional[List[float]],
) -> List[Dict]:

    if not src:
        return []

    sx, sy, sz = _clamp_position(src, L, W, H)
    wall_distances = [
        ("south", sy),
        ("north", W - sy),
        ("west", sx),
        ("east", L - sx),
    ]
    wall, distance = min(wall_distances, key=lambda item: item[1])
    if distance > SOURCE_WALL_BLOCK_TRIGGER_M:
        return []

    wall_w = _ww(wall, L, W)
    wall_h = float(H)
    along_wall_m = sx if wall in ("north", "south") else sy

    x1_m = max(0.0, along_wall_m - SOURCE_WALL_BLOCK_HALF_WIDTH_M)
    x2_m = min(wall_w, along_wall_m + SOURCE_WALL_BLOCK_HALF_WIDTH_M)
    z1_m = max(0.0, sz - SOURCE_WALL_BLOCK_HALF_HEIGHT_M)
    z2_m = min(wall_h, sz + SOURCE_WALL_BLOCK_HALF_HEIGHT_M)

    if x2_m - x1_m < 0.05 or z2_m - z1_m < 0.05:
        return []

    return [{
        "wall": wall,
        "x1": _clamp01(x1_m / wall_w),
        "x2": _clamp01(x2_m / wall_w),
        "z1": _clamp01(z1_m / wall_h),
        "z2": _clamp01(z2_m / wall_h),
    }]

# -- First-reflection geometry ----------------------------------------------

def _first_reflection_fracs(
    L: float, W: float,
    src: List[float],
    mic: List[float],
) -> Dict[str, float]:

    if not src or not mic:
        return {}

    sx, sy = float(src[0]), float(src[1])
    mx, my = float(mic[0]), float(mic[1])
    fracs: Dict[str, float] = {}

    try:
        # North wall at y=W: mirror source across y=W, find x crossing
        denom = (2 * W - sy) - my
        if abs(denom) > 1e-6:
            t = (W - my) / denom
            fracs["north"] = (mx + t * (sx - mx)) / L

        # South wall at y=0: mirror source across y=0
        denom = (-sy) - my
        if abs(denom) > 1e-6:
            t = (0 - my) / denom
            fracs["south"] = (mx + t * (sx - mx)) / L

        # East wall at x=L: mirror source across x=L, find y crossing
        denom = (2 * L - sx) - mx
        if abs(denom) > 1e-6:
            t = (L - mx) / denom
            fracs["east"] = (my + t * (sy - my)) / W

        # West wall at x=0: mirror source across x=0
        denom = (-sx) - mx
        if abs(denom) > 1e-6:
            t = (0 - mx) / denom
            fracs["west"] = (my + t * (sy - my)) / W

    except Exception:
        return {}

    # Clamp to [0.05, 0.95] - reflection must actually land on the wall
    return {wall: max(0.05, min(0.95, float(frac)))
            for wall, frac in fracs.items()}


# -- Grid cluster placement --------------------------------------------------

def _place_grid(
    wall: str, zone: str, size_idx: int,
    cols: int, rows: int, z_bottom: float,
    L: float, W: float, H: float,
    exclusions: List[Dict],
    existing: List[Dict],
) -> Optional[Tuple[List[Dict], float]]:
    pw_m, ph_m = PANEL_SIZES_M[size_idx]
    wall_w = _ww(wall, L, W)
    wall_h = float(H)

    grid_w = pw_m * cols + PANEL_GAP_M * (cols - 1)
    grid_h = ph_m * rows + PANEL_GAP_M * (rows - 1)

    z_top = z_bottom + grid_h
    if z_top > _max_top(H) or z_top > wall_h - 0.05:
        return None
    if grid_w > wall_w - 2 * EDGE_MARGIN_M:
        return None

    anchor_x  = ZONES[zone] * wall_w
    x_start   = anchor_x - grid_w / 2.0
    x_clamped = max(EDGE_MARGIN_M, min(x_start, wall_w - grid_w - EDGE_MARGIN_M))

    if abs(x_clamped - x_start) > 0.15:
        x_start = (wall_w - grid_w) / 2.0
        x_start = max(EDGE_MARGIN_M, min(x_start, wall_w - grid_w - EDGE_MARGIN_M))
    else:
        x_start = x_clamped

    panels: List[Dict] = []
    norm_area = 0.0

    for row in range(rows):
        for col in range(cols):
            x1_m = x_start + col * (pw_m + PANEL_GAP_M)
            z1_m = z_bottom + row * (ph_m + PANEL_GAP_M)
            x2_m = x1_m + pw_m
            z2_m = z1_m + ph_m

            panel = {
                "wall":      wall,
                "x1":        x1_m / wall_w,
                "x2":        _clamp01(x2_m / wall_w),
                "z1":        z1_m / wall_h,
                "z2":        _clamp01(z2_m / wall_h),
                "x1_m":      round(x1_m, 3),
                "x2_m":      round(x2_m, 3),
                "z1_m":      round(z1_m, 3),
                "z2_m":      round(z2_m, 3),
                "panel_w_m": pw_m,
                "panel_h_m": ph_m,
            }

            if any(panel["wall"] == ex["wall"] and _overlaps(panel, ex)
                   for ex in exclusions):
                return None
            if any(panel["wall"] == ep["wall"] and _overlaps(panel, ep)
                   for ep in existing):
                return None

            panels.append(panel)
            norm_area += (pw_m / wall_w) * (ph_m / wall_h)

    return panels, norm_area


# -- Chromosome --------------------------------------------------------------

Gene       = Tuple[int, int, int, int, int, int]
Chromosome = List[Gene]


def _rand_gene() -> Gene:
    return (
        random.randrange(len(WALLS)),
        random.randrange(len(ZONE_NAMES)),
        random.randrange(len(PANEL_SIZES_M)),
        random.randint(1, MAX_COLS),
        random.randint(1, MAX_ROWS),
        random.randrange(20),  # clipped to valid range in decode
    )


def _rand_chrom() -> Chromosome:
    return [_rand_gene() for _ in range(random.randint(3, MAX_CLUSTERS))]


def decode(chrom: Chromosome,
           L: float, W: float, H: float,
           exclusions: List[Dict]) -> Tuple[List[Dict], float]:
    all_panels: List[Dict] = []
    total_cov = 0.0
    for gene in chrom:
        wi, zi, si, cols, rows, z_idx = gene
        z_opts = _z_options(H)
        if z_idx >= len(z_opts):
            z_idx = len(z_opts) - 1
        result = _place_grid(
            WALLS[wi], ZONE_NAMES[zi], si,
            cols, rows, z_opts[z_idx],
            L, W, H, exclusions, all_panels
        )
        if result:
            panels, cov = result
            all_panels.extend(panels)
            total_cov  += cov
    return all_panels, total_cov


# -- Fitness -----------------------------------------------------------------

def _fitness(chrom: Chromosome,
             L: float, W: float, H: float,
             wall_a: float, floor_a: float, ceil_a: float,
             max_coverage: float, exclusions: List[Dict],
             src: Optional[List[float]] = None,
             mic: Optional[List[float]] = None) -> float:

    panels, cov = decode(chrom, L, W, H, exclusions)

    if cov > max_coverage + 1e-6:
        return 1e9 + (cov - max_coverage) * 1000.0
    if len(panels) < MIN_PANELS:
        return 1e9

    rt60  = predict_rt60(L, W, H, wall_a, floor_a, ceil_a, _clamp01(cov))
    score = float(rt60)

    # Penalise walls with no treatment
    walls_used = len(set(p["wall"] for p in panels))
    score += (4 - walls_used) * 0.25

    # Penalise under-using coverage budget
    score += abs(cov - max_coverage) * 0.15

    # Bonus: panels at ear-height zone (z_mid 0.9-1.8 m)
    for p in panels:
        z_mid = ((p["z1"] + p["z2"]) / 2.0) * H
        if 0.9 <= z_mid <= 1.8:
            score -= 0.012

    # -- Height variety bonus ------------------------------------------------
    wall_z_bottoms: Dict[str, List[float]] = {}
    for p in panels:
        wall_z_bottoms.setdefault(p["wall"], []).append(p["z1_m"])

    for wall, z_list in wall_z_bottoms.items():
        unique_z = sorted(set(round(z, 1) for z in z_list))
        for i in range(len(unique_z)):
            for j in range(i + 1, len(unique_z)):
                if unique_z[j] - unique_z[i] >= 0.4:
                    score -= 0.04
                    break

    # -- Penalise walls where 600x600mm is the only panel size ---------------
    wall_max_ph: Dict[str, float] = {}
    for p in panels:
        ph = round(p["panel_h_m"], 2)
        wall_max_ph[p["wall"]] = max(wall_max_ph.get(p["wall"], 0.0), ph)
    for wall, max_ph in wall_max_ph.items():
        if max_ph < 1.19:
            score += 0.35

    # -- Mixed-size penalty only at the same height --------------------------
    wall_height_sizes: Dict[str, Dict[float, set]] = {}
    for p in panels:
        z_band = round(p["z1_m"], 1)
        wall_height_sizes.setdefault(p["wall"], {}).setdefault(z_band, set()).add(
            (round(p["panel_w_m"], 2), round(p["panel_h_m"], 2))
        )
    for wall, height_map in wall_height_sizes.items():
        for z_band, sizes in height_map.items():
            if len(sizes) > 1:
                score += 0.25

    # -- First-reflection bonus ----------------------------------------------
    # Panels placed near the first reflection point absorb the most
    # acoustically critical early reflections. Bonus is kept small
    # (~0.01 per panel) so it guides placement without overriding RT60.
    if src and mic:
        fracs = _first_reflection_fracs(L, W, src, mic)
        for p in panels:
            wall = p["wall"]
            if wall not in fracs:
                continue
            ww = _ww(wall, L, W)
            panel_centre_frac = (p["x1"] + p["x2"]) / 2.0
            dist_m = abs(panel_centre_frac - fracs[wall]) * ww
            if dist_m < 0.4:   # within 40 cm of reflection point
                score -= 0.01  # small bonus per qualifying panel

    return score


# -- Genetic operators -------------------------------------------------------

def _crossover(a: Chromosome, b: Chromosome) -> Chromosome:
    if not a: return list(b)
    if not b: return list(a)
    cut_a = random.randint(0, len(a))
    cut_b = random.randint(0, len(b))
    child = a[:cut_a] + b[cut_b:]
    return child[:MAX_CLUSTERS] or [_rand_gene()]


def _mutate(chrom: Chromosome) -> Chromosome:
    child = [list(g) for g in chrom]
    r = random.random()

    if r < 0.20 and len(child) > 2:
        child.pop(random.randrange(len(child)))
    elif r < 0.45 and len(child) < MAX_CLUSTERS:
        child.append(list(_rand_gene()))
    else:
        if child:
            gi = random.randrange(len(child))
            fi = random.randrange(6)
            g  = child[gi]
            if   fi == 0: g[0] = random.randrange(len(WALLS))
            elif fi == 1: g[1] = random.randrange(len(ZONE_NAMES))
            elif fi == 2: g[2] = random.randrange(len(PANEL_SIZES_M))
            elif fi == 3: g[3] = max(1, min(MAX_COLS, g[3] + random.choice([-1, 1])))
            elif fi == 4: g[4] = max(1, min(MAX_ROWS, g[4] + random.choice([-1, 1])))
            else:
                current = g[5]
                delta   = random.choice([-2, -1, 1, 2])
                g[5]    = max(0, current + delta)
            child[gi] = g

    return [tuple(g) for g in child]


# -- Warm start --------------------------------------------------------------

def _z_idx(z: float, H: float = 2.8) -> int:
    opts = _z_options(H)
    return min(range(len(opts)), key=lambda i: abs(opts[i] - z))


def _warm_start(L: float, W: float, H: float,
                max_coverage: float) -> Chromosome:

    avg_ww         = (2 * L + 2 * W) / 4.0
    norm_per_panel = (0.6 / avg_ww) * (1.2 / H)
    budget_panels  = max(4, int(max_coverage / (norm_per_panel + 1e-9)))
    per_wall       = max(1, min(3, budget_panels // 4))
    z_primary      = _z_idx(0.6, H)

    return [
        (0, ZONE_NAMES.index("centre"),      0, per_wall, 1, z_primary),  # north
        (1, ZONE_NAMES.index("centre"),      0, per_wall, 1, z_primary),  # south
        (2, ZONE_NAMES.index("left_third"),  0, per_wall, 1, z_primary),  # east
        (3, ZONE_NAMES.index("right_third"), 0, per_wall, 1, z_primary),  # west
    ]


# -- Main GA -----------------------------------------------------------------

def run_ga(
    L: float,
    W: float,
    H: float,
    wall_a: float,
    floor_a: float,
    ceil_a: float,
    exclusions: List[Dict],
    max_coverage: float = 0.5,
    population: int = POPULATION,
    generations: int = GENERATIONS,
    seed: int = None,
    src: Optional[List[float]] = None,
    mic: Optional[List[float]] = None,
) -> Dict:

    # Use canonical positions if not provided by caller
    if src is None:
        src = [L / 4.0, W / 4.0, min(1.5, H - 0.05)]
    if mic is None:
        mic = [L / 2.0, W / 2.0, min(1.5, H - 0.05)]

    src = _clamp_position(src, L, W, H)
    mic = _clamp_position(mic, L, W, H)
    source_clearance_zones = _source_near_wall_exclusions(L, W, H, src)
    effective_exclusions = list(exclusions) + source_clearance_zones

    if seed is None:
        seed = _seed_from_inputs(L, W, H, wall_a, floor_a, ceil_a, max_coverage, src, mic)
    random.seed(seed)

    warm = _warm_start(L, W, H, max_coverage)

    pop: List[Chromosome] = [warm]
    while len(pop) < population:
        pop.append(_rand_chrom())

    best_chrom = list(warm)
    best_fit = _fitness(
        warm, L, W, H, wall_a, floor_a, ceil_a,
        max_coverage, effective_exclusions, src, mic
    )
    no_improve = 0

    # --- GA history tracking for analysis / plotting ---
    generation_history: List[int] = []
    best_fitness_history: List[float] = []
    mean_fitness_history: List[float] = []
    best_coverage_history: List[float] = []
    best_panel_count_history: List[int] = []

    for _gen in range(generations):
        scored = []
        improved = False

        for chrom in pop:
            f = _fitness(
                chrom, L, W, H, wall_a, floor_a, ceil_a,
                max_coverage, effective_exclusions, src, mic
            )
            scored.append((f, chrom))
            if f < best_fit:
                best_fit = f
                best_chrom = list(chrom)
                improved = True

        scored.sort(key=lambda x: x[0])

        # Record generation statistics before selection/reproduction
        gen_best_fit = float(scored[0][0])
        gen_mean_fit = float(sum(f for f, _ in scored) / len(scored))

        gen_best_panels, gen_best_cov = decode(scored[0][1], L, W, H, effective_exclusions)

        generation_history.append(_gen)
        best_fitness_history.append(gen_best_fit)
        mean_fitness_history.append(gen_mean_fit)
        best_coverage_history.append(float(_clamp01(gen_best_cov)))
        best_panel_count_history.append(len(gen_best_panels))

        no_improve = 0 if improved else no_improve + 1
        if no_improve >= 12:
            break

        elite_n = max(4, population // 4)
        elites = [c for _, c in scored[:elite_n]]

        if warm not in elites:
            elites[-1] = warm

        new_pop = [list(e) for e in elites]

        while len(new_pop) < population:
            r = random.random()
            if r < 0.60:
                child = _crossover(*random.sample(elites, 2))
            elif r < 0.85:
                child = _mutate(random.choice(elites))
            else:
                child = _rand_chrom()
            new_pop.append(child)

        pop = new_pop

    best_panels, used_cov = decode(best_chrom, L, W, H, effective_exclusions)
    used_cov = _clamp01(used_cov)

    rt60_before = float(predict_rt60(L, W, H, wall_a, floor_a, ceil_a, 0.0))
    rt60_after = float(predict_rt60(L, W, H, wall_a, floor_a, ceil_a, used_cov))

    return {
        "used_coverage": float(used_cov),
        "rt60_before": rt60_before,
        "rt60_after": rt60_after,
        "rt60_delta": float(rt60_before - rt60_after),
        "applied_exclusions": effective_exclusions,
        "source_clearance_zones": source_clearance_zones,
        "panels": best_panels,
        "ga_history": {
            "generation": generation_history,
            "best_fitness": best_fitness_history,
            "mean_fitness": mean_fitness_history,
            "best_coverage": best_coverage_history,
            "best_panel_count": best_panel_count_history,
            "early_stopped": no_improve >= 12,
            "generations_completed": len(generation_history),
        },
    }
