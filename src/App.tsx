import { useState, useEffect, useCallback } from 'react'
import { GenerateTab } from './components/GenerateTab'
import { CloneTab } from './components/CloneTab'
import { VoiceBankTab } from './components/VoiceBankTab'
import { api } from './api/client'
import type { Voice, ModelStatus } from './types'

type Tab = 'generate' | 'clone' | 'bank'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'generate', label: 'Generate', icon: '🔊' },
  { id: 'clone',    label: 'Clone Voice', icon: '🎙️' },
  { id: 'bank',     label: 'Voice Bank', icon: '💾' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('generate')
  const [voices, setVoices] = useState<Voice[]>([])
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null)

  const loadVoices = useCallback(async () => {
    try {
      const list = await api.listVoices()
      setVoices(list)
    } catch { /* backend not yet available */ }
  }, [])

  const pollStatus = useCallback(async () => {
    try {
      const s = await api.getStatus()
      setModelStatus(s)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadVoices()
    pollStatus()
    const interval = setInterval(async () => {
      await pollStatus()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadVoices, pollStatus])

  const handleVoiceSaved = (v: Voice) => {
    setVoices(prev => [v, ...prev])
  }

  const bankCount = voices.length

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-1">🎙️ VoiceLab</h1>
          <p className="text-gray-500 text-sm">PT-BR Voice Cloning &amp; Text-to-Speech Studio</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-900 rounded-2xl p-1 mb-8 border border-gray-800">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.id === 'bank' && bankCount > 0 && (
                <span className="bg-indigo-900 text-indigo-300 text-xs px-1.5 py-0.5 rounded-full">
                  {bankCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {tab === 'generate' && (
            <GenerateTab voices={voices} modelStatus={modelStatus} />
          )}
          {tab === 'clone' && (
            <CloneTab onVoiceSaved={handleVoiceSaved} />
          )}
          {tab === 'bank' && (
            <VoiceBankTab voices={voices} onVoicesChange={setVoices} />
          )}
        </div>
      </div>
    </div>
  )
}
