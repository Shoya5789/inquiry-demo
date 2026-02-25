'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface AuditLog {
  id: string
  createdAt: string
  actorUserId: string | null
  action: string
  targetType: string
  targetId: string
  metaJson: string
  actor: { username: string; dept: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  VIEW_INQUIRY: '閲覧',
  EDIT_TAGS: 'タグ編集',
  GENERATE_AI: 'AI生成',
  APPROVE_ANSWER: '承認',
  SEND_ANSWER: '送信',
  IMPORT_EMAIL: 'メール取込',
  IMPORT_PHONE: '電話取込',
  SYNC_KB: 'KB更新',
  CREATE_KB: 'KB作成',
  UPDATE_KB: 'KB編集',
  DELETE_KB: 'KB削除',
  SUBMIT_INQUIRY: '問い合わせ投稿',
}

const ACTION_COLORS: Record<string, string> = {
  VIEW_INQUIRY: 'bg-gray-100 text-gray-600',
  EDIT_TAGS: 'bg-blue-100 text-blue-700',
  GENERATE_AI: 'bg-purple-100 text-purple-700',
  APPROVE_ANSWER: 'bg-green-100 text-green-700',
  SEND_ANSWER: 'bg-teal-100 text-teal-700',
  IMPORT_EMAIL: 'bg-orange-100 text-orange-700',
  IMPORT_PHONE: 'bg-orange-100 text-orange-700',
  SYNC_KB: 'bg-yellow-100 text-yellow-700',
  CREATE_KB: 'bg-blue-100 text-blue-700',
  UPDATE_KB: 'bg-blue-100 text-blue-700',
  DELETE_KB: 'bg-red-100 text-red-700',
  SUBMIT_INQUIRY: 'bg-gray-100 text-gray-600',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/audit?limit=200')
      .then((r) => r.json())
      .then((data) => { setLogs(data.logs || []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <Link href="/staff" className="text-gray-300 hover:text-white text-sm">← 一覧</Link>
        <h1 className="text-lg font-bold">📋 監査ログ</h1>
        <span className="text-gray-300 text-sm">{logs.length}件</span>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">日時</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">操作者</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">アクション</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">対象種別</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">対象ID</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">メタ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  let meta: Record<string, unknown> = {}
                  try { meta = JSON.parse(log.metaJson) } catch { meta = {} }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {log.actor ? `${log.actor.username}（${log.actor.dept}）` : '住民'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{log.targetType}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-400 max-w-[120px] truncate">
                        {log.targetType === 'Inquiry' ? (
                          <Link href={`/staff/inquiries/${log.targetId}`} className="text-blue-600 hover:underline">
                            {log.targetId.slice(0, 8)}...
                          </Link>
                        ) : (
                          <span>{log.targetId.slice(0, 8)}...</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-[200px] truncate">
                        {Object.entries(meta)
                          .filter(([k]) => k !== 'inquiryId')
                          .map(([k, v]) => `${k}:${v}`)
                          .join(' ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
