"""
ga_service.py — AcuVisor panel placement optimiser.

What was wrong and what changed
---------------------------------
Previous versions produced horizontal rows because:
  1. Z_OPTIONS_M = [0.6, 1.2] gave only two heights — and both produce
     a single row of panels at the same height.
  2. The "same size per wall" penalty blocked height variety by preventing
     a 600×1200mm primary cluster + 600×600mm accent cluster on the same wall.
  3. rows=2 never triggered because standard panels (600×1200, 1200×1200)
     exceed MAX_TOP when stacked — only 600×600 can stack, but the GA
     found that acoustically inferior and ignored it.

The fix:
  1. Continuous z positions — clusters can start at any height from 0.6 m
     to MAX_TOP_M - panel_height, in 0.1 m steps. This breaks the
     "everything at the same band" problem.
  2. Remove same-size-per-wall penalty — replace with a penalty only
     for clusters at the SAME height zone on the same wall with different
     sizes. Clusters at clearly different heights on one wall (common in
     real studios) are allowed and rewarded.
  3. Height variety bonus — when a wall has clusters at two different
     heights, the fitness improves. This incentivises the GA to place
     a primary cluster at ear height AND an accent cluster above it.
  4. Warm start seeds both primary (z=0.6) and accent (z=1.8) clusters
     on the front and side walls so the GA starts from a realistic layout.
"""

import hashlib
import random
from typing import Dict, List, Optional, Tuple

from app.services.ml_service import predict_rt60

# ── Constants ─────────────────────────────────────────────────────────────────

WALLS: List[str] = ["north", "south", "east", "west"]

PANEL_SIZES_M: List[Tuple[float, float]] = [
    (0.6, 1.2),   # 0 — tall portrait
    (1.2, 1.2),   # 1 — large square
    (0.6, 0.6),   # 2 — small square / accent panel
]

# Z positions and MAX_TOP scale with room height so panels use the
# full wall in tall rooms, not just the bottom 2.4m.
Z_MIN_M  = 0.6    # panels always start at least 0.6m above floor
Z_STEP_M = 0.1    # 0.1m resolution


def _max_top(H: float) -> float:
    """
    Highest point a panel top can reach.
    Residential (H ≤ 3.2m): cap at 2.4m — standard treatment zone.
    Taller rooms: scale to 75% of wall height so upper wall is used.
    """
    if H <= 3.2:
        return min(float(H) - 0.3, 2.4)
    return min(float(H) - 0.3, float(H) * 0.75)


def _z_options(H: float) -> List[float]:
    """Compute valid panel-bottom heights for this room."""
    z_max_bottom = _max_top(H) - 0.6   # smallest panel (600x600) needs 0.6m above
    n = max(1, int(round((z_max_bottom - Z_MIN_M) / Z_STEP_M)) + 1)
    return [round(Z_MIN_M + i * Z_STEP_M, 1) for i in range(n)]

ZONES: Dict[str, float] = {
    "left_third":  0.30,   # left reflection zone
    "centre":      0.50,   # wall centre
    "right_third": 0.70,   # right reflection zone
}
# Corner zones removed — large clusters anchored at a corner get clamped
# flush to the wall edge, which looks wrong. Three zones always produce
# cleanly placed clusters away from the edges.
ZONE_NAMES = list(ZONES.keys())

PANEL_GAP_M   = 0.05
EDGE_MARGIN_M = 0.25   # 25 cm clearance from wall edges — no cornered panels
# MAX_TOP_M is now computed per-room via _max_top(H)

MAX_CLUSTERS = 8     # allow more clusters so height variety can develop
MIN_PANELS   = 4
MAX_COLS     = 3
MAX_ROWS     = 2
POPULATION   = 40
GENERATIONS  = 50


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ww(wall: str, L: float, W: float) -> float:
    return float(L) if wall in ("north", "south") else float(W)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _seed_from_inputs(L: float, W: float, H: float,
                      wall_a: float, floor_a: float, ceil_a: float,
                      max_coverage: float) -> int:
    key = (f"{L:.4f}_{W:.4f}_{H:.4f}_"
           f"{wall_a:.4f}_{floor_a:.4f}_{ceil_a:.4f}_{max_coverage:.4f}")
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % (2 ** 31)


def _overlaps(a: Dict, b: Dict) -> bool:
    t = 0.001
    return not (
        a["x2"] <= b["x1"] + t or a["x1"] >= b["x2"] - t or
        a["z2"] <= b["z1"] + t or a["z1"] >= b["z2"] - t
    )


# ── Grid cluster placement ────────────────────────────────────────────────────

def _place_grid(
    wall: str, zone: str, size_idx: int,
    cols: int, rows: int, z_bottom: float,
    L: float, W: float, H: float,
    exclusions: List[Dict],
    existing: List[Dict],
) -> Optional[Tuple[List[Dict], float]]:
    """
    Place a cols×rows grid of panels at the given zone and height.
    Returns (panels, normalised_coverage) or None if placement fails.
    """
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

    anchor_x   = ZONES[zone] * wall_w
    x_start    = anchor_x - grid_w / 2.0
    x_clamped  = max(EDGE_MARGIN_M, min(x_start, wall_w - grid_w - EDGE_MARGIN_M))

    # If clamping moved the cluster more than 15 cm from its ideal position,
    # the zone anchor is incompatible with this cluster width — fall back to
    # centering the cluster on the wall instead.  This prevents large clusters
    # from being pushed into corners when placed at a non-centre zone.
    if abs(x_clamped - x_start) > 0.15:
        x_start = (wall_w - grid_w) / 2.0   # true centre
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


# ── Chromosome ────────────────────────────────────────────────────────────────
# Gene = (wall_idx, zone_idx, size_idx, cols, rows, z_idx)
# z_idx indexes into Z_OPTIONS_M (0.6m to 1.9m in 0.1m steps)

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


# ── Fitness ───────────────────────────────────────────────────────────────────

def _fitness(chrom: Chromosome,
             L: float, W: float, H: float,
             wall_a: float, floor_a: float, ceil_a: float,
             max_coverage: float, exclusions: List[Dict]) -> float:

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

    # Bonus: panels at ear-height zone (z_mid 0.9–1.8 m)
    for p in panels:
        z_mid = ((p["z1"] + p["z2"]) / 2.0) * H
        if 0.9 <= z_mid <= 1.8:
            score -= 0.012

    # ── Height variety bonus ──────────────────────────────────────────────────
    # When a wall has clusters at clearly different heights (≥0.4 m apart),
    # it looks natural — a primary cluster at ear height and an accent cluster
    # above it. Reward this arrangement.
    wall_z_bottoms: Dict[str, List[float]] = {}
    for p in panels:
        wall_z_bottoms.setdefault(p["wall"], []).append(p["z1_m"])

    for wall, z_list in wall_z_bottoms.items():
        unique_z = sorted(set(round(z, 1) for z in z_list))
        for i in range(len(unique_z)):
            for j in range(i + 1, len(unique_z)):
                if unique_z[j] - unique_z[i] >= 0.4:
                    score -= 0.04   # bonus per distinct height pair on this wall
                    break

    # ── Penalise walls where 600×600mm is the only panel size ────────────────
    # 600×600mm is valid as an accent above a primary group, but a wall
    # that has ONLY 600×600mm panels has no substantial primary treatment.
    # This penalty prevents accent genes from becoming the dominant cluster
    # on a wall when the primary cluster is lost during crossover.
    wall_max_ph: Dict[str, float] = {}
    for p in panels:
        ph = round(p["panel_h_m"], 2)
        wall_max_ph[p["wall"]] = max(wall_max_ph.get(p["wall"], 0.0), ph)
    for wall, max_ph in wall_max_ph.items():
        if max_ph < 1.19:   # wall's tallest panel is 600×600 — no primary treatment
            score += 0.35

    # ── Mixed-size penalty only at the same height ────────────────────────────
    # Two clusters on the same wall at the same height but different sizes
    # looks wrong. Two clusters at different heights with different sizes
    # is fine (primary + accent is a real pattern).
    wall_height_sizes: Dict[str, Dict[float, set]] = {}
    for p in panels:
        z_band = round(p["z1_m"], 1)
        wall_height_sizes.setdefault(p["wall"], {}).setdefault(z_band, set()).add(
            (round(p["panel_w_m"], 2), round(p["panel_h_m"], 2))
        )
    for wall, height_map in wall_height_sizes.items():
        for z_band, sizes in height_map.items():
            if len(sizes) > 1:
                score += 0.25   # penalise different sizes at same height

    return score


# ── Genetic operators ─────────────────────────────────────────────────────────

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
                # Mutate z_idx — prefer nearby heights for small moves
                current = g[5]
                delta   = random.choice([-2, -1, 1, 2])
                g[5]    = max(0, current + delta)  # clipped in decode
            child[gi] = g

    return [tuple(g) for g in child]


# ── Warm start ────────────────────────────────────────────────────────────────

def _z_idx(z: float, H: float = 2.8) -> int:
    """Return the z_options index closest to the given z value."""
    opts = _z_options(H)
    return min(range(len(opts)), key=lambda i: abs(opts[i] - z))


def _warm_start(L: float, W: float, H: float,
                max_coverage: float) -> Chromosome:
    """
    Starting layout based on standard acoustic treatment practice.

    Primary clusters at ear height (z=0.6m), accent clusters at z=1.8m
    above the primary groups on front and side walls. This gives the GA
    a realistic starting point with height variety already present.

      North — primary row at centre (z=0.6) + accent above (z=1.8)
      South — primary row at centre (z=0.6)
      East  — primary at left_third (z=0.6) + accent above (z=1.8)
      West  — primary at right_third (z=0.6, mirrored)
    """
    avg_ww         = (2 * L + 2 * W) / 4.0
    norm_per_panel = (0.6 / avg_ww) * (1.2 / H)
    budget_panels  = max(4, int(max_coverage / (norm_per_panel + 1e-9)))
    per_wall       = max(1, min(3, budget_panels // 4))

    # z indices for standard positions
    z_primary = _z_idx(0.6, H)   # ear height — primary panels
    z_accent  = _z_idx(min(1.8, _max_top(H) - 0.6), H)  # above primary

    # Primary clusters only in warm start — no accent genes.
    # Accent clusters (600x600mm at z=1.8m) are discovered by the GA
    # through the height variety bonus in fitness. Seeding them here
    # caused them to compete with primary clusters during crossover and
    # occasionally replace the primary treatment entirely on a wall.
    chrom: Chromosome = [
        (0, ZONE_NAMES.index("centre"),      0, per_wall, 1, z_primary),  # north
        (1, ZONE_NAMES.index("centre"),      0, per_wall, 1, z_primary),  # south
        (2, ZONE_NAMES.index("left_third"),  0, per_wall, 1, z_primary),  # east
        (3, ZONE_NAMES.index("right_third"), 0, per_wall, 1, z_primary),  # west
    ]

    return chrom


# ── Main GA ───────────────────────────────────────────────────────────────────

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
) -> Dict:
    """
    Optimise acoustic panel placement using zone-based grid cluster chromosomes.

    Key improvements over previous versions:
    - Continuous z positions (0.6–1.9 m in 0.1 m steps) break the
      single-row-height pattern that made layouts look generic.
    - Height variety bonus rewards walls with clusters at two different
      heights — primary panels at ear height plus accent panels above.
    - Mixed-size penalty applies only to clusters at the same height;
      different heights on one wall can have different sizes (natural).
    - Warm start includes accent clusters at z=1.8 m so the GA begins
      from a layout with height variety already present.

    seed=None → deterministic from room inputs (same room = same result).
    """
    if seed is None:
        seed = _seed_from_inputs(L, W, H, wall_a, floor_a, ceil_a, max_coverage)
    random.seed(seed)

    warm = _warm_start(L, W, H, max_coverage)

    pop: List[Chromosome] = [warm]
    while len(pop) < population:
        pop.append(_rand_chrom())

    best_chrom = list(warm)
    best_fit   = _fitness(warm, L, W, H, wall_a, floor_a, ceil_a,
                          max_coverage, exclusions)
    no_improve = 0

    for _gen in range(generations):
        scored, improved = [], False

        for chrom in pop:
            f = _fitness(chrom, L, W, H, wall_a, floor_a, ceil_a,
                         max_coverage, exclusions)
            scored.append((f, chrom))
            if f < best_fit:
                best_fit   = f
                best_chrom = list(chrom)
                improved   = True

        no_improve = 0 if improved else no_improve + 1
        if no_improve >= 12:
            break

        scored.sort(key=lambda x: x[0])
        elite_n = max(4, population // 4)
        elites  = [c for _, c in scored[:elite_n]]

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

    best_panels, used_cov = decode(best_chrom, L, W, H, exclusions)
    used_cov = _clamp01(used_cov)

    rt60_before = float(predict_rt60(L, W, H, wall_a, floor_a, ceil_a, 0.0))
    rt60_after  = float(predict_rt60(L, W, H, wall_a, floor_a, ceil_a, used_cov))

    return {
        "used_coverage": float(used_cov),
        "rt60_before":   rt60_before,
        "rt60_after":    rt60_after,
        "rt60_delta":    float(rt60_before - rt60_after),
        "panels":        best_panels,
    }