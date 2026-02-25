'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { formatDate, urgencyColor, urgencyLabel, importanceColor, statusColor, statusLabel, parseTags, channelLabel } from '@/lib/utils'

const MapView = dynamic(() => import('@/components/shared/MapView'), { ssr: false })

interface InquiryDetail {
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
  followupQAJson: string
  needsReply: boolean
  contactName: string
  contactEmail: string
  contactPhone: string
  addressText: string
  lat: number | null
  lng: number | null
  answers: AnswerDetail[]
}

interface AnswerDetail {
  id: string
  createdAt: string
  draftPolicyJson: string
  draftAnswerText: string
  draftSupplementalText: string
  sourcesJson: string
  finalAnswerText: string
  approvedAt: string | null
  sentAt: string | null
  sentChannel: string
  approvedBy: { username: string; dept: string } | null
}

interface SimilarCase {
  inquiryId: string
  score: number
  summary: string
  finalAnswerText?: string
}

interface Source {
  sourceId: string
  type: string
  title: string
  uri: string
  snippet: string
  score: number
}

interface Policy {
  conclusion: string
  reasoning: string
  missingInfo: string[]
  cautions: string[]
  nextActions: string[]
}

export default function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // AI Answer state
  const [aiAnswer, setAiAnswer] = useState<AnswerDetail | null>(null)
  const [aiSources, setAiSources] = useState<Source[]>([])
  const [aiSimilar, setAiSimilar] = useState<SimilarCase[]>([])
  const [aiPolicy, setAiPolicy] = useState<Policy | null>(null)
  const [editedAnswer, setEditedAnswer] = useState('')

  // Tags
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  // Dept
  const [deptActual, setDeptActual] = useState('')

  const fetchInquiry = async () => {
    const res = await fetch(`/api/staff/inquiries/${id}`)
    if (!res.ok) { setError('問い合わせが見つかりません'); setLoading(false); return }
    const data = await res.json()
    const inq = data.inquiry as InquiryDetail
    setInquiry(inq)
    setTags(parseTags(inq.tags))
    setDeptActual(inq.deptActual || inq.deptSuggested)

    // 最新のAnswer
    if (inq.answers.length > 0) {
      const latest = inq.answers[0]
      setAiAnswer(latest)
      setEditedAnswer(latest.finalAnswerText || latest.draftAnswerText)
      try { setAiSources(JSON.parse(latest.sourcesJson || '[]')) } catch { setAiSources([]) }
      try { setAiPolicy(JSON.parse(latest.draftPolicyJson || '{}')) } catch { setAiPolicy(null) }
    }
    setLoading(false)
  }

  useEffect(() => { fetchInquiry() }, [id])

  // タグ保存
  const saveTags = async (newTags: string[]) => {
    await fetch(`/api/staff/inquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: JSON.stringify(newTags) }),
    })
  }

  const addTag = () => {
    if (!newTag.trim()) return
    const updated = [...tags, newTag.trim()]
    setTags(updated)
    saveTags(updated)
    setNewTag('')
  }

  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag)
    setTags(updated)
    saveTags(updated)
  }

  // 部署更新
  const saveDept = async () => {
    await fetch(`/api/staff/inquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptActual }),
    })
    setSuccess('部署を更新しました')
    setTimeout(() => setSuccess(''), 2000)
  }

  // AI回答生成
  const generateAIAnswer = async () => {
    setAiLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/inquiries/${id}/ai/answer`, { method: 'POST' })
      if (!res.ok) throw new Error('AI generation failed')
      const data = await res.json()
      setAiAnswer(data.answer)
      setAiSources(data.sources || [])
      setAiSimilar(data.similar || [])
      setEditedAnswer(data.answer.draftAnswerText)
      try { setAiPolicy(JSON.parse(data.answer.draftPolicyJson || '{}')) } catch { setAiPolicy(null) }
      setSuccess('AI回答案を生成しました')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('AI回答生成に失敗しました')
    } finally {
      setAiLoading(false)
    }
  }

  // 承認
  const approveAnswer = async () => {
    if (!aiAnswer) return
    if (!editedAnswer.trim()) { setError('回答文を入力してください'); return }
    try {
      const res = await fetch(`/api/inquiries/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: aiAnswer.id, finalAnswerText: editedAnswer }),
      })
      if (!res.ok) throw new Error('Approve failed')
      setSuccess('承認しました')
      fetchInquiry()
    } catch {
      setError('承認に失敗しました')
    }
  }

  // 送信
  const sendAnswer = async (channel: 'email' | 'phone' | 'none') => {
    if (!aiAnswer) return
    try {
      const res = await fetch(`/api/inquiries/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: aiAnswer.id, sentChannel: channel }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const data = await res.json()
      setSuccess(data.message)
      fetchInquiry()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '送信に失敗しました'
      setError(msg)
    }
  }

  const followupQA: Array<{ question: string; answer: string }> = (() => {
    try { return JSON.parse(inquiry?.followupQAJson || '[]') } catch { return [] }
  })()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中...</div>
  if (!inquiry) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>

  const latestAnswer = inquiry.answers[0]
  const isApproved = !!latestAnswer?.approvedAt
  const isSent = !!latestAnswer?.sentAt

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <Link href="/staff" className="text-gray-300 hover:text-white text-sm">← 一覧</Link>
        <h1 className="text-lg font-bold truncate flex-1">問い合わせ詳細</h1>
        <span className={`text-xs px-2 py-1 rounded font-medium ${statusColor(inquiry.status)}`}>{statusLabel(inquiry.status)}</span>
      </header>

      {success && <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-green-700 text-sm">{success}</div>}
      {error && <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm">{error}</div>}

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* 基本情報 */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-xs px-2 py-1 rounded font-medium ${urgencyColor(inquiry.urgency)}`}>緊急:{urgencyLabel(inquiry.urgency)}</span>
            <span className={`text-xs px-2 py-1 rounded font-medium ${importanceColor(inquiry.importance)}`}>重要:{urgencyLabel(inquiry.importance)}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{channelLabel(inquiry.channel)}</span>
            <span className="text-xs text-gray-500">{formatDate(inquiry.createdAt)}</span>
          </div>

          <h2 className="text-lg font-bold text-gray-800 mb-2">{inquiry.aiSummary}</h2>

          <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap mb-3">{inquiry.rawText}</div>

          {/* 追加質問回答 */}
          {followupQA.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">追加質問への回答:</p>
              {followupQA.map((qa, i) => (
                <div key={i} className="bg-blue-50 rounded p-2 text-sm">
                  <span className="font-medium text-blue-800">Q: {qa.question}</span>
                  <span className="block text-gray-700 mt-0.5">A: {qa.answer || '（未回答）'}</span>
                </div>
              ))}
            </div>
          )}

          {/* 位置情報 */}
          {inquiry.lat && inquiry.lng && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-600 mb-1">📍 {inquiry.addressText || '位置情報あり'}</p>
              <div className="h-48 rounded-lg overflow-hidden border">
                <MapView lat={inquiry.lat} lng={inquiry.lng} popup={inquiry.aiSummary} />
              </div>
            </div>
          )}
        </div>

        {/* 担当部署・タグ編集 */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">担当部署・タグ</h3>

          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm text-gray-600 w-20">担当部署:</label>
            <input
              type="text"
              value={deptActual}
              onChange={(e) => setDeptActual(e.target.value)}
              className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button onClick={saveDept} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition">更新</button>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">タグ:</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="タグを追加..."
                className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button onClick={addTag} className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition">追加</button>
            </div>
          </div>
        </div>

        {/* 連絡先 */}
        {inquiry.needsReply && (
          <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
            <h3 className="font-semibold text-orange-800 mb-2">📬 返答要求あり</h3>
            <div className="text-sm space-y-1">
              {inquiry.contactName && <p>氏名: {inquiry.contactName}</p>}
              {inquiry.contactEmail && <p>メール: {inquiry.contactEmail}</p>}
              {inquiry.contactPhone && <p>電話: {inquiry.contactPhone}</p>}
            </div>
          </div>
        )}

        {/* 類似問い合わせ */}
        {aiSimilar.length > 0 && (
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold text-gray-700 mb-3">🔍 類似問い合わせ（Top{aiSimilar.length}件）</h3>
            <div className="space-y-3">
              {aiSimilar.map((sim) => (
                <div key={sim.inquiryId} className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">類似度 {Math.round(sim.score * 100)}%</span>
                    <Link href={`/staff/inquiries/${sim.inquiryId}`} className="text-xs text-blue-600 hover:underline">詳細を見る →</Link>
                  </div>
                  <p className="text-sm text-gray-800">{sim.summary}</p>
                  {sim.finalAnswerText && (
                    <div className="mt-2 bg-green-50 rounded p-2 text-xs text-gray-700">
                      <span className="font-medium text-green-700">過去の最終回答:</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{sim.finalAnswerText.slice(0, 300)}{sim.finalAnswerText.length > 300 ? '...' : ''}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI回答生成 */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">🤖 AI回答案生成</h3>
            <button
              onClick={generateAIAnswer}
              disabled={aiLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
            >
              {aiLoading ? '生成中...' : 'AI回答案を生成'}
            </button>
          </div>

          {/* 参照ソース */}
          {aiSources.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-2">参照ソース（Agentic Search結果）:</p>
              <div className="space-y-2">
                {aiSources.map((src) => (
                  <div key={src.sourceId} className="bg-blue-50 rounded p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-blue-800">{src.title}</span>
                      <span className="text-blue-600">スコア:{Math.round(src.score * 100)}%</span>
                    </div>
                    <p className="text-gray-600 mt-0.5">{src.snippet.slice(0, 150)}...</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 回答方針 */}
          {aiPolicy && (
            <div className="mb-4 bg-gray-50 rounded p-3 text-sm space-y-2">
              <p className="font-medium text-gray-700">回答方針:</p>
              <p><span className="text-gray-500">結論:</span> {aiPolicy.conclusion}</p>
              <p><span className="text-gray-500">根拠:</span> {aiPolicy.reasoning}</p>
              {aiPolicy.missingInfo?.length > 0 && (
                <p><span className="text-gray-500">不足情報:</span> {aiPolicy.missingInfo.join('、')}</p>
              )}
              {aiPolicy.cautions?.length > 0 && (
                <p><span className="text-gray-500">注意:</span> {aiPolicy.cautions.join('、')}</p>
              )}
              {aiPolicy.nextActions?.length > 0 && (
                <p><span className="text-gray-500">次のアクション:</span> {aiPolicy.nextActions.join('、')}</p>
              )}
            </div>
          )}

          {/* 回答文編集 */}
          {(aiAnswer || latestAnswer) && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">回答文（編集可）:</label>
              <textarea
                className="w-full border rounded p-3 min-h-[150px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={editedAnswer}
                onChange={(e) => setEditedAnswer(e.target.value)}
                disabled={isApproved}
              />

              {aiAnswer?.draftSupplementalText && (
                <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">補足情報:</p>
                  <p className="whitespace-pre-wrap">{aiAnswer.draftSupplementalText}</p>
                </div>
              )}

              {/* 承認済み表示 */}
              {isApproved && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                  ✅ 承認済み（{latestAnswer?.approvedBy?.username}・{formatDate(latestAnswer?.approvedAt!)}）
                </div>
              )}

              {/* 送信済み表示 */}
              {isSent && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                  📨 送信済み（{latestAnswer?.sentChannel}・{formatDate(latestAnswer?.sentAt!)}）
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                {!isApproved && (
                  <button
                    onClick={approveAnswer}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition"
                  >
                    ✅ 承認する
                  </button>
                )}
                {isApproved && !isSent && (
                  <>
                    {inquiry.contactEmail && (
                      <button
                        onClick={() => sendAnswer('email')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition"
                      >
                        📧 メールで送信
                      </button>
                    )}
                    {inquiry.contactPhone && (
                      <button
                        onClick={() => sendAnswer('phone')}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm transition"
                      >
                        📞 電話連絡済みとして記録
                      </button>
                    )}
                    <button
                      onClick={() => sendAnswer('none')}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg text-sm transition"
                    >
                      記録のみ
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
