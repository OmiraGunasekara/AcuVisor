import io
import math
import os
import shutil
import uuid
from datetime import datetime
import numpy as np
import pyroomacoustics as pra
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly

AUDIO_DIR = "app/static/audio"
SAMPLES_DIR = "app/static/samples"
FS = 32000
MAX_AUDIO_RUN_FOLDERS = 10


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
    return trim_rir(rir)


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


def cleanup_audio_run_folders(audio_dir, keep_latest=MAX_AUDIO_RUN_FOLDERS, exclude_paths=None):
    os.makedirs(audio_dir, exist_ok=True)
    exclude_paths = {os.path.abspath(path) for path in (exclude_paths or [])}

    run_dirs = []
    for name in os.listdir(audio_dir):
        full_path = os.path.join(audio_dir, name)
        abs_path = os.path.abspath(full_path)
        if abs_path in exclude_paths or not os.path.isdir(full_path):
            continue
        try:
            mtime = os.path.getmtime(full_path)
        except OSError:
            continue
        run_dirs.append((mtime, full_path))

    run_dirs.sort(key=lambda item: item[0])
    overflow = max(0, len(run_dirs) + len(exclude_paths) - int(keep_latest))

    for _, folder in run_dirs[:overflow]:
        shutil.rmtree(folder, ignore_errors=True)


def rms(x):
    x = np.asarray(x, dtype=np.float32)
    return float(np.sqrt(np.mean(x ** 2) + 1e-12))


def normalize_audio(x, peak=0.92):
    x = np.asarray(x, dtype=np.float32)
    current_peak = float(np.max(np.abs(x)) + 1e-9)
    if current_peak <= 1e-8:
        return x.astype(np.float32)
    return (x / current_peak * float(peak)).astype(np.float32)


def apply_fades(x, fade_ms=12.0):
    x = np.asarray(x, dtype=np.float32).copy()
    fade_len = min(len(x) // 4, max(16, int(FS * float(fade_ms) / 1000.0)))
    if fade_len <= 1:
        return x
    fade_in = np.linspace(0.0, 1.0, fade_len, dtype=np.float32)
    fade_out = fade_in[::-1]
    x[:fade_len] *= fade_in
    x[-fade_len:] *= fade_out
    return x


def trim_rir(rir, cutoff_db=55.0):
    rir = np.asarray(rir, dtype=np.float32)
    if rir.size == 0:
        return rir

    abs_rir = np.abs(rir)
    peak = float(np.max(abs_rir) + 1e-9)
    threshold = peak * (10.0 ** (-float(cutoff_db) / 20.0))
    active = np.where(abs_rir >= threshold)[0]

    if len(active) == 0:
        return rir[:1]

    keep_until = int(active[-1]) + 1
    keep_until = max(keep_until, min(len(rir), int(FS * 0.08)))
    return rir[:keep_until]


def align_tail_length(signal, tail_samples):
    signal = np.asarray(signal, dtype=np.float32)
    keep_len = min(len(signal), max(1, tail_samples))
    return signal[:keep_len]


def prepare_dry_audio(x, fs_in, max_len_sec=8):
    x = np.asarray(x, dtype=np.float32)

    if x.ndim > 1:
        x = x.mean(axis=1)

    if x.size == 0:
        raise ValueError("Uploaded audio file is empty.")

    x = x - float(np.mean(x))

    if fs_in != FS:
        g = np.gcd(int(fs_in), int(FS))
        up = FS // g
        down = int(fs_in) // g
        x = resample_poly(x, up, down).astype(np.float32)

    max_len = FS * int(max_len_sec)
    if len(x) > max_len:
        x = x[:max_len]

    if len(x) < int(0.15 * FS):
        raise ValueError("Uploaded audio is too short. Please use at least 0.15 seconds of dry audio.")

    x = apply_fades(x)
    return normalize_audio(x, peak=0.75)


def load_and_resample_dry_wav():
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    sample_path = os.path.join(SAMPLES_DIR, "dry_speech.wav")

    if not os.path.exists(sample_path):
        x = np.zeros(FS * 2, dtype=np.float32)
        x[0] = 1.0
        return x

    x, fs_in = sf.read(sample_path)
    return prepare_dry_audio(x, fs_in, max_len_sec=4)


def load_uploaded_dry_audio(audio_bytes):
    if not audio_bytes:
        raise ValueError("Uploaded audio file is empty.")

    try:
        x, fs_in = sf.read(io.BytesIO(audio_bytes))
    except Exception as exc:
        raise ValueError(
            "Unsupported audio upload. Please use a dry WAV, FLAC, or OGG file."
        ) from exc

    return prepare_dry_audio(x, fs_in, max_len_sec=8)


def room_volume(L, W, H):
    return float(L) * float(W) * float(H)


def adaptive_wet_ratio(rt60, volume_m3):
    safe_rt60 = 0.55 if not np.isfinite(rt60) else float(np.clip(rt60, 0.18, 1.8))
    rt60_factor = (safe_rt60 - 0.18) / (1.8 - 0.18)
    volume_factor = np.clip((float(volume_m3) - 20.0) / 90.0, 0.0, 1.0)
    wet_ratio = 0.16 + 0.18 * rt60_factor + 0.06 * volume_factor
    return float(np.clip(wet_ratio, 0.14, 0.42))


def tail_seconds_from_rt60(rt60):
    if not np.isfinite(rt60):
        return 0.75
    return float(np.clip(rt60 * 1.15, 0.45, 2.2))


def convolve_wet(dry, rir, tail_seconds=None):
    y = fftconvolve(np.asarray(dry, dtype=np.float32), np.asarray(rir, dtype=np.float32))

    if tail_seconds is None:
        tail_seconds = min(len(rir) / FS, 1.0)

    keep_len = len(dry) + int(FS * max(0.0, float(tail_seconds)))
    y = align_tail_length(y, keep_len)
    return y.astype(np.float32)


def mix_wet_dry(dry, wet, wet_ratio=0.35):
    wet_ratio = float(np.clip(wet_ratio, 0.0, 1.0))
    dry = np.asarray(dry, dtype=np.float32)
    wet = np.asarray(wet, dtype=np.float32)

    if len(dry) < len(wet):
        dry = np.pad(dry, (0, len(wet) - len(dry)))
    elif len(wet) < len(dry):
        wet = np.pad(wet, (0, len(dry) - len(wet)))

    wet_rms = rms(wet)
    dry_rms = rms(dry)
    if wet_rms > 1e-6 and dry_rms > 1e-6:
        wet_target_rms = dry_rms * (0.55 + wet_ratio * 0.85)
        wet = wet * (wet_target_rms / wet_rms)

    out = (1.0 - wet_ratio) * dry + wet_ratio * wet
    out = apply_fades(out, fade_ms=14.0)
    return normalize_audio(out, peak=0.92)


def make_clap(fs=FS, length_sec=2.0):
    n = int(fs * length_sec)
    x = np.zeros(n, dtype=np.float32)

    burst_len = int(0.012 * fs)
    noise = np.random.randn(burst_len).astype(np.float32)
    noise = normalize_audio(noise, peak=0.9)
    x[:burst_len] = noise
    x[0] = 1.0

    env = np.exp(-np.linspace(0, 7.0, n)).astype(np.float32)
    x *= env
    return normalize_audio(x, peak=0.9)


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
    uploaded_dry_audio=None,
    uploaded_audio_name=None,
):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    short = uuid.uuid4().hex[:6]
    run_folder = f"{ts}_{short}"
    run_dir = os.path.join(AUDIO_DIR, run_folder)
    os.makedirs(run_dir, exist_ok=True)
    cleanup_audio_run_folders(AUDIO_DIR, keep_latest=MAX_AUDIO_RUN_FOLDERS, exclude_paths=[run_dir])

    if uploaded_dry_audio is None:
        dry = load_and_resample_dry_wav()
        input_audio_source = "sample"
        speech_label = "Speech Sample"
    else:
        dry = load_uploaded_dry_audio(uploaded_dry_audio)
        input_audio_source = "upload"
        speech_label = os.path.basename(uploaded_audio_name or "").strip() or "Uploaded Audio"

    src_pos, mic_pos = resolve_positions(
        L, W, H,
        src_x=src_x, src_y=src_y, src_z=src_z,
        mic_x=mic_x, mic_y=mic_y, mic_z=mic_z,
    )

    room_before = build_room(
        L, W, H, wall_a, floor_a, ceil_a,
        src_pos=src_pos,
        mic_pos=mic_pos,
        max_order=30,
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

    if math.isfinite(rt60_before) and math.isfinite(rt60_after) and (rt60_after > rt60_before):
        rt60_flag = "rt60_after_gt_before_check_decay_fit"
    else:
        rt60_flag = "ok"

    volume_m3 = room_volume(L, W, H)
    wet_ratio_before = adaptive_wet_ratio(rt60_before, volume_m3)
    wet_ratio_after = adaptive_wet_ratio(rt60_after, volume_m3)

    clap = make_clap()
    clap_before = normalize_audio(convolve_wet(clap, rir_before, tail_seconds=tail_seconds_from_rt60(rt60_before)), peak=0.92)
    clap_after = normalize_audio(convolve_wet(clap, rir_after, tail_seconds=tail_seconds_from_rt60(rt60_after)), peak=0.92)

    clap_before_file = "clap_before.wav"
    clap_after_file = "clap_after.wav"
    save_wav(os.path.join(run_dir, clap_before_file), clap_before)
    save_wav(os.path.join(run_dir, clap_after_file), clap_after)

    wet_before = convolve_wet(dry, rir_before, tail_seconds=tail_seconds_from_rt60(rt60_before))
    wet_after = convolve_wet(dry, rir_after, tail_seconds=tail_seconds_from_rt60(rt60_after))

    speech_before = mix_wet_dry(dry, wet_before, wet_ratio=wet_ratio_before)
    speech_after = mix_wet_dry(dry, wet_after, wet_ratio=wet_ratio_after)

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
        if (math.isfinite(rt60_before) and math.isfinite(rt60_after))
        else None,
        "effective_wall_a_before": float(wall_a),
        "effective_wall_a_after": float(wall_a_after),
        "panel_coverage": panel_coverage_from_rects(panels),
        "rt60_check_flag": rt60_flag,
        "input_audio_source": input_audio_source,
        "speech_label": speech_label,
        "sample_rate": FS,
        "wet_ratio_before": wet_ratio_before,
        "wet_ratio_after": wet_ratio_after,
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
