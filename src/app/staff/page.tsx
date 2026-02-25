'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate, urgencyColor, urgencyLabel, importanceColor, statusColor, statusLabel, parseTags, channelLabel } from '@/lib/utils'

interface Inquiry {
  id: string
  createdAt: string
  channel: string
  rawText: string
  aiSummary: string
  urgency: string
  importance: string
  deptSuggested: string
  deptActual: string
  status: string
  tags: string
  isRead: boolean
  needsReply: boolean
  answers: { id: string; approvedAt: string | null; sentAt: string | null }[]
}

interface User {
  id: string
  username: string
  dept: string
  role: string
}

export default function StaffListPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [unansweredOnly, setUnansweredOnly] = useState(false)
  const [myDeptOnly, setMyDeptOnly] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [urgencyFilter, setUrgencyFilter] = useState('')

  const fetchMe = async () => {
    const res = await fetch('/api/staff/auth/me')
    if (!res.ok) { router.push('/staff/login'); return }
    const data = await res.json()
    setUser(data.user)
  }

  const fetchInquiries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      ...(unreadOnly && { unread: '1' }),
      ...(unansweredOnly && { unanswered: '1' }),
      ...(myDeptOnly && { mydept: '1' }),
      sort: sortBy,
      ...(urgencyFilter && { urgency: urgencyFilter }),
    })
    const res = await fetch(`/api/staff/inquiries?${params}`)
    if (res.ok) {
      const data = await res.json()
      setInquiries(data.inquiries)
    }
    setLoading(false)
  }, [unreadOnly, unansweredOnly, myDeptOnly, sortBy, urgencyFilter])

  useEffect(() => { fetchMe() }, [])
  useEffect(() => { fetchInquiries() }, [fetchInquiries])

  const handleLogout = async () => {
    await fetch('/api/staff/auth/logout', { method: 'POST' })
    router.push('/staff/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">🏛️ 職員ダッシュボード</h1>
          <nav className="flex gap-3 text-sm">
            <Link href="/staff" className="text-blue-300 font-medium">一覧</Link>
            <Link href="/staff/map" className="hover:text-blue-300">地図</Link>
            <Link href="/admin/import" className="hover:text-blue-300">取り込み</Link>
            <Link href="/admin/knowledge" className="hover:text-blue-300">ナレッジ</Link>
            <Link href="/admin/audit" className="hover:text-blue-300">監査ログ</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && <span className="text-gray-300">{user.username}（{user.dept}）</span>}
          <button onClick={handleLogout} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm transition">
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {/* Filters */}
        <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-medium text-gray-600">フィルタ:</span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            未読のみ
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={unansweredOnly} onChange={(e) => setUnansweredOnly(e.target.checked)} />
            未返答のみ
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={myDeptOnly} onChange={(e) => setMyDeptOnly(e.target.checked)} />
            自部署のみ
          </label>

          <span className="text-sm font-medium text-gray-600 ml-4">緊急度:</span>
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1 focus:outline-none"
          >
            <option value="">全て</option>
            <option value="HIGH">高</option>
            <option value="MED">中</option>
            <option value="LOW">低</option>
          </select>

          <span className="text-sm font-medium text-gray-600 ml-4">ソート:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border rounded px-2 py-1 focus:outline-none"
          >
            <option value="createdAt">最新順</option>
            <option value="urgency">緊急度</option>
            <option value="importance">重要度</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">{inquiries.length}件</span>
        </div>

        {/* Inquiry List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">該当する問い合わせがありません</div>
        ) : (
          <div className="space-y-2">
            {inquiries.map((inq) => {
              const tags = parseTags(inq.tags)
              const hasAnswer = inq.answers.length > 0
              const isSent = inq.answers.some((a) => a.sentAt)
              return (
                <Link key={inq.id} href={`/staff/inquiries/${inq.id}`}>
                  <div className={`bg-white rounded-lg border p-4 hover:border-blue-300 hover:shadow-sm transition cursor-pointer ${!inq.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {!inq.isRead && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">NEW</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${urgencyColor(inq.urgency)}`}>
                            緊急:{urgencyLabel(inq.urgency)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${importanceColor(inq.importance)}`}>
                            重要:{urgencyLabel(inq.importance)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor(inq.status)}`}>
                            {statusLabel(inq.status)}
                          </span>
                          <span className="text-xs text-gray-500">{channelLabel(inq.channel)}</span>
                          {inq.needsReply && !isSent && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">返答待ち</span>
                          )}
                        </div>
                        <p className="text-gray-800 text-sm font-medium truncate">{inq.aiSummary || inq.rawText}</p>
                        <p className="text-gray-500 text-xs truncate mt-0.5">{inq.rawText}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">{inq.deptActual || inq.deptSuggested}</span>
                          {tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400 shrink-0">
                        <div>{formatDate(inq.createdAt)}</div>
                        {hasAnswer && <div className="text-green-600 mt-1">回答あり</div>}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
