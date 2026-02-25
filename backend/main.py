"""
VoiceLab FastAPI Backend
Endpoints:
  GET  /api/status              – model readiness
  POST /api/tts/generate        – text → speech
  POST /api/voices/clone        – upload audio, clone voice
  GET  /api/voices              – list voice bank
  GET  /api/voices/{id}         – get voice details
  PATCH /api/voices/{id}        – update voice metadata
  DELETE /api/voices/{id}       – remove voice
  GET  /api/voices/{id}/audio   – stream reference audio
  GET  /api/generated/{file}    – stream generated audio
"""

import os
import shutil
import uuid
import logging
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
from typing import Optional

# Change working directory to backend/ so relative paths work
os.chdir(Path(__file__).parent)

from tts_engine import engine
from voice_bank import VoiceBank
from audio_processing import detect_gender, apply_mood, normalize_wav

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.initialize_async()
    yield

app = FastAPI(title="VoiceLab API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bank = VoiceBank(base_dir=".")
GENERATED_DIR = Path("data/generated")
GENERATED_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR = Path("data/exports")
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Status ────────────────────────────────────────────────────────────────────
@app.get("/api/status")
def get_status():
    return {
        "model_status": engine.status,
        "model_ready": engine.is_ready,
        "model_error": engine.error,
        "backend": engine.backend,
    }

# ── TTS Generation ────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice_id: str
    language: str = "pt"
    mood: str = "normal"
    intensity: int = Field(3, ge=1, le=5)

@app.post("/api/tts/generate")
def generate_tts(req: GenerateRequest):
    if not engine.is_ready:
        raise HTTPException(503, detail=f"Model not ready. Status: {engine.status}")

    voice = bank.get_voice(req.voice_id)
    if not voice:
        raise HTTPException(404, detail="Voice not found")

    ref_path = bank.get_reference_path(req.voice_id)
    if not ref_path:
        raise HTTPException(404, detail="Voice reference audio not found")

    # Generate raw TTS output
    raw_path = str(GENERATED_DIR / f"raw_{uuid.uuid4().hex}.wav")
    try:
        engine.generate(
            text=req.text,
            speaker_wav=str(ref_path),
            language=req.language,
            output_path=raw_path,
        )
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        raise HTTPException(500, detail=str(e))

    # Apply mood effects + normalize to 44100 Hz 16-bit
    out_name = f"{uuid.uuid4().hex}.wav"
    out_path = str(GENERATED_DIR / out_name)
    try:
        apply_mood(raw_path, out_path, mood=req.mood, intensity=req.intensity)
    except Exception as e:
        logger.error(f"Mood processing error: {e}")
        # Fall back to raw output if mood processing fails
        shutil.copy2(raw_path, out_path)
    finally:
        try:
            os.unlink(raw_path)
        except Exception:
            pass

    return {"file": out_name, "url": f"/api/generated/{out_name}"}

@app.get("/api/generated/{filename}")
def get_generated_audio(filename: str):
    path = GENERATED_DIR / filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(str(path), media_type="audio/wav")

# ── Voice Cloning ─────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac"}

@app.post("/api/voices/clone")
async def clone_voice(
    audio: UploadFile = File(...),
    name: str = Form(...),
    language: str = Form("pt"),
    description: str = Form(""),
    detect_gender_flag: bool = Form(True),
):
    ext = Path(audio.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail=f"Unsupported file type: {ext}")

    # Save upload to temp file
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    # Normalize to WAV 44100 Hz 16-bit for storage
    wav_path = str(Path(tmp_path).with_suffix('.wav')) if ext != ".wav" else tmp_path + "_norm.wav"
    try:
        normalize_wav(tmp_path, wav_path)
    except Exception as e:
        raise HTTPException(422, detail=f"Audio processing failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    # Auto-detect gender
    gender = "unknown"
    if detect_gender_flag:
        try:
            gender = detect_gender(wav_path)
        except Exception as e:
            logger.warning(f"Gender detection error: {e}")

    # Save to voice bank
    try:
        voice = bank.add_voice(
            name=name.strip(),
            ref_audio_path=wav_path,
            gender=gender,
            language=language,
            description=description.strip(),
        )
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass

    return voice

# ── Voice Bank CRUD ───────────────────────────────────────────────────────────
@app.get("/api/voices")
def list_voices(gender: Optional[str] = None, language: Optional[str] = None):
    return bank.list_voices(gender=gender, language=language)

@app.get("/api/voices/{voice_id}")
def get_voice(voice_id: str):
    voice = bank.get_voice(voice_id)
    if not voice:
        raise HTTPException(404)
    return voice

class UpdateVoiceRequest(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None

@app.patch("/api/voices/{voice_id}")
def update_voice(voice_id: str, req: UpdateVoiceRequest):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    voice = bank.update_voice(voice_id, **updates)
    if not voice:
        raise HTTPException(404)
    return voice

@app.delete("/api/voices/{voice_id}")
def delete_voice(voice_id: str):
    if not bank.delete_voice(voice_id):
        raise HTTPException(404)
    return {"ok": True}

@app.get("/api/voices/{voice_id}/audio")
def get_voice_audio(voice_id: str):
    ref_path = bank.get_reference_path(voice_id)
    if not ref_path:
        raise HTTPException(404)
    return FileResponse(str(ref_path), media_type="audio/wav")

# ── Serve frontend in production ─────────────────────────────────────────────
frontend_dist = Path("../dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")

# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
