import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { MOODS, LANGUAGES, type Voice, type Mood, type ModelStatus } from '../types'
import { useAudioPlayer } from '../hooks/useAudioPlayer'

interface GenerateTabProps {
  voices: Voice[]
  modelStatus: ModelStatus | null
}

export function GenerateTab({ voices, modelStatus }: GenerateTabProps) {
  const [text, setText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [language, setLanguage] = useState('pt')
  const [mood, setMood] = useState<Mood>('normal')
  const [intensity, setIntensity] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedFile, setGeneratedFile] = useState<string | null>(null)

  const player = useAudioPlayer()

  // Auto-select first voice
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].id)
    }
  }, [voices, selectedVoice])

  const isReady = modelStatus?.model_ready === true

  const handleGenerate = async () => {
    if (!text.trim()) return
    if (!selectedVoice) { setError('Select a voice from the Voice Bank first.'); return }
    if (!isReady) { setError('Model is still loading. Please wait…'); return }

    setLoading(true)
    setError(null)
    setGeneratedUrl(null)

    try {
      const res = await api.generate({
        text: text.trim(),
        voice_id: selectedVoice,
        language,
        mood,
        intensity,
      })
      const url = api.generatedAudioUrl(res.file)
      setGeneratedUrl(url)
      setGeneratedFile(res.file)
      player.play(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!generatedUrl || !generatedFile) return
    const a = document.createElement('a')
    a.href = generatedUrl
    a.download = generatedFile
    a.click()
  }

  const voiceLabel = voices.find(v => v.id === selectedVoice)

  return (
    <div className="space-y-6">
      {/* Model status banner */}
      {!isReady && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-3 ${
          modelStatus?.model_status === 'error'
            ? 'bg-red-900/40 border border-red-700 text-red-300'
            : 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300'
        }`}>
          {modelStatus?.model_status === 'error' ? (
            <>⚠️ Model error: {modelStatus.model_error}</>
          ) : (
            <>
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
              {modelStatus?.model_status === 'loading'
                ? 'Loading XTTS-v2 model… this may take a few minutes on first run.'
                : 'Waiting for model to initialize…'}
            </>
          )}
        </div>
      )}

      {isReady && (
        <div className="rounded-xl px-4 py-2 text-sm flex items-center gap-2 bg-green-900/20 border border-green-800/40 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          {modelStatus?.backend === 'xtts'
            ? 'XTTS-v2 ready — full voice cloning active'
            : 'espeak-ng ready — upgrade to XTTS-v2 for voice cloning'}
        </div>
      )}

      {/* Text input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Text to speak
          <span className="ml-2 text-xs text-gray-500">(PT-BR recommended)</span>
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Digite o texto aqui… ex: Olá! Bem-vindo ao VoiceLab."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed"
        />
        <div className="text-right text-xs text-gray-600 mt-1">{text.length}/2000</div>
      </div>

      {/* Voice selector */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Voice</label>
          {voices.length === 0 ? (
            <div className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              No voices yet — clone one first
            </div>
          ) : (
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {voices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.gender === 'male' ? '♂' : v.gender === 'female' ? '♀' : ''}
                </option>
              ))}
            </select>
          )}
          {voiceLabel && (
            <div className="mt-1 text-xs text-gray-500">
              {LANGUAGES.find(l => l.code === voiceLabel.language)?.label || voiceLabel.language}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Output language</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mood selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Tone / Mood</label>
        <div className="grid grid-cols-4 gap-2">
          {MOODS.map(m => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-xs transition-all ${
                mood === m.value
                  ? 'border-indigo-500 bg-indigo-900/30 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
              }`}
            >
              <span className="text-xl">{m.emoji}</span>
              <span className="font-medium">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Intensity slider */}
      {mood !== 'normal' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            {MOODS.find(m => m.value === mood)?.emoji} Intensity
            <span className="ml-2 text-indigo-400 font-bold">{intensity}</span>
            <span className="ml-1 text-gray-500 text-xs">/ 5</span>
          </label>
          <div className="relative px-1">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-gray-700 accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1 px-0.5">
              <span>Subtle</span>
              <span>Moderate</span>
              <span>Maximum</span>
            </div>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {MOODS.find(m => m.value === mood)?.description}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm bg-red-900/40 border border-red-700 text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !text.trim() || !selectedVoice}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating speech…
          </span>
        ) : '▶ Generate Speech'}
      </button>

      {/* Audio player */}
      {generatedUrl && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Generated audio</span>
            <button
              onClick={handleDownload}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              ⬇ Download WAV
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-700 rounded-full mb-3">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${player.progress * 100}%` }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => player.play(generatedUrl)}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium transition-colors"
            >
              {player.state === 'playing' && player.currentUrl === generatedUrl ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors disabled:opacity-40"
            >
              🔄 Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
