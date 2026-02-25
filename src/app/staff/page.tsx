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

function UrgencyBadge({ level }: { level: 'HIGH' | 'MED' | 'LOW' }) {
  const map = {
    HIGH: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500', label: '緊急' },
    MED:  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500', label: '中' },
    LOW:  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', label: '低' },
  }
  const s = map[level]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function PriorityGroupHeader({ urgency, count }: { urgency: string; count: number }) {
  const styles = {
    HIGH: { bg: 'bg-red-600', label: '🔴 緊急対応', sub: '今すぐ確認が必要な問い合わせ' },
    MED:  { bg: 'bg-amber-500', label: '🟡 通常対応', sub: '今日・明日中の対応が必要な問い合わせ' },
    LOW:  { bg: 'bg-emerald-600', label: '🟢 低優先度', sub: '余裕をもって対応できる問い合わせ' },
  }[urgency] || { bg: 'bg-gray-500', label: urgency, sub: '' }

  return (
    <div className={`${styles.bg} text-white px-4 py-2.5 rounded-xl mb-2 flex items-center justify-between`}>
      <div>
        <p className="font-bold text-sm">{styles.label}</p>
        <p className="text-xs opacity-80">{styles.sub}</p>
      </div>
      <div className="bg-white/20 text-white font-black text-lg px-3 py-0.5 rounded-lg">{count}</div>
    </div>
  )
}

function InquiryCard({ inq, compact = false }: { inq: Inquiry; compact?: boolean }) {
  const tags = parseTags(inq.tags)
  const hasAnswer = inq.answers.length > 0
  const isSent = inq.answers.some((a) => a.sentAt)

  return (
    <Link href={`/staff/inquiries/${inq.id}`}>
      <div className={`bg-white rounded-xl border hover:border-blue-400 hover:shadow-md transition cursor-pointer group ${!inq.isRead ? 'border-l-4 border-l-blue-500 border-gray-200' : 'border-gray-200'} ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {!inq.isRead && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">NEW</span>}
              <UrgencyBadge level={inq.urgency as 'HIGH' | 'MED' | 'LOW'} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${importanceColor(inq.importance)}`}>
                重要:{urgencyLabel(inq.importance)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inq.status)}`}>
                {statusLabel(inq.status)}
              </span>
              {inq.needsReply && !isSent && (
                <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-medium">返答待ち</span>
              )}
            </div>

            <p className="text-gray-900 text-sm font-semibold truncate group-hover:text-blue-700 transition">
              {inq.aiSummary || inq.rawText}
            </p>
            {!compact && (
              <p className="text-gray-500 text-xs truncate mt-0.5">{inq.rawText}</p>
            )}

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{inq.deptActual || inq.deptSuggested}</span>
              <span className="text-xs text-gray-400">{channelLabel(inq.channel)}</span>
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          </div>

          <div className="text-right text-xs text-gray-400 shrink-0">
            <div>{formatDate(inq.createdAt)}</div>
            {hasAnswer && <div className="text-emerald-600 font-medium mt-1">✓ 回答あり</div>}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function StaffListPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'priority'>('list')

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

  // 優先度ビュー用グループ化
  const grouped = {
    HIGH: inquiries.filter((i) => i.urgency === 'HIGH'),
    MED:  inquiries.filter((i) => i.urgency === 'MED'),
    LOW:  inquiries.filter((i) => i.urgency === 'LOW'),
  }

  const unreadCount = inquiries.filter((i) => !i.isRead).length
  const pendingReplyCount = inquiries.filter((i) => i.needsReply && !i.answers.some((a) => a.sentAt)).length

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-5 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/30 flex items-center justify-center font-black text-xs">P</div>
            <h1 className="font-bold text-sm tracking-wide">PubTech AI 職員ポータル</h1>
          </div>
          <nav className="flex gap-1 text-xs">
            {[
              { href: '/staff', label: '一覧', active: true },
              { href: '/staff/map', label: '地図' },
              { href: '/admin/import', label: '取り込み' },
              { href: '/admin/knowledge', label: 'ナレッジ' },
              { href: '/admin/audit', label: '監査ログ' },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {user && <span className="text-slate-300">{user.username}（{user.dept}）</span>}
          <button onClick={handleLogout} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition">
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '総件数', value: inquiries.length, color: 'text-gray-800', bg: 'bg-white' },
            { label: '未読', value: unreadCount, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: '緊急', value: grouped.HIGH.length, color: 'text-red-700', bg: 'bg-red-50' },
            { label: '返答待ち', value: pendingReplyCount, color: 'text-orange-700', bg: 'bg-orange-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl border border-gray-200 px-4 py-3 text-center`}>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-3 items-center">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ≡ リスト
            </button>
            <button
              onClick={() => setViewMode('priority')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'priority' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ⚡ 優先度
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          <span className="text-xs font-medium text-gray-500">フィルタ:</span>
          {[
            { label: '未読のみ', checked: unreadOnly, set: setUnreadOnly },
            { label: '未返答のみ', checked: unansweredOnly, set: setUnansweredOnly },
            { label: '自部署のみ', checked: myDeptOnly, set: setMyDeptOnly },
          ].map(({ label, checked, set }) => (
            <label key={label} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)}
                className="rounded accent-blue-600" />
              {label}
            </label>
          ))}

          <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
            <option value="">緊急度: 全て</option>
            <option value="HIGH">🔴 緊急</option>
            <option value="MED">🟡 中</option>
            <option value="LOW">🟢 低</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
            <option value="createdAt">最新順</option>
            <option value="urgency">緊急度順</option>
            <option value="importance">重要度順</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">{inquiries.length}件</span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin w-8 h-8 mb-3 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            読み込み中...
          </div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            該当する問い合わせがありません
          </div>
        ) : viewMode === 'priority' ? (
          /* ─── 優先度ビュー ─── */
          <div className="grid grid-cols-3 gap-4">
            {(['HIGH', 'MED', 'LOW'] as const).map((urgency) => (
              <div key={urgency}>
                <PriorityGroupHeader urgency={urgency} count={grouped[urgency].length} />
                <div className="space-y-2">
                  {grouped[urgency].length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">なし</div>
                  ) : (
                    grouped[urgency].map((inq) => (
                      <InquiryCard key={inq.id} inq={inq} compact />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ─── リストビュー ─── */
          <div className="space-y-2">
            {inquiries.map((inq) => (
              <InquiryCard key={inq.id} inq={inq} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
