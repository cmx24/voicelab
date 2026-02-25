import { useState, useRef } from 'react'
import { api } from '../api/client'
import { LANGUAGES, type Voice } from '../types'

interface CloneTabProps {
  onVoiceSaved: (voice: Voice) => void
}

const ACCEPTED = '.wav,.mp3,.m4a,.ogg,.flac'
const MAX_MB = 50

export function CloneTab({ onVoiceSaved }: CloneTabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('pt')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<Voice | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleFile = (f: File) => {
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_MB} MB)`)
      return
    }
    setFile(f)
    setError(null)
    setSuccess(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleClone = async () => {
    if (!file || !name.trim()) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    const fd = new FormData()
    fd.append('audio', file)
    fd.append('name', name.trim())
    fd.append('language', language)
    fd.append('description', description.trim())
    fd.append('detect_gender_flag', 'true')

    try {
      const voice = await api.cloneVoice(fd)
      setSuccess(voice)
      onVoiceSaved(voice)
      // Reset form
      setFile(null)
      setName('')
      setDescription('')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Clone failed')
    } finally {
      setLoading(false)
    }
  }

  const genderIcon = (g: string) =>
    g === 'male' ? '♂' : g === 'female' ? '♀' : '?'

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-400">
        Upload a reference audio file (3–30 seconds recommended). VoiceLab will analyse
        the voice, auto-detect gender, and save it to your Voice Bank for reuse.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-indigo-500 bg-indigo-900/20'
            : file
            ? 'border-green-700 bg-green-900/10'
            : 'border-gray-700 hover:border-gray-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="space-y-1">
            <div className="text-3xl">🎵</div>
            <div className="text-sm font-medium text-white">{file.name}</div>
            <div className="text-xs text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📂</div>
            <div className="text-sm text-gray-300">
              Drop audio file here or click to browse
            </div>
            <div className="text-xs text-gray-600">WAV · MP3 · M4A · OGG · FLAC (max {MAX_MB} MB)</div>
          </div>
        )}
      </div>

      {/* Audio preview */}
      {previewUrl && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-3">
          <div className="text-xs text-gray-400 mb-2">Reference audio preview</div>
          <audio
            ref={audioRef}
            src={previewUrl}
            controls
            className="w-full h-8"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Voice name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Maria, Carlos, Narrador"
          maxLength={80}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
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

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Description <span className="text-gray-600">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Young female, neutral accent, for narration"
          maxLength={200}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm bg-red-900/40 border border-red-700 text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-xl px-4 py-3 text-sm bg-green-900/30 border border-green-700 text-green-300">
          ✅ Voice saved: <strong>{success.name}</strong>
          {' '}· Gender: {genderIcon(success.gender)} {success.gender}
          {' '}· {LANGUAGES.find(l => l.code === success.language)?.label || success.language}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleClone}
        disabled={!file || !name.trim() || loading}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analysing voice…
          </span>
        ) : '💾 Save to Voice Bank'}
      </button>
    </div>
  )
}
