'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ImportMode = 'email' | 'phone'

export default function ImportPage() {
  const router = useRouter()
  const [mode, setMode] = useState<ImportMode>('email')
  const [content, setContent] = useState('')
  const [callerName, setCallerName] = useState('')
  const [callerPhone, setCallerPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ id: string; aiSummary: string } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!content.trim()) { setError('内容を入力してください'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const endpoint = mode === 'email' ? '/api/admin/import/email' : '/api/admin/import/phone'
      const body = mode === 'email'
        ? { rawContent: content }
        : { text: content, callerName, callerPhone }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Import failed')
      const data = await res.json()
      setResult(data)
    } catch {
      setError('取り込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <Link href="/staff" className="text-gray-300 hover:text-white text-sm">← 一覧</Link>
        <h1 className="text-lg font-bold">📥 問い合わせ取り込み</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Mode selector */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setMode('email')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${mode === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              📧 メール取り込み
            </button>
            <button
              onClick={() => setMode('phone')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${mode === 'phone' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              📞 電話テキスト取り込み
            </button>
          </div>

          {mode === 'email' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">.eml ファイルの内容を貼り付け、またはメール本文をそのまま入力してください。</p>
              <textarea
                className="w-full border rounded p-3 min-h-[200px] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder={`From: taro.yamada@example.com\nSubject: ゴミ収集日について\n\n可燃ゴミはいつ出せばいいですか？`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}

          {mode === 'phone' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">電話での問い合わせ内容をテキストで入力してください。</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">発信者氏名</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    placeholder="任意"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">発信者電話番号</label>
                  <input
                    type="tel"
                    className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    placeholder="任意"
                  />
                </div>
              </div>
              <textarea
                className="w-full border rounded p-3 min-h-[150px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="電話での問い合わせ内容をここに入力してください..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}

          {error && <div className="p-3 bg-red-50 rounded text-red-700 text-sm">{error}</div>}

          {result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded space-y-2">
              <p className="text-green-700 text-sm font-medium">✅ 取り込み完了</p>
              <p className="text-xs text-gray-600">受付ID: {result.id}</p>
              <p className="text-xs text-gray-600">AI要約: {result.aiSummary}</p>
              <button
                onClick={() => router.push(`/staff/inquiries/${result.id}`)}
                className="text-sm text-blue-600 hover:underline"
              >
                詳細を見る →
              </button>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? '処理中...' : '取り込む'}
          </button>
        </div>
      </div>
    </div>
  )
}
