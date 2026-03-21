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


def clamp_position(x, y, z, L, W, H, margin=0.05):
    x = float(np.clip(float(x), margin, float(L) - margin))
    y = float(np.clip(float(y), margin, float(W) - margin))
    z = float(np.clip(float(z), margin, float(H) - margin))
    return x, y, z


def resolve_positions(L, W, H, src_x=None, src_y=None, src_z=None, mic_x=None, mic_y=None, mic_z=None):
    default_src = (float(L) / 4.0, float(W) / 4.0, min(1.5, float(H) - 0.05))
    default_mic = (float(L) / 2.0, float(W) / 2.0, min(1.5, float(H) - 0.05))

    src = (
        default_src[0] if src_x is None else src_x,
        default_src[1] if src_y is None else src_y,
        default_src[2] if src_z is None else src_z,
    )
    mic = (
        default_mic[0] if mic_x is None else mic_x,
        default_mic[1] if mic_y is None else mic_y,
        default_mic[2] if mic_z is None else mic_z,
    )

    src = clamp_position(*src, L, W, H)
    mic = clamp_position(*mic, L, W, H)

    return src, mic


def build_room(L, W, H, wall_a, floor_a, ceil_a, src_pos, mic_pos, max_order=30):
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

    mic = np.array([[mic_pos[0]], [mic_pos[1]], [mic_pos[2]]], dtype=np.float32)
    src = np.array([src_pos[0], src_pos[1], src_pos[2]], dtype=np.float32)

    room.add_microphone_array(mic)
    room.add_source(src)

    return room


def panel_coverage_from_rects(panels):
    cov = 0.0
    for p in panels:
        cov += max(0.0, p["x2"] - p["x1"]) * max(0.0, p["z2"] - p["z1"])
    return float(np.clip(cov, 0.0, 1.0))


def boosted_wall_absorption(wall_a, panels, boost_strength=0.5):
    cov = panel_coverage_from_rects(panels)
    return float(np.clip(float(wall_a) + cov * float(boost_strength), 0.0, 0.95))


def compute_rir(room):
    room.compute_rir()
    rir = np.asarray(room.rir[0][0], dtype=np.float32)
    return rir


def estimate_rt60_t30(rir):
    rir = np.asarray(rir, dtype=np.float64)

    edc = np.cumsum(rir[::-1] ** 2)[::-1]
    edc = edc / (edc[0] + 1e-12)
    edc_db = 10.0 * np.log10(edc + 1e-12)

    def fit_rt60(db_start, db_end):
        idx = np.where((edc_db <= db_start) & (edc_db >= db_end))[0]
        if len(idx) < 20:
            return None
        t = idx / FS
        y = edc_db[idx]
        a, b = np.polyfit(t, y, 1)
        if a >= 0:
            return None
        return float(-60.0 / a)

    rt = fit_rt60(-5.0, -35.0)
    if rt is None:
        rt = fit_rt60(-5.0, -25.0)
    return rt if rt is not None else float("nan")


def save_wav(path, audio):
    sf.write(path, audio, FS)


def load_and_resample_dry_wav():
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    sample_path = os.path.join(SAMPLES_DIR, "dry_speech.wav")

    if not os.path.exists(sample_path):
        x = np.zeros(FS * 2, dtype=np.float32)
        x[0] = 1.0
        return x

    x, fs_in = sf.read(sample_path)
    x = np.asarray(x, dtype=np.float32)

    if x.ndim > 1:
        x = x.mean(axis=1)

    peak = np.max(np.abs(x)) + 1e-6
    x = x / peak * 0.8

    if fs_in != FS:
        g = np.gcd(int(fs_in), int(FS))
        up = FS // g
        down = int(fs_in) // g
        x = resample_poly(x, up, down).astype(np.float32)

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
    n = int(fs * length_sec)
    x = np.zeros(n, dtype=np.float32)

    x[0] = 1.0

    burst_len = int(0.01 * fs)
    x[:burst_len] += 0.6 * np.random.randn(burst_len).astype(np.float32)

    env = np.exp(-np.linspace(0, 6, n)).astype(np.float32)
    x *= env

    peak = np.max(np.abs(x)) + 1e-6
    x = x / peak * 0.9
    return x


def generate_audio(
    L,
    W,
    H,
    wall_a,
    floor_a,
    ceil_a,
    panels,
    src_x=None,
    src_y=None,
    src_z=None,
    mic_x=None,
    mic_y=None,
    mic_z=None,
):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    short = uuid.uuid4().hex[:6]
    run_folder = f"{ts}_{short}"
    run_dir = os.path.join(AUDIO_DIR, run_folder)
    os.makedirs(run_dir, exist_ok=True)

    dry = load_and_resample_dry_wav()

    src_pos, mic_pos = resolve_positions(
        L, W, H,
        src_x=src_x, src_y=src_y, src_z=src_z,
        mic_x=mic_x, mic_y=mic_y, mic_z=mic_z,
    )

    room_before = build_room(
        L, W, H, wall_a, floor_a, ceil_a,
        src_pos=src_pos,
        mic_pos=mic_pos,
        max_order=35,
    )
    rir_before = compute_rir(room_before)
    rt60_before = estimate_rt60_t30(rir_before)

    wall_a_after = boosted_wall_absorption(wall_a, panels, boost_strength=0.5)
    room_after = build_room(
        L, W, H, wall_a_after, floor_a, ceil_a,
        src_pos=src_pos,
        mic_pos=mic_pos,
        max_order=30,
    )
    rir_after = compute_rir(room_after)
    rt60_after = estimate_rt60_t30(rir_after)

    if (rt60_before == rt60_before) and (rt60_after == rt60_after) and (rt60_after > rt60_before):
        rt60_flag = "rt60_after_gt_before_check_decay_fit"
    else:
        rt60_flag = "ok"

    clap = make_clap()
    clap_before = convolve_wet(clap, rir_before)
    clap_after = convolve_wet(clap, rir_after)

    clap_before_file = "clap_before.wav"
    clap_after_file = "clap_after.wav"
    save_wav(os.path.join(run_dir, clap_before_file), clap_before)
    save_wav(os.path.join(run_dir, clap_after_file), clap_after)

    wet_before = convolve_wet(dry, rir_before)
    wet_after = convolve_wet(dry, rir_after)

    speech_before = mix_wet_dry(dry, wet_before, wet_ratio=0.35)
    speech_after = mix_wet_dry(dry, wet_after, wet_ratio=0.35)

    speech_before_file = "speech_before.wav"
    speech_after_file = "speech_after.wav"
    save_wav(os.path.join(run_dir, speech_before_file), speech_before)
    save_wav(os.path.join(run_dir, speech_after_file), speech_after)

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
        "source_position": {
            "x": float(src_pos[0]),
            "y": float(src_pos[1]),
            "z": float(src_pos[2]),
        },
        "listener_position": {
            "x": float(mic_pos[0]),
            "y": float(mic_pos[1]),
            "z": float(mic_pos[2]),
        },
    }