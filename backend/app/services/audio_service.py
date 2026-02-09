import os
import uuid
import numpy as np
import pyroomacoustics as pra
import soundfile as sf
from scipy.signal import fftconvolve

AUDIO_DIR = "app/static/audio"
SAMPLES_DIR = "app/static/samples"
FS = 16000

def build_room(L, W, H, wall_a, floor_a, ceil_a):
    # Use uniform absorption coefficients (MVP simplification)
    # Works reliably across pyroomacoustics versions.
    mat = pra.Material(energy_absorption=float(wall_a))
    mat_floor = pra.Material(energy_absorption=float(floor_a))
    mat_ceil = pra.Material(energy_absorption=float(ceil_a))

    # ShoeBox expects either a single Material or a dict/list depending on version.
    # Most compatible approach: give a single Material for walls, then treat floor/ceiling via "materials" dict if supported.
    # If your version doesn't support dict, we'll still be OK with uniform wall material (MVP).
    try:
        materials = {
            "east": mat, "west": mat, "north": mat, "south": mat,
            "floor": mat_floor, "ceiling": mat_ceil
        }
        # room = pra.ShoeBox([L, W, H], fs=FS, materials=materials, max_order=10)
        room = pra.ShoeBox(
            [L, W, H],
            fs=FS,
            materials=materials,
            max_order=17,           # <-- MORE reflections (longer decay)
            air_absorption=True     # <-- Realistic high-frequency damping
        )
    except Exception:
        # Fallback: uniform material
        room = pra.ShoeBox([L, W, H], fs=FS, materials=mat, max_order=10)

    # Source + mic (fixed for MVP, later can be user-controlled)
    mic = np.array([[L / 2], [W / 2], [1.5]])
    src = np.array([[L / 4], [W / 4], [1.5]])

    room.add_microphone_array(mic)
    room.add_source(src)
    return room

def panel_coverage_from_rects(panels):
    cov = 0.0
    for p in panels:
        cov += max(0.0, p["x2"] - p["x1"]) * max(0.0, p["z2"] - p["z1"])
    # cov is in [0..~] depending on count; clamp for MVP
    return float(max(0.0, min(1.0, cov)))

def boost_wall_absorption(wall_a, panels, extra_absorption=0.4):
    cov = panel_coverage_from_rects(panels)
    boost = min(0.6, cov * extra_absorption)
    return float(min(0.99, max(0.0, wall_a + boost)))

def compute_rir(room):
    room.compute_rir()
    rir = room.rir[0][0]
    return np.asarray(rir, dtype=np.float32)

def estimate_rt60_schroeder(rir):
    # Works with many versions; if it errors, we fall back gracefully.
    try:
        return float(pra.experimental.measure_rt60(rir, fs=FS))
    except Exception:
        # Fallback: return NaN rather than crashing
        return float("nan")

def save_wav(path, audio):
    sf.write(path, audio, FS)

def load_sample_dry_wav():
    """
    Put a file here:
      app/static/samples/dry_speech.wav
    If it doesn't exist, we generate a short simple impulse-like click (still useful).
    """
    sample_path = os.path.join(SAMPLES_DIR, "dry_speech.wav")
    if os.path.exists(sample_path):
        x, fs = sf.read(sample_path)
        if fs != FS:
            # simple resample is not included; keep MVP simple: just slice/assume FS
            # Best practice: ensure your sample is 16kHz.
            pass
        x = np.asarray(x, dtype=np.float32)
        if x.ndim > 1:
            x = x.mean(axis=1)  # mono
        return x[:FS * 3]  # 3 seconds max for MVP
    # fallback: a short click
    x = np.zeros(FS, dtype=np.float32)
    x[0] = 1.0
    return x

# def apply_rir(dry, rir):
#     y = fftconvolve(dry, rir)[: len(dry)]
#     # normalize to prevent clipping
#     m = np.max(np.abs(y)) + 1e-9
#     y = (y / m) * 0.9
#     return y.astype(np.float32)
def apply_rir(dry, rir):
    y = fftconvolve(dry, rir)
    y = y[: len(dry)]

    # light normalization only (do NOT squash dynamics)
    peak = np.max(np.abs(y)) + 1e-6
    y = y / peak

    return y.astype(np.float32)

def generate_audio(L, W, H, wall_a, floor_a, ceil_a, panels):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(SAMPLES_DIR, exist_ok=True)

    uid = uuid.uuid4().hex[:8]

    # BEFORE
    room_before = build_room(L, W, H, wall_a, floor_a, ceil_a)
    rir_before = compute_rir(room_before)

    # Perceptual decay emphasis (for audibility)
    rir_before = rir_before * np.exp(np.linspace(0, 1.2, len(rir_before)))

    rt60_before = estimate_rt60_schroeder(rir_before)

    # AFTER (rebuild room with boosted wall absorption)
    wall_a_after = boost_wall_absorption(wall_a, panels, extra_absorption=0.4)
    room_after = build_room(L, W, H, wall_a_after, floor_a, ceil_a)
    rir_after = compute_rir(room_after)

    # Perceptual decay emphasis (for audibility)
    rir_after = rir_after * np.exp(np.linspace(0, 1.2, len(rir_after)))

    rt60_after = estimate_rt60_schroeder(rir_after)

    # Save RIRs (click/impulse-like)
    before_rir_file = f"rir_before_{uid}.wav"
    after_rir_file  = f"rir_after_{uid}.wav"
    save_wav(os.path.join(AUDIO_DIR, before_rir_file), rir_before)
    save_wav(os.path.join(AUDIO_DIR, after_rir_file), rir_after)

    # Also generate speech preview by convolving a dry sample
    dry = load_sample_dry_wav()
    speech_before = apply_rir(dry, rir_before)
    speech_after  = apply_rir(dry, rir_after)

    before_speech_file = f"speech_before_{uid}.wav"
    after_speech_file  = f"speech_after_{uid}.wav"
    save_wav(os.path.join(AUDIO_DIR, before_speech_file), speech_before)
    save_wav(os.path.join(AUDIO_DIR, after_speech_file), speech_after)

    return {
        "rir_before_audio": f"/static/audio/{before_rir_file}",
        "rir_after_audio": f"/static/audio/{after_rir_file}",
        "speech_before_audio": f"/static/audio/{before_speech_file}",
        "speech_after_audio": f"/static/audio/{after_speech_file}",
        "rt60_before": rt60_before,
        "rt60_after": rt60_after,
        "rt60_delta": (rt60_before - rt60_after) if (rt60_before == rt60_before and rt60_after == rt60_after) else None,
        "effective_wall_a_before": float(wall_a),
        "effective_wall_a_after": float(wall_a_after),
    }
