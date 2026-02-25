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

  const [aiAnswer, setAiAnswer] = useState<AnswerDetail | null>(null)
  const [aiSources, setAiSources] = useState<Source[]>([])
  const [aiSimilar, setAiSimilar] = useState<SimilarCase[]>([])
  const [aiPolicy, setAiPolicy] = useState<Policy | null>(null)
  const [editedAnswer, setEditedAnswer] = useState('')

  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [deptActual, setDeptActual] = useState('')

  const fetchInquiry = async () => {
    const res = await fetch(`/api/staff/inquiries/${id}`)
    if (!res.ok) { setError('問い合わせが見つかりません'); setLoading(false); return }
    const data = await res.json()
    const inq = data.inquiry as InquiryDetail
    setInquiry(inq)
    setTags(parseTags(inq.tags))
    setDeptActual(inq.deptActual || inq.deptSuggested)
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

  const saveTags = async (newTags: string[]) => {
    await fetch(`/api/staff/inquiries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: JSON.stringify(newTags) }),
    })
  }

  const addTag = () => {
    if (!newTag.trim()) return
    const updated = [...tags, newTag.trim()]
    setTags(updated); saveTags(updated); setNewTag('')
  }
  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag)
    setTags(updated); saveTags(updated)
  }

  const saveDept = async () => {
    await fetch(`/api/staff/inquiries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptActual }),
    })
    setSuccess('部署を更新しました')
    setTimeout(() => setSuccess(''), 2000)
  }

  const generateAIAnswer = async () => {
    setAiLoading(true); setError('')
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

  const approveAnswer = async () => {
    if (!aiAnswer || !editedAnswer.trim()) { setError('回答文を入力してください'); return }
    try {
      const res = await fetch(`/api/inquiries/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: aiAnswer.id, finalAnswerText: editedAnswer }),
      })
      if (!res.ok) throw new Error()
      setSuccess('承認しました')
      fetchInquiry()
    } catch { setError('承認に失敗しました') }
  }

  const sendAnswer = async (channel: 'email' | 'phone' | 'none') => {
    if (!aiAnswer) return
    try {
      const res = await fetch(`/api/inquiries/${id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: aiAnswer.id, sentChannel: channel }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const data = await res.json()
      setSuccess(data.message); fetchInquiry()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '送信に失敗しました')
    }
  }

  const followupQA: Array<{ question: string; answer: string }> = (() => {
    try { return JSON.parse(inquiry?.followupQAJson || '[]') } catch { return [] }
  })()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center text-gray-500">
        <svg className="animate-spin w-8 h-8 mx-auto mb-3 text-blue-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        読み込み中...
      </div>
    </div>
  )

  if (!inquiry) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>

  const latestAnswer = inquiry.answers[0]
  const isApproved = !!latestAnswer?.approvedAt
  const isSent = !!latestAnswer?.sentAt

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-5 py-3 flex items-center gap-4 shadow-lg">
        <Link href="/staff" className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition">
          ← 一覧
        </Link>
        <div className="w-px h-4 bg-slate-600" />
        <h1 className="font-bold text-sm flex-1 truncate">問い合わせ詳細</h1>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(inquiry.status)}`}>
          {statusLabel(inquiry.status)}
        </span>
      </header>

      {/* Notifications */}
      {success && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-emerald-700 text-sm flex items-center gap-2">
          <span>✅</span> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4">
        {/* 2-column layout */}
        <div className="grid grid-cols-5 gap-4 items-start">

          {/* ─── Left: Inquiry Info (3/5) ─── */}
          <div className="col-span-3 space-y-4">

            {/* 基本情報 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${urgencyColor(inquiry.urgency)}`}>
                  ⚡ 緊急:{urgencyLabel(inquiry.urgency)}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${importanceColor(inquiry.importance)}`}>
                  ★ 重要:{urgencyLabel(inquiry.importance)}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{channelLabel(inquiry.channel)}</span>
                <span className="text-xs text-gray-400 ml-auto">{formatDate(inquiry.createdAt)}</span>
              </div>

              <h2 className="text-lg font-bold text-gray-900 mb-3 leading-snug">{inquiry.aiSummary}</h2>

              <div className="bg-slate-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-slate-100">
                {inquiry.rawText}
              </div>

              {followupQA.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">追加質問への回答</p>
                  {followupQA.map((qa, i) => (
                    <div key={i} className="bg-blue-50 rounded-lg p-3 text-sm border border-blue-100">
                      <p className="font-semibold text-blue-800 text-xs mb-1">Q: {qa.question}</p>
                      <p className="text-gray-700">A: {qa.answer || '（未回答）'}</p>
                    </div>
                  ))}
                </div>
              )}

              {inquiry.lat && inquiry.lng && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    📍 {inquiry.addressText || '位置情報あり'}
                  </p>
                  <div className="h-44 rounded-xl overflow-hidden border border-gray-200">
                    <MapView lat={inquiry.lat} lng={inquiry.lng} popup={inquiry.aiSummary} />
                  </div>
                </div>
              )}
            </div>

            {/* 担当部署・タグ */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">担当部署・タグ</h3>

              <div className="flex items-center gap-2 mb-4">
                <input type="text" value={deptActual} onChange={(e) => setDeptActual(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button onClick={saveDept}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium">
                  更新
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full border border-indigo-200">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-red-500 transition">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="タグを追加..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <button onClick={addTag}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition">
                  + 追加
                </button>
              </div>
            </div>

            {/* 連絡先 */}
            {inquiry.needsReply && (
              <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                <h3 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                  <span>📬</span> 返答要求あり
                </h3>
                <div className="text-sm space-y-1 text-orange-900">
                  {inquiry.contactName && <p><span className="font-medium">氏名:</span> {inquiry.contactName}</p>}
                  {inquiry.contactEmail && <p><span className="font-medium">メール:</span> {inquiry.contactEmail}</p>}
                  {inquiry.contactPhone && <p><span className="font-medium">電話:</span> {inquiry.contactPhone}</p>}
                </div>
              </div>
            )}

            {/* 類似問い合わせ */}
            {aiSimilar.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  🔍 類似問い合わせ（Top {aiSimilar.length}件）
                </h3>
                <div className="space-y-2.5">
                  {aiSimilar.map((sim) => (
                    <div key={sim.inquiryId} className="border border-gray-100 rounded-xl p-3 bg-slate-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          類似度 {Math.round(sim.score * 100)}%
                        </span>
                        <Link href={`/staff/inquiries/${sim.inquiryId}`} className="text-xs text-blue-600 hover:underline">
                          詳細 →
                        </Link>
                      </div>
                      <p className="text-sm text-gray-800">{sim.summary}</p>
                      {sim.finalAnswerText && (
                        <div className="mt-2 bg-emerald-50 rounded-lg p-2 text-xs text-gray-700 border border-emerald-100">
                          <p className="font-semibold text-emerald-700 mb-0.5">過去の回答:</p>
                          <p className="whitespace-pre-wrap">
                            {sim.finalAnswerText.slice(0, 200)}{sim.finalAnswerText.length > 200 ? '…' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── Right: AI Answer Panel (2/5) — sticky ─── */}
          <div className="col-span-2">
            <div className="sticky top-4 space-y-3">

              {/* AI Generate CTA */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg">🤖</div>
                  <div>
                    <h3 className="font-bold text-sm">AI 回答案生成</h3>
                    <p className="text-violet-200 text-xs">ナレッジと類似事例を参照して生成</p>
                  </div>
                </div>
                <button
                  onClick={generateAIAnswer}
                  disabled={aiLoading}
                  className="w-full mt-3 py-2.5 bg-white text-violet-700 font-bold text-sm rounded-lg hover:bg-violet-50 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      生成中...
                    </>
                  ) : (aiAnswer ? '🔄 再生成する' : '✨ AI回答案を生成')}
                </button>
              </div>

              {/* Generated Answer */}
              {(aiAnswer || latestAnswer) && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Sources */}
                  {aiSources.length > 0 && (
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">参照ソース</p>
                      <div className="space-y-1.5">
                        {aiSources.map((src) => (
                          <div key={src.sourceId} className="bg-blue-50 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-blue-800 truncate">{src.title}</span>
                              <span className="text-blue-500 shrink-0 ml-2">{Math.round(src.score * 100)}%</span>
                            </div>
                            <p className="text-gray-500 mt-0.5 line-clamp-2">{src.snippet.slice(0, 100)}…</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Policy */}
                  {aiPolicy && aiPolicy.conclusion && (
                    <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">回答方針</p>
                      <div className="text-xs space-y-1 text-gray-700">
                        <p><span className="font-semibold">結論:</span> {aiPolicy.conclusion}</p>
                        {aiPolicy.reasoning && <p><span className="font-semibold">根拠:</span> {aiPolicy.reasoning}</p>}
                        {aiPolicy.cautions?.length > 0 && (
                          <p className="text-amber-700"><span className="font-semibold">注意:</span> {aiPolicy.cautions.join('、')}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Answer text editor */}
                  <div className="p-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      回答文（編集可）
                    </label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg p-3 min-h-[180px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
                      value={editedAnswer}
                      onChange={(e) => setEditedAnswer(e.target.value)}
                      disabled={isApproved}
                      placeholder="AI回答案を生成するとここに表示されます"
                    />

                    {aiAnswer?.draftSupplementalText && (
                      <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs text-gray-600 border border-slate-100">
                        <p className="font-semibold mb-1">補足情報</p>
                        <p className="whitespace-pre-wrap">{aiAnswer.draftSupplementalText}</p>
                      </div>
                    )}

                    {/* Status badges */}
                    {isApproved && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                        ✅ 承認済み — {latestAnswer?.approvedBy?.username}（{formatDate(latestAnswer?.approvedAt!)}）
                      </div>
                    )}
                    {isSent && (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                        📨 送信済み — {latestAnswer?.sentChannel}（{formatDate(latestAnswer?.sentAt!)}）
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 space-y-2">
                      {!isApproved && (
                        <button onClick={approveAnswer}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2">
                          ✅ 承認する
                        </button>
                      )}

                      {isApproved && !isSent && (
                        <div className="space-y-2">
                          {inquiry.contactEmail && (
                            <button onClick={() => sendAnswer('email')}
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2">
                              📧 メールで送信
                            </button>
                          )}
                          {inquiry.contactPhone && (
                            <button onClick={() => sendAnswer('phone')}
                              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2">
                              📞 電話連絡済みとして記録
                            </button>
                          )}
                          <button onClick={() => sendAnswer('none')}
                            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition">
                            記録のみ（送信なし）
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Prompt when no answer yet */}
              {!aiAnswer && !latestAnswer && (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-5 text-center text-gray-400 text-sm">
                  <div className="text-3xl mb-2">🤖</div>
                  上の「AI回答案を生成」ボタンを押すと<br />ここに回答案が表示されます
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
