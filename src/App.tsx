import { useState, useRef, useEffect, useCallback } from 'react'

interface Recording {
  id: string
  name: string
  url: string
  blob: Blob
  duration: number
  timestamp: Date
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const duration = (Date.now() - startTimeRef.current) / 1000
        const id = crypto.randomUUID()
        setRecordings(prev => [
          ...prev,
          {
            id,
            name: `Recording ${prev.length + 1}`,
            url,
            blob,
            duration,
            timestamp: new Date(),
          },
        ])
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start()
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone permissions.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      stopTimer()
      setRecordingTime(0)
    }
  }, [isRecording, stopTimer])

  const deleteRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id)
      if (rec) URL.revokeObjectURL(rec.url)
      return prev.filter(r => r.id !== id)
    })
    const audio = audioRefs.current.get(id)
    if (audio) {
      audio.pause()
      audioRefs.current.delete(id)
    }
    if (playingId === id) setPlayingId(null)
  }, [playingId])

  const renameRecording = useCallback((id: string, name: string) => {
    setRecordings(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }, [])

  const playRecording = useCallback((id: string, url: string) => {
    // Stop all other playing audio
    audioRefs.current.forEach((audio, aid) => {
      if (aid !== id) { audio.pause(); audio.currentTime = 0 }
    })

    let audio = audioRefs.current.get(id)
    if (!audio) {
      audio = new Audio(url)
      audio.onended = () => setPlayingId(null)
      audioRefs.current.set(id, audio)
    }

    if (playingId === id) {
      audio.pause()
      audio.currentTime = 0
      setPlayingId(null)
    } else {
      audio.play()
      setPlayingId(id)
    }
  }, [playingId])

  useEffect(() => {
    return () => {
      stopTimer()
      audioRefs.current.forEach(audio => audio.pause())
      recordings.forEach(r => URL.revokeObjectURL(r.url))
    }
  }, []) // eslint-disable-line

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
            🎙️ VoiceLab
          </h1>
          <p className="text-gray-400 text-sm">Record, play, and manage your voice recordings</p>
        </div>

        {/* Record Button */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full text-2xl font-bold transition-all duration-200 shadow-lg focus:outline-none focus:ring-4 ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 animate-pulse focus:ring-red-500'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? '⏹' : '⏺'}
          </button>
          {isRecording && (
            <div className="flex items-center gap-2 text-red-400 text-sm font-mono">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording… {formatDuration(recordingTime)}
            </div>
          )}
          {!isRecording && (
            <p className="text-gray-500 text-sm">Press to start recording</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Recordings List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-300 mb-4">
            Recordings {recordings.length > 0 && <span className="text-gray-500 font-normal text-sm">({recordings.length})</span>}
          </h2>

          {recordings.length === 0 ? (
            <div className="text-center py-12 text-gray-600 border border-dashed border-gray-800 rounded-xl">
              No recordings yet. Hit the button above to start.
            </div>
          ) : (
            <ul className="space-y-3">
              {recordings.map(rec => (
                <RecordingItem
                  key={rec.id}
                  recording={rec}
                  isPlaying={playingId === rec.id}
                  onPlay={() => playRecording(rec.id, rec.url)}
                  onDelete={() => deleteRecording(rec.id)}
                  onRename={(name) => renameRecording(rec.id, name)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface RecordingItemProps {
  recording: Recording
  isPlaying: boolean
  onPlay: () => void
  onDelete: () => void
  onRename: (name: string) => void
}

function RecordingItem({ recording, isPlaying, onPlay, onDelete, onRename }: RecordingItemProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(recording.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const submitRename = () => {
    const trimmed = editName.trim()
    if (trimmed) onRename(trimmed)
    else setEditName(recording.name)
    setEditing(false)
  }

  return (
    <li className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      {/* Play button */}
      <button
        onClick={onPlay}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors focus:outline-none focus:ring-2 ${
          isPlaying
            ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
            : 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500'
        }`}
        aria-label={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setEditName(recording.name); setEditing(false) } }}
            className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm border border-indigo-500 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-left text-sm font-medium text-white hover:text-indigo-300 truncate w-full"
            title="Click to rename"
          >
            {recording.name}
          </button>
        )}
        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
          <span>{formatDuration(recording.duration)}</span>
          <span>{formatTime(recording.timestamp)}</span>
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors text-lg focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        aria-label="Delete recording"
      >
        🗑
      </button>
    </li>
  )
}
