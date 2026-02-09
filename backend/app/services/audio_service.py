# import os
# import uuid
# import numpy as np
# import pyroomacoustics as pra
# import soundfile as sf
# from scipy.signal import fftconvolve, resample_poly

# AUDIO_DIR = "app/static/audio"
# SAMPLES_DIR = "app/static/samples"
# FS = 16000


# def build_room(L, W, H, wall_a, floor_a, ceil_a, max_order=20):
#     """
#     Uses pra.make_materials like your notebook (most compatible + realistic).
#     """
#     materials = pra.make_materials(
#         ceiling=float(ceil_a),
#         floor=float(floor_a),
#         east=float(wall_a),
#         west=float(wall_a),
#         north=float(wall_a),
#         south=float(wall_a),
#     )

#     room = pra.ShoeBox(
#         [float(L), float(W), float(H)],
#         fs=FS,
#         materials=materials,
#         max_order=int(max_order),
#         air_absorption=True,
#     )

#     # Fixed MVP positions (later you can expose these to FE)
#     mic = np.array([[L / 2], [W / 2], [1.5]])
#     src = np.array([[L / 4], [W / 4], [1.5]])

#     room.add_microphone_array(mic)
#     room.add_source(src)

#     return room


# def panel_coverage_from_rects(panels):
#     cov = 0.0
#     for p in panels:
#         cov += max(0.0, p["x2"] - p["x1"]) * max(0.0, p["z2"] - p["z1"])
#     return float(np.clip(cov, 0.0, 1.0))


# def boosted_wall_absorption(wall_a, panels, boost_strength=0.5):
#     """
#     MVP physical approximation:
#     more panel coverage => higher effective wall absorption
#     """
#     cov = panel_coverage_from_rects(panels)
#     return float(np.clip(wall_a + cov * boost_strength, 0.0, 0.95))


# def compute_rir(room):
#     room.compute_rir()
#     rir = np.asarray(room.rir[0][0], dtype=np.float32)
#     return rir


# def estimate_rt60_schroeder(rir):
#     # This is what you used in notebook-style logic
#     try:
#         return float(pra.experimental.measure_rt60(rir, fs=FS))
#     except Exception:
#         return float("nan")


# def load_and_resample_dry_wav():
#     """
#     Loads app/static/samples/dry_speech.wav.
#     Resamples properly to FS=16000 so convolution is correct.
#     """
#     os.makedirs(SAMPLES_DIR, exist_ok=True)
#     sample_path = os.path.join(SAMPLES_DIR, "dry_speech.wav")

#     if not os.path.exists(sample_path):
#         # fallback click if missing
#         x = np.zeros(FS * 2, dtype=np.float32)
#         x[0] = 1.0
#         return x

#     x, fs_in = sf.read(sample_path)
#     x = np.asarray(x, dtype=np.float32)
#     if x.ndim > 1:
#         x = x.mean(axis=1)  # mono

#     # Normalize dry slightly (keep natural dynamics)
#     peak = np.max(np.abs(x)) + 1e-6
#     x = x / peak * 0.8

#     # Proper resample to 16k
#     if fs_in != FS:
#         # resample_poly is high quality and stable
#         g = np.gcd(fs_in, FS)
#         up = FS // g
#         down = fs_in // g
#         x = resample_poly(x, up, down).astype(np.float32)

#     # Keep ~4 seconds (good for hearing decay)
#     max_len = FS * 4
#     if len(x) > max_len:
#         x = x[:max_len]

#     return x


# def convolve_wet(dry, rir):
#     y = fftconvolve(dry, rir)[:len(dry)]
#     # normalize lightly
#     peak = np.max(np.abs(y)) + 1e-6
#     y = y / peak * 0.9
#     return y.astype(np.float32)


# def mix_wet_dry(dry, wet, wet_ratio=0.35):
#     """
#     Makes speech intelligible while still hearing room effect.
#     """
#     wet_ratio = float(np.clip(wet_ratio, 0.0, 1.0))
#     out = (1.0 - wet_ratio) * dry + wet_ratio * wet
#     peak = np.max(np.abs(out)) + 1e-6
#     out = out / peak * 0.9
#     return out.astype(np.float32)


# def save_wav(path, audio):
#     sf.write(path, audio, FS)

# def make_clap(fs=FS, length_sec=1.5):
#     n = int(fs * length_sec)
#     x = np.zeros(n, dtype=np.float32)
#     x[0] = 1.0  # impulse start
#     # short noise burst like a hand clap
#     burst_len = int(0.01 * fs)  # 10ms
#     x[:burst_len] += 0.6 * (np.random.randn(burst_len).astype(np.float32))
#     # gentle decay envelope
#     env = np.exp(-np.linspace(0, 6, n)).astype(np.float32)
#     x = x * env
#     # normalize
#     x = x / (np.max(np.abs(x)) + 1e-6) * 0.9
#     return x



# def generate_audio(L, W, H, wall_a, floor_a, ceil_a, panels):
#     os.makedirs(AUDIO_DIR, exist_ok=True)

#     uid = uuid.uuid4().hex[:8]

#     # DRY signal (speech)
#     dry = load_and_resample_dry_wav()

#     # BEFORE room
#     room_before = build_room(L, W, H, wall_a, floor_a, ceil_a, max_order=20)
#     rir_before = compute_rir(room_before)
#     rt60_before = estimate_rt60_schroeder(rir_before)

#     # AFTER room (boost wall absorption based on panel layout)
#     wall_a_after = boosted_wall_absorption(wall_a, panels, boost_strength=0.5)
#     room_after = build_room(L, W, H, wall_a_after, floor_a, ceil_a, max_order=20)
#     rir_after = compute_rir(room_after)
#     rt60_after = estimate_rt60_schroeder(rir_after)

#     # Save RIRs as audio (click-like)
#     rir_before_file = f"rir_before_{uid}.wav"
#     rir_after_file = f"rir_after_{uid}.wav"
#     save_wav(os.path.join(AUDIO_DIR, rir_before_file), rir_before)
#     save_wav(os.path.join(AUDIO_DIR, rir_after_file), rir_after)

#     # Speech auralisation (wet + mix)
#     wet_before = convolve_wet(dry, rir_before)
#     wet_after = convolve_wet(dry, rir_after)

#     speech_before = mix_wet_dry(dry, wet_before, wet_ratio=0.35)
#     speech_after = mix_wet_dry(dry, wet_after, wet_ratio=0.35)

#     speech_before_file = f"speech_before_{uid}.wav"
#     speech_after_file = f"speech_after_{uid}.wav"
#     save_wav(os.path.join(AUDIO_DIR, speech_before_file), speech_before)
#     save_wav(os.path.join(AUDIO_DIR, speech_after_file), speech_after)

#     return {
#         "rir_before_audio": f"/static/audio/{rir_before_file}",
#         "rir_after_audio": f"/static/audio/{rir_after_file}",
#         "speech_before_audio": f"/static/audio/{speech_before_file}",
#         "speech_after_audio": f"/static/audio/{speech_after_file}",
#         "rt60_before": rt60_before,
#         "rt60_after": rt60_after,
#         "rt60_delta": (rt60_before - rt60_after) if (rt60_before == rt60_before and rt60_after == rt60_after) else None,
#         "effective_wall_a_before": float(wall_a),
#         "effective_wall_a_after": float(wall_a_after),
#         "panel_coverage": panel_coverage_from_rects(panels),
#     }

# backend/app/services/audio_service.py

import os
import uuid
from datetime import datetime
import numpy as np
import pyroomacoustics as pra
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly

AUDIO_DIR = "app/static/audio"
SAMPLES_DIR = "app/static/samples"
FS = 16000


def build_room(L, W, H, wall_a, floor_a, ceil_a, max_order=30):
    """
    Uses pra.make_materials (like your notebook style), with air_absorption enabled.
    """
    materials = pra.make_materials(
        ceiling=float(ceil_a),
        floor=float(floor_a),
        east=float(wall_a),
        west=float(wall_a),
        north=float(wall_a),
        south=float(wall_a),
    )

    room = pra.ShoeBox(
        [float(L), float(W), float(H)],
        fs=FS,
        materials=materials,
        max_order=int(max_order),
        air_absorption=True,
    )

    # MVP fixed positions (later can expose speaker/mic positions)
    mic = np.array([[L / 2], [W / 2], [1.5]])
    src = np.array([[L / 4], [W / 4], [1.5]])

    room.add_microphone_array(mic)
    room.add_source(src)

    return room


def panel_coverage_from_rects(panels):
    cov = 0.0
    for p in panels:
        cov += max(0.0, p["x2"] - p["x1"]) * max(0.0, p["z2"] - p["z1"])
    return float(np.clip(cov, 0.0, 1.0))


def boosted_wall_absorption(wall_a, panels, boost_strength=0.5):
    """
    MVP physical approximation:
    more panel coverage -> higher effective wall absorption
    """
    cov = panel_coverage_from_rects(panels)
    return float(np.clip(float(wall_a) + cov * float(boost_strength), 0.0, 0.95))


def compute_rir(room):
    room.compute_rir()
    rir = np.asarray(room.rir[0][0], dtype=np.float32)
    return rir


# def estimate_rt60_schroeder(rir):
#     try:
#         return float(pra.experimental.measure_rt60(rir, fs=FS))
#     except Exception:
#         return float("nan")

def estimate_rt60_t30(rir):
    """
    Robust RT60 estimate using Schroeder EDC + linear fit (T30 style).
    Fits between -5 dB and -35 dB when possible, else falls back to -5..-25 (T20).
    """
    rir = np.asarray(rir, dtype=np.float64)

    # Energy decay curve (Schroeder integration)
    edc = np.cumsum(rir[::-1] ** 2)[::-1]
    edc = edc / (edc[0] + 1e-12)
    edc_db = 10.0 * np.log10(edc + 1e-12)

    def fit_rt60(db_start, db_end):
        idx = np.where((edc_db <= db_start) & (edc_db >= db_end))[0]
        if len(idx) < 20:
            return None
        t = idx / FS
        y = edc_db[idx]
        # Linear regression y = a*t + b
        a, b = np.polyfit(t, y, 1)
        if a >= 0:
            return None
        # RT60 is time to decay 60 dB
        return float(-60.0 / a)

    rt = fit_rt60(-5.0, -35.0)  # T30 range
    if rt is None:
        rt = fit_rt60(-5.0, -25.0)  # T20 fallback
    return rt if rt is not None else float("nan")


def save_wav(path, audio):
    sf.write(path, audio, FS)


def load_and_resample_dry_wav():
    """
    Loads app/static/samples/dry_speech.wav and resamples properly to 16k.
    """
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    sample_path = os.path.join(SAMPLES_DIR, "dry_speech.wav")

    if not os.path.exists(sample_path):
        # fallback: 2s click (not ideal, but prevents crash)
        x = np.zeros(FS * 2, dtype=np.float32)
        x[0] = 1.0
        return x

    x, fs_in = sf.read(sample_path)
    x = np.asarray(x, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)  # mono

    # light normalize dry
    peak = np.max(np.abs(x)) + 1e-6
    x = x / peak * 0.8

    # Proper resample to FS
    if fs_in != FS:
        g = np.gcd(int(fs_in), int(FS))
        up = FS // g
        down = int(fs_in) // g
        x = resample_poly(x, up, down).astype(np.float32)

    # keep ~4 seconds (good for hearing decay)
    max_len = FS * 4
    if len(x) > max_len:
        x = x[:max_len]

    return x


def convolve_wet(dry, rir):
    y = fftconvolve(dry, rir)
    y = y[: len(dry)]
    peak = np.max(np.abs(y)) + 1e-6
    y = y / peak * 0.9
    return y.astype(np.float32)


def mix_wet_dry(dry, wet, wet_ratio=0.35):
    wet_ratio = float(np.clip(wet_ratio, 0.0, 1.0))
    out = (1.0 - wet_ratio) * dry + wet_ratio * wet
    peak = np.max(np.abs(out)) + 1e-6
    out = out / peak * 0.9
    return out.astype(np.float32)


def make_clap(fs=FS, length_sec=1.5):
    """
    A short impulse + brief noise burst (hand-clap-ish).
    This produces a clearer before/after than saving raw RIR as audio.
    """
    n = int(fs * length_sec)
    x = np.zeros(n, dtype=np.float32)

    # impulse at start
    x[0] = 1.0

    # 10ms noise burst
    burst_len = int(0.01 * fs)
    x[:burst_len] += 0.6 * np.random.randn(burst_len).astype(np.float32)

    # decay envelope
    env = np.exp(-np.linspace(0, 6, n)).astype(np.float32)
    x *= env

    # normalize
    peak = np.max(np.abs(x)) + 1e-6
    x = x / peak * 0.9
    return x


def generate_audio(L, W, H, wall_a, floor_a, ceil_a, panels):
    """
    Generates 4 files in a per-run subfolder:
      - clap_before.wav, clap_after.wav
      - speech_before.wav, speech_after.wav

    BEFORE: room with given materials, no extra panel boost
    AFTER:  same room but with boosted wall absorption based on panel coverage
    """

    # Create a unique folder per run: YYYYMMDD_HHMMSS_xxxxxx
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    short = uuid.uuid4().hex[:6]
    run_folder = f"{ts}_{short}"
    run_dir = os.path.join(AUDIO_DIR, run_folder)
    os.makedirs(run_dir, exist_ok=True)

    # DRY speech
    dry = load_and_resample_dry_wav()

    # BEFORE room
    room_before = build_room(L, W, H, wall_a, floor_a, ceil_a, max_order=35)
    rir_before = compute_rir(room_before)
    # rt60_before = estimate_rt60_schroeder(rir_before)
    rt60_before = estimate_rt60_t30(rir_before)

    # AFTER room (boost wall absorption from panel layout)
    wall_a_after = boosted_wall_absorption(wall_a, panels, boost_strength=0.5)
    room_after = build_room(L, W, H, wall_a_after, floor_a, ceil_a, max_order=30)
    rir_after = compute_rir(room_after)
    # rt60_after = estimate_rt60_schroeder(rir_after)
    rt60_after  = estimate_rt60_t30(rir_after)

    if (rt60_before == rt60_before) and (rt60_after == rt60_after) and (rt60_after > rt60_before):
    # Logically should not happen if absorption increased.
    # Keep values but expose a flag so you can explain in demo/report.
        rt60_flag = "rt60_after_gt_before_check_decay_fit"
    else:
        rt60_flag = "ok"

    # CLAP auralisation (clearer than raw RIR audio)
    clap = make_clap()
    clap_before = convolve_wet(clap, rir_before)
    clap_after = convolve_wet(clap, rir_after)

    clap_before_file = f"clap_before.wav"
    clap_after_file = f"clap_after.wav"
    save_wav(os.path.join(run_dir, clap_before_file), clap_before)
    save_wav(os.path.join(run_dir, clap_after_file), clap_after)

    # SPEECH auralisation (wet + dry mix to keep intelligible)
    wet_before = convolve_wet(dry, rir_before)
    wet_after = convolve_wet(dry, rir_after)

    speech_before = mix_wet_dry(dry, wet_before, wet_ratio=0.35)
    speech_after = mix_wet_dry(dry, wet_after, wet_ratio=0.35)

    speech_before_file = f"speech_before.wav"
    speech_after_file = f"speech_after.wav"
    save_wav(os.path.join(run_dir, speech_before_file), speech_before)
    save_wav(os.path.join(run_dir, speech_after_file), speech_after)

    # Return URLs for FE
    return {
        "run_folder": run_folder,
        "clap_before_audio": f"/static/audio/{run_folder}/{clap_before_file}",
        "clap_after_audio": f"/static/audio/{run_folder}/{clap_after_file}",
        "speech_before_audio": f"/static/audio/{run_folder}/{speech_before_file}",
        "speech_after_audio": f"/static/audio/{run_folder}/{speech_after_file}",
        "rt60_before": rt60_before,
        "rt60_after": rt60_after,
        "rt60_delta": (rt60_before - rt60_after)
        if (rt60_before == rt60_before and rt60_after == rt60_after)
        else None,
        "effective_wall_a_before": float(wall_a),
        "effective_wall_a_after": float(wall_a_after),
        "panel_coverage": panel_coverage_from_rects(panels),
        "rt60_check_flag": rt60_flag,
    }
