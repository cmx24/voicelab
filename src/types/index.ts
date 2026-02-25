export interface Voice {
  id: string
  name: string
  gender: 'male' | 'female' | 'unknown'
  language: string
  description: string
  reference_file: string
  created_at: string
}

export interface GenerateRequest {
  text: string
  voice_id: string
  language: string
  mood: Mood
  intensity: number
}

export interface GenerateResponse {
  file: string
  url: string
}

export interface ModelStatus {
  model_status: 'idle' | 'loading' | 'ready' | 'error'
  model_ready: boolean
  model_error: string | null
  backend: 'xtts' | 'espeak' | 'none'
}

export type Mood = 'normal' | 'upbeat' | 'angry' | 'excited'

export const MOODS: { value: Mood; label: string; emoji: string; description: string }[] = [
  { value: 'normal',  label: 'Normal',   emoji: '😐', description: 'Natural, unmodified speech' },
  { value: 'upbeat',  label: 'Upbeat',   emoji: '😊', description: 'Brighter pitch, slightly faster' },
  { value: 'angry',   label: 'Angry',    emoji: '😠', description: 'Lower, grittier tone' },
  { value: 'excited', label: 'Excited',  emoji: '🤩', description: 'High energy, elevated pitch' },
]

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'pt', label: 'Português (PT-BR)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'cs', label: 'Čeština' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh-cn', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'hu', label: 'Magyar' },
]
