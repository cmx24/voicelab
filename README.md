# 🎙️ VoiceLab

**PT-BR Voice Cloning & Text-to-Speech Studio**

A full-stack web application for voice cloning, text-to-speech synthesis, and voice management — optimised for Brazilian Portuguese (PT-BR) with support for 16 languages.

![VoiceLab UI](https://github.com/user-attachments/assets/be85b820-126a-406f-819c-594ded1475ea)

---

## Features

| Feature | Detail |
|---------|--------|
| **Voice Cloning** | Upload `.wav`, `.mp3`, `.m4a`, `.ogg`, or `.flac` — auto-normalises to 44100 Hz 16-bit |
| **Voice Bank** | Label, save, and reload cloned voices; filter by gender and language |
| **Auto Gender Detection** | Pitch analysis (librosa pyin F0) detects male / female automatically |
| **Text-to-Speech** | XTTS-v2 primary (best-in-class voice cloning); espeak-ng fallback (always offline) |
| **Tone / Mood** | Normal · Upbeat · Angry · Excited |
| **Intensity Slider** | 1–5 scale controls the depth of the mood effect |
| **WAV Export** | 44100 Hz · 16-bit PCM — download every generated sample |
| **16 Languages** | PT-BR, EN, ES, FR, DE, IT, PL, TR, RU, NL, CS, AR, ZH, JA, KO, HU |

---

## Architecture

```
voicelab/
├── backend/              # FastAPI + TTS engine
│   ├── main.py           # API routes
│   ├── tts_engine.py     # XTTS-v2 + espeak-ng fallback
│   ├── voice_bank.py     # JSON-based voice storage
│   ├── audio_processing.py  # Mood FX, gender detection, resampling
│   ├── requirements.txt
│   └── data/             # Created at runtime
│       ├── voices.json
│       ├── references/   # Stored reference audio
│       └── generated/    # TTS output cache
└── src/                  # React + TypeScript frontend
    ├── components/
    │   ├── GenerateTab.tsx
    │   ├── CloneTab.tsx
    │   └── VoiceBankTab.tsx
    ├── api/client.ts
    ├── types/index.ts
    └── hooks/useAudioPlayer.ts
```

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| **Python** | 3.10+ | [python.org](https://www.python.org/downloads/) — tick *"Add Python to PATH"* on Windows |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **espeak-ng** | any | Optional but recommended for instant offline fallback — [install guide](#espeak-ng) |

---

## Building from Source

```bash
# 1. Clone the repository
git clone https://github.com/cmx24/voicelab.git
cd voicelab
```

### Windows — one-click setup

```bat
install.bat   # installs all dependencies and builds the frontend
start.bat     # starts backend + frontend and opens the browser
```

`install.bat` creates a Python virtual environment under `backend/venv/`, installs PyTorch, Coqui TTS, and all other deps, then runs `npm install && npm run build`. You only need to run it once.

### Manual setup (Windows / macOS / Linux)

#### 1 — Backend

```bash
cd backend

# Create and activate a virtual environment (recommended)
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# Install Python deps
pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install "coqui-tts[codec]" "transformers>=4.57.0,<5.0.0"
pip install -r requirements.txt

# Start server (port 8000)
COQUI_TOS_AGREED=1 python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

> **First run:** XTTS-v2 (~1.8 GB) downloads automatically from Hugging Face.  
> The API returns `{ "backend": "espeak" }` until the model is ready —  
> generation still works via espeak-ng so you can test immediately.

#### 2 — Frontend

```bash
# From repo root
npm install
npm run dev       # dev server at http://localhost:5173
# or
npm run build && npm run preview   # production preview
```

### espeak-ng

espeak-ng provides an always-available offline TTS fallback while XTTS-v2 downloads.

| OS | Install command |
|----|----------------|
| **Ubuntu / Debian** | `sudo apt install espeak-ng` |
| **macOS** | `brew install espeak` |
| **Windows** | Download the installer from [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases) and add it to `PATH` |

---

## Testing the App

1. **Clone a voice** → go to *Clone Voice* tab → drop a WAV/MP3 (3–30 s)  
2. **Generate speech** → go to *Generate* tab → type PT-BR text → pick voice → choose mood + intensity → click **Generate Speech**  
3. **Download** → click ⬇ Download WAV to save the 44100 Hz 16-bit file  
4. **Manage voices** → go to *Voice Bank* → filter by gender / language, rename, or delete

---

## TTS Backends

| Backend | Quality | Voice Cloning | Requires |
|---------|---------|---------------|---------|
| **XTTS-v2** | ★★★★★ | ✅ Yes | Internet (first run), ~1.8 GB |
| **espeak-ng** | ★★☆☆☆ | ❌ No | System install (auto-detected) |

The app starts instantly with espeak-ng and upgrades to XTTS-v2 automatically once the model downloads.

---

## Mood / Intensity Effects

| Mood | Effect |
|------|--------|
| Normal | Unmodified XTTS-v2 or espeak-ng output |
| Upbeat | +1.5–2.5 semitones pitch · 1.05–1.18× speed |
| Angry | –0.5–1.5 semitones · soft harmonic clip · slight volume boost |
| Excited | +2–3.5 semitones · 1.10–1.22× speed |

Intensity slider (1–5): scales each effect linearly (1 = subtle, 5 = maximum).

---

## License

Backend TTS uses [Coqui XTTS-v2](https://coqui.ai/cpml) under the non-commercial CPML.  
All other code in this repo is MIT.
