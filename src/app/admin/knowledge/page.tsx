'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface KnowledgeSource {
  id: string
  type: string
  name: string
  uri: string
  content: string
  contentHash: string
  lastSyncedAt: string
  createdAt: string
}

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [editing, setEditing] = useState<KnowledgeSource | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  // New source form
  const [form, setForm] = useState({ type: 'text', name: '', uri: '', content: '' })

  const fetchSources = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/knowledge')
    if (res.ok) {
      const data = await res.json()
      setSources(data.sources)
    }
    setLoading(false)
  }

  useEffect(() => { fetchSources() }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult('')
    const res = await fetch('/api/admin/knowledge/sync', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setSyncResult(data.message)
    }
    setSyncing(false)
    fetchSources()
  }

  const handleCreate = async () => {
    if (!form.name || !form.content) { setError('名前と内容は必須です'); return }
    setError('')
    const res = await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ type: 'text', name: '', uri: '', content: '' })
      setShowForm(false)
      fetchSources()
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    const res = await fetch(`/api/admin/knowledge/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name, content: editing.content, uri: editing.uri }),
    })
    if (res.ok) {
      setEditing(null)
      fetchSources()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' })
    fetchSources()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <Link href="/staff" className="text-gray-300 hover:text-white text-sm">← 一覧</Link>
        <h1 className="text-lg font-bold">📚 ナレッジ管理</h1>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* アクションバー */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition"
          >
            + ナレッジ追加
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {syncing ? '更新中...' : '🔄 Sync（差分更新）'}
          </button>
          {syncResult && <span className="text-sm text-green-700">{syncResult}</span>}
        </div>

        {/* 新規作成フォーム */}
        {showForm && (
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">新しいナレッジを追加</h3>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="text">テキスト</option>
                  <option value="url">URL</option>
                  <option value="file">ファイル</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ゴミ収集ガイドなど"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URI（URLまたはファイルパス）</label>
              <input
                type="text"
                className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={form.uri}
                onChange={(e) => setForm({ ...form, uri: e.target.value })}
                placeholder="任意"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
              <textarea
                className="w-full border rounded p-2 min-h-[120px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="ナレッジの内容を入力..."
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">保存</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition">キャンセル</button>
            </div>
          </div>
        )}

        {/* ナレッジ一覧 */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {sources.map((src) => (
              <div key={src.id} className="bg-white rounded-lg border p-4">
                {editing?.id === src.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      className="w-full border rounded p-2 text-sm font-medium"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                    <input
                      type="text"
                      className="w-full border rounded p-2 text-sm"
                      value={editing.uri}
                      onChange={(e) => setEditing({ ...editing, uri: e.target.value })}
                      placeholder="URI"
                    />
                    <textarea
                      className="w-full border rounded p-2 min-h-[100px] text-sm"
                      value={editing.content}
                      onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleUpdate} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">保存</button>
                      <button onClick={() => setEditing(null)} className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{src.type}</span>
                          <h4 className="font-medium text-gray-800">{src.name}</h4>
                        </div>
                        {src.uri && <p className="text-xs text-blue-600 mb-1">{src.uri}</p>}
                        <p className="text-sm text-gray-600 line-clamp-2">{src.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>Hash: {src.contentHash.slice(0, 8)}...</span>
                          <span>最終Sync: {formatDate(src.lastSyncedAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setEditing(src)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition">編集</button>
                        <button onClick={() => handleDelete(src.id)} className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded transition">削除</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
