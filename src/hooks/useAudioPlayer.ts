import { useState, useRef, useCallback } from 'react'

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<PlayerState>('idle')
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)   // 0–1
  const [duration, setDuration] = useState(0)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setState('idle')
    setProgress(0)
    setDuration(0)
  }, [])

  const play = useCallback((url: string) => {
    // If same URL, toggle play/pause
    if (currentUrl === url && audioRef.current) {
      if (state === 'playing') {
        audioRef.current.pause()
        setState('paused')
      } else {
        audioRef.current.play()
        setState('playing')
      }
      return
    }

    cleanup()
    setCurrentUrl(url)
    setState('loading')

    const audio = new Audio(url)
    audioRef.current = audio

    audio.oncanplaythrough = () => {
      setDuration(audio.duration)
      audio.play()
      setState('playing')
    }
    audio.ontimeupdate = () => {
      if (audio.duration > 0)
        setProgress(audio.currentTime / audio.duration)
    }
    audio.onended = () => {
      setState('idle')
      setProgress(0)
    }
    audio.onerror = () => setState('error')
  }, [currentUrl, state, cleanup])

  const stop = useCallback(() => {
    cleanup()
    setCurrentUrl(null)
  }, [cleanup])

  return { state, currentUrl, progress, duration, play, stop }
}
