"""
Audio processing utilities:
- Gender detection from audio (pitch analysis)
- Mood/tone effects (pitch shift, speed, emphasis)
- WAV normalization and resampling to 44100 Hz 16-bit
"""

import logging
import numpy as np
import soundfile as sf
from pathlib import Path

# Ensure ffmpeg binaries are on PATH for MP3/M4A support
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

logger = logging.getLogger(__name__)

TARGET_SR = 44100
BIT_DEPTH = "PCM_16"

# Mood effect parameters: (pitch_semitones_max, speed_max, gain_db_max)
MOOD_PARAMS = {
    "normal":  (0.0,  1.0,   0.0),
    "upbeat":  (2.5,  1.18,  1.5),
    "angry":   (-1.5, 1.12,  3.0),
    "excited": (3.5,  1.22,  2.0),
}


def detect_gender(audio_path: str) -> str:
    """
    Detect speaker gender from audio using fundamental frequency analysis.
    Male F0: ~85–180 Hz | Female F0: ~165–255 Hz
    """
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        # pyin is more robust than yin for F0 estimation
        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),  # ~65 Hz
            fmax=librosa.note_to_hz("C6"),  # ~1047 Hz
            sr=sr,
        )
        voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]
        if len(voiced_f0) == 0:
            return "unknown"
        mean_f0 = float(np.nanmedian(voiced_f0))
        # Threshold: 165 Hz separates typical male/female fundamental
        return "female" if mean_f0 >= 165 else "male"
    except Exception as e:
        logger.warning(f"Gender detection failed: {e}")
        return "unknown"


def apply_mood(
    input_path: str,
    output_path: str,
    mood: str = "normal",
    intensity: int = 3,
) -> str:
    """
    Apply mood-based audio transformations.

    Args:
        input_path:  Source WAV file (XTTS-v2 output)
        output_path: Destination WAV file
        mood:        'normal' | 'upbeat' | 'angry' | 'excited'
        intensity:   1–5 (1=minimal effect, 3=moderate, 5=maximum)

    Returns:
        output_path
    """
    import librosa

    mood = mood if mood in MOOD_PARAMS else "normal"
    # Normalize intensity to [0, 1] range; intensity=3 → factor=0.5
    factor = (max(1, min(5, intensity)) - 1) / 4.0
    pitch_max, speed_max, gain_max = MOOD_PARAMS[mood]

    # Load audio
    y, sr = librosa.load(input_path, sr=None, mono=True)

    # ── Pitch shift ────────────────────────────────────────────────────────────
    n_steps = pitch_max * factor
    if abs(n_steps) > 0.01:
        y = librosa.effects.pitch_shift(y, sr=sr, n_steps=n_steps)

    # ── Speed / time-stretch ──────────────────────────────────────────────────
    rate = 1.0 + (speed_max - 1.0) * factor
    if abs(rate - 1.0) > 0.005:
        y = librosa.effects.time_stretch(y, rate=rate)

    # ── Gain ──────────────────────────────────────────────────────────────────
    gain_lin = 10 ** (gain_max * factor / 20.0)
    y = y * gain_lin

    # ── Angry: add subtle harmonic distortion ─────────────────────────────────
    if mood == "angry" and factor > 0.2:
        # soft-clip to add mild harmonic richness (perceived aggression)
        clip_threshold = 0.85 - 0.15 * factor
        y = np.tanh(y / clip_threshold) * clip_threshold

    # ── Normalize to prevent clipping ────────────────────────────────────────
    peak = np.max(np.abs(y))
    if peak > 0.98:
        y = y * (0.95 / peak)

    # ── Resample to 44100 Hz ─────────────────────────────────────────────────
    if sr != TARGET_SR:
        y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)
        sr = TARGET_SR

    # ── Write 16-bit PCM WAV ──────────────────────────────────────────────────
    sf.write(output_path, y, sr, subtype=BIT_DEPTH)
    logger.info(f"Mood '{mood}' (intensity={intensity}) written → {output_path}")
    return output_path


def normalize_wav(input_path: str, output_path: str) -> str:
    """
    Resample and normalize any audio file to 44100 Hz 16-bit PCM WAV.
    Used for reference audio import.
    """
    try:
        import librosa
        y, sr = librosa.load(input_path, sr=None, mono=True)
        if sr != TARGET_SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)
        peak = np.max(np.abs(y))
        if peak > 0:
            y = y * (0.9 / peak)
        sf.write(output_path, y, TARGET_SR, subtype=BIT_DEPTH)
        return output_path
    except Exception as e:
        logger.error(f"normalize_wav failed: {e}")
        raise
