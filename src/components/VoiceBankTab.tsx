import { useState } from 'react'
import { api } from '../api/client'
import { LANGUAGES, type Voice } from '../types'
import { useAudioPlayer } from '../hooks/useAudioPlayer'

interface VoiceBankTabProps {
  voices: Voice[]
  onVoicesChange: (voices: Voice[]) => void
}

export function VoiceBankTab({ voices, onVoicesChange }: VoiceBankTabProps) {
  const [filterGender, setFilterGender] = useState('all')
  const [filterLang, setFilterLang] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editLang, setEditLang] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const player = useAudioPlayer()

  // Unique languages present in the bank
  const bankLangs = Array.from(new Set(voices.map(v => v.language)))

  const filtered = voices.filter(v => {
    if (filterGender !== 'all' && v.gender !== filterGender) return false
    if (filterLang !== 'all' && v.language !== filterLang) return false
    return true
  })

  const reload = async () => {
    try {
      const updated = await api.listVoices()
      onVoicesChange(updated)
    } catch { /* ignore */ }
  }

  const startEdit = (v: Voice) => {
    setEditingId(v.id)
    setEditName(v.name)
    setEditDesc(v.description || '')
    setEditGender(v.gender)
    setEditLang(v.language)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: string) => {
    try {
      await api.updateVoice(id, {
        name: editName.trim() || undefined,
        description: editDesc.trim(),
        gender: editGender as Voice['gender'],
        language: editLang,
      })
      setEditingId(null)
      reload()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this voice permanently?')) return
    setDeletingId(id)
    try {
      await api.deleteVoice(id)
      reload()
    } finally {
      setDeletingId(null)
    }
  }

  const genderBadge = (g: string) => {
    const map: Record<string, string> = {
      male: 'bg-blue-900/50 text-blue-300 border-blue-800',
      female: 'bg-pink-900/50 text-pink-300 border-pink-800',
      unknown: 'bg-gray-800 text-gray-400 border-gray-700',
    }
    const icon = g === 'male' ? '♂' : g === 'female' ? '♀' : '?'
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${map[g] || map.unknown}`}>
        {icon} {g}
      </span>
    )
  }

  const langLabel = (code: string) =>
    LANGUAGES.find(l => l.code === code)?.label || code

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return iso }
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterGender}
          onChange={e => setFilterGender(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All genders</option>
          <option value="male">♂ Male</option>
          <option value="female">♀ Female</option>
          <option value="unknown">? Unknown</option>
        </select>

        <select
          value={filterLang}
          onChange={e => setFilterLang(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All languages</option>
          {bankLangs.map(l => (
            <option key={l} value={l}>{langLabel(l)}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-gray-500 self-center">
          {filtered.length} voice{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty state */}
      {voices.length === 0 && (
        <div className="text-center py-16 text-gray-600 border border-dashed border-gray-800 rounded-2xl">
          <div className="text-4xl mb-3">🎙️</div>
          <div className="text-sm">Your Voice Bank is empty.</div>
          <div className="text-xs mt-1">Clone a voice from the <strong className="text-gray-400">Clone Voice</strong> tab to get started.</div>
        </div>
      )}

      {voices.length > 0 && filtered.length === 0 && (
        <div className="text-center py-10 text-gray-600 text-sm">
          No voices match the current filters.
        </div>
      )}

      {/* Voice cards */}
      <ul className="space-y-3">
        {filtered.map(v => (
          <li key={v.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors">
            {editingId === v.id ? (
              /* Edit mode */
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-800 border border-indigo-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  placeholder="Voice name"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editGender}
                    onChange={e => setEditGender(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="male">♂ Male</option>
                    <option value="female">♀ Female</option>
                    <option value="unknown">? Unknown</option>
                  </select>
                  <select
                    value={editLang}
                    onChange={e => setEditLang(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(v.id)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-start gap-3">
                {/* Play reference button */}
                <button
                  onClick={() => player.play(api.voiceAudioUrl(v.id))}
                  title="Preview reference audio"
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                    player.state === 'playing' && player.currentUrl === api.voiceAudioUrl(v.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {player.state === 'playing' && player.currentUrl === api.voiceAudioUrl(v.id) ? '⏸' : '▶'}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm truncate">{v.name}</span>
                    {genderBadge(v.gender)}
                    <span className="text-xs text-gray-500">{langLabel(v.language)}</span>
                  </div>
                  {v.description && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{v.description}</div>
                  )}
                  <div className="text-xs text-gray-700 mt-1">{formatDate(v.created_at)}</div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(v)}
                    className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-xs"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    disabled={deletingId === v.id}
                    className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors text-xs disabled:opacity-50"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
