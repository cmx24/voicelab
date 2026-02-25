"""
Voice Bank: persistent storage for cloned voice profiles.
Uses a JSON file for metadata; reference audio files stored on disk.
"""

import json
import shutil
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

VOICES_JSON = "data/voices.json"
REFERENCES_DIR = "data/references"


class VoiceBank:
    def __init__(self, base_dir: str = "."):
        self.base = Path(base_dir)
        self.json_path = self.base / VOICES_JSON
        self.refs_dir = self.base / REFERENCES_DIR
        self.refs_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_json()

    def _ensure_json(self):
        if not self.json_path.exists():
            self.json_path.write_text(json.dumps({"voices": []}, indent=2), encoding="utf-8")

    def _load(self) -> dict:
        try:
            return json.loads(self.json_path.read_text(encoding="utf-8"))
        except Exception:
            return {"voices": []}

    def _save(self, data: dict):
        self.json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def add_voice(
        self,
        name: str,
        ref_audio_path: str,
        gender: str = "unknown",
        language: str = "pt",
        description: str = "",
    ) -> dict:
        """Copy reference audio into bank and register the voice."""
        vid = str(uuid.uuid4())
        src = Path(ref_audio_path)
        dest = self.refs_dir / f"{vid}{src.suffix}"
        shutil.copy2(src, dest)

        voice = {
            "id": vid,
            "name": name,
            "gender": gender,
            "language": language,
            "description": description,
            "reference_file": str(dest.relative_to(self.base)),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        data = self._load()
        data["voices"].append(voice)
        self._save(data)
        logger.info(f"Voice saved: {name} ({vid})")
        return voice

    def list_voices(
        self,
        gender: Optional[str] = None,
        language: Optional[str] = None,
    ) -> list:
        data = self._load()
        voices = data.get("voices", [])
        if gender and gender != "all":
            voices = [v for v in voices if v.get("gender") == gender]
        if language and language != "all":
            voices = [v for v in voices if v.get("language") == language]
        return sorted(voices, key=lambda v: v.get("created_at", ""), reverse=True)

    def get_voice(self, voice_id: str) -> Optional[dict]:
        data = self._load()
        for v in data.get("voices", []):
            if v["id"] == voice_id:
                return v
        return None

    def update_voice(self, voice_id: str, **kwargs) -> Optional[dict]:
        data = self._load()
        for v in data["voices"]:
            if v["id"] == voice_id:
                allowed = {"name", "gender", "language", "description"}
                for k, val in kwargs.items():
                    if k in allowed:
                        v[k] = val
                self._save(data)
                return v
        return None

    def delete_voice(self, voice_id: str) -> bool:
        data = self._load()
        voice = next((v for v in data["voices"] if v["id"] == voice_id), None)
        if not voice:
            return False

        # Remove reference file
        ref = self.base / voice.get("reference_file", "")
        if ref.exists():
            ref.unlink()

        data["voices"] = [v for v in data["voices"] if v["id"] != voice_id]
        self._save(data)
        return True

    def get_reference_path(self, voice_id: str) -> Optional[Path]:
        voice = self.get_voice(voice_id)
        if not voice:
            return None
        p = self.base / voice["reference_file"]
        return p if p.exists() else None
