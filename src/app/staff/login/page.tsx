'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/staff/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'ログインに失敗しました')
        return
      }
      router.push('/staff')
      router.refresh()
    } catch {
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🏛️</div>
          <h1 className="text-xl font-bold text-gray-800">職員ログイン</h1>
          <p className="text-sm text-gray-500 mt-1">行政AI問い合わせ対応システム</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="admin1 または staff1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="admin123 または staff123"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="text-xs text-gray-400 text-center space-y-0.5">
          <p>デモ: admin1 / admin123（管理者）</p>
          <p>デモ: staff1 / staff123（職員）</p>
        </div>
      </div>
    </div>
  )
}
