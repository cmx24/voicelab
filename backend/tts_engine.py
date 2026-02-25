"""
VoiceLab TTS Engine
Primary:  XTTS-v2 (Coqui) — best-in-class voice cloning, requires model download
Fallback: espeak-ng — offline, zero dependencies, lower quality but always available
"""

import os
import subprocess
import threading
import logging
import shutil

# Auto-accept Coqui TTS non-commercial CPML license
os.environ.setdefault("COQUI_TOS_AGREED", "1")

logger = logging.getLogger(__name__)

# XTTS-v2 supported language codes
XTTS_LANGUAGES = {
    "pt", "en", "es", "fr", "de", "it", "pl",
    "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko",
}

# espeak-ng voice map for fallback
ESPEAK_VOICE_MAP = {
    "pt": "pt-br",
    "en": "en-us",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "it": "it",
    "pl": "pl",
    "tr": "tr",
    "ru": "ru",
    "nl": "nl",
    "cs": "cs",
    "ar": "ar",
    "zh-cn": "cmn",
    "ja": "ja",
    "hu": "hu",
    "ko": "ko",
}

MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"


class TTSEngine:
    """
    Thread-safe TTS engine with XTTS-v2 primary and espeak-ng fallback.
    
    State machine: idle → loading → ready | error
    When XTTS-v2 fails to load, falls back to espeak-ng automatically.
    """

    def __init__(self):
        self._tts = None
        self._lock = threading.Lock()
        self._status = "idle"   # idle | loading | ready | error
        self._error_msg = None
        self._backend = None    # "xtts" | "espeak"

    @property
    def status(self) -> str:
        return self._status

    @property
    def error(self):
        return self._error_msg

    @property
    def is_ready(self) -> bool:
        return self._status == "ready"

    @property
    def backend(self) -> str:
        return self._backend or "none"

    def initialize_async(self):
        """Start model loading in a background thread (non-blocking)."""
        t = threading.Thread(target=self._load_model, daemon=True)
        t.start()

    def _load_model(self):
        with self._lock:
            if self._status in ("ready", "loading"):
                return
            self._status = "loading"

        logger.info("Loading XTTS-v2 model…")
        try:
            from TTS.api import TTS
            tts = TTS(MODEL_NAME, progress_bar=False)
            with self._lock:
                self._tts = tts
                self._status = "ready"
                self._backend = "xtts"
            logger.info("XTTS-v2 loaded ✓")
        except Exception as e:
            logger.warning(f"XTTS-v2 unavailable: {e}. Falling back to espeak-ng.")
            if shutil.which("espeak-ng"):
                with self._lock:
                    self._status = "ready"
                    self._backend = "espeak"
                    self._error_msg = str(e)
                logger.info("Using espeak-ng fallback ✓")
            else:
                with self._lock:
                    self._status = "error"
                    self._error_msg = str(e)
                logger.error(f"No TTS backend available: {e}")

    def ensure_ready(self):
        """Block until engine is ready or raise on permanent error."""
        if self._status == "idle":
            self._load_model()
        elif self._status == "loading":
            import time
            for _ in range(600):
                time.sleep(1)
                if self._status in ("ready", "error"):
                    break
        if self._status == "error" and self._backend is None:
            raise RuntimeError(f"TTS engine failed to initialize: {self._error_msg}")
        if self._status not in ("ready",):
            raise RuntimeError("TTS engine not ready.")

    def generate(
        self,
        text: str,
        speaker_wav: str,
        language: str,
        output_path: str,
    ) -> str:
        """
        Synthesize speech.

        XTTS-v2 mode:  clones speaker from reference WAV (best quality, requires model)
        espeak-ng mode: offline synthesis without voice cloning (fallback)

        Args:
            text:         Input text
            speaker_wav:  Path to reference WAV (used by XTTS-v2 only)
            language:     Language code (e.g. 'pt' for PT-BR)
            output_path:  Destination WAV file path

        Returns:
            output_path
        """
        self.ensure_ready()

        if self._backend == "xtts":
            return self._generate_xtts(text, speaker_wav, language, output_path)
        else:
            return self._generate_espeak(text, language, output_path)

    def _generate_xtts(self, text, speaker_wav, language, output_path):
        lang = language if language in XTTS_LANGUAGES else "pt"
        logger.info(f"XTTS-v2 generate: lang={lang}")
        with self._lock:
            self._tts.tts_to_file(
                text=text,
                speaker_wav=speaker_wav,
                language=lang,
                file_path=output_path,
                split_sentences=True,
            )
        return output_path

    def _generate_espeak(self, text, language, output_path):
        voice = ESPEAK_VOICE_MAP.get(language, "pt-br")
        tmp_wav = output_path + ".raw.wav"
        logger.info(f"espeak-ng generate: voice={voice}")

        result = subprocess.run(
            ["espeak-ng", "-v", voice, "-w", tmp_wav, "--", text],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"espeak-ng error: {result.stderr}")

        # Normalize to 44100 Hz 16-bit (espeak outputs at 22050 Hz by default)
        import soundfile as sf
        import librosa
        import numpy as np

        y, sr = librosa.load(tmp_wav, sr=None, mono=True)
        if sr != 44100:
            y = librosa.resample(y, orig_sr=sr, target_sr=44100)
        peak = np.max(np.abs(y))
        if peak > 0:
            y = y * (0.85 / peak)
        sf.write(output_path, y, 44100, subtype="PCM_16")

        try:
            os.unlink(tmp_wav)
        except Exception:
            pass
        return output_path


# Singleton
engine = TTSEngine()
