import type { Voice, GenerateRequest, GenerateResponse, ModelStatus } from '../types'

const BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // ── Status ───────────────────────────────────────────────────────────────
  getStatus(): Promise<ModelStatus> {
    return fetch(`${BASE}/status`).then(r => handleResponse<ModelStatus>(r))
  },

  // ── TTS ──────────────────────────────────────────────────────────────────
  generate(req: GenerateRequest): Promise<GenerateResponse> {
    return fetch(`${BASE}/tts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }).then(r => handleResponse<GenerateResponse>(r))
  },

  // ── Voice Bank ────────────────────────────────────────────────────────────
  listVoices(gender?: string, language?: string): Promise<Voice[]> {
    const params = new URLSearchParams()
    if (gender && gender !== 'all') params.set('gender', gender)
    if (language && language !== 'all') params.set('language', language)
    const qs = params.toString()
    return fetch(`${BASE}/voices${qs ? '?' + qs : ''}`).then(r => handleResponse<Voice[]>(r))
  },

  cloneVoice(formData: FormData): Promise<Voice> {
    return fetch(`${BASE}/voices/clone`, {
      method: 'POST',
      body: formData,
    }).then(r => handleResponse<Voice>(r))
  },

  updateVoice(id: string, updates: Partial<Pick<Voice, 'name' | 'gender' | 'language' | 'description'>>): Promise<Voice> {
    return fetch(`${BASE}/voices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(r => handleResponse<Voice>(r))
  },

  deleteVoice(id: string): Promise<void> {
    return fetch(`${BASE}/voices/${id}`, { method: 'DELETE' }).then(r => handleResponse<void>(r))
  },

  voiceAudioUrl(id: string): string {
    return `${BASE}/voices/${id}/audio`
  },

  generatedAudioUrl(filename: string): string {
    return `${BASE}/generated/${filename}`
  },
}
