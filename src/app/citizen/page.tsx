'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/shared/MapPicker'), { ssr: false })

interface Recommendation {
  title: string
  body: string
  url?: string
}

interface FollowupQuestion {
  id: string
  text: string
  type: 'single' | 'multi' | 'text'
  options?: string[]
}

export default function CitizenPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [rawText, setRawText] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [disclaimer, setDisclaimer] = useState('')
  const [followupQuestions, setFollowupQuestions] = useState<FollowupQuestion[]>([])
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({})
  const [needsReply, setNeedsReply] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [addressText, setAddressText] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)

  const startVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('このブラウザは音声入力に対応していません。')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let t = ''
      for (let i = event.resultIndex; i < event.results.length; i++) t += event.results[i][0].transcript
      setRawText((prev) => prev + t)
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
    setIsListening(true)
  }, [])

  const handleStep0Next = async () => {
    if (!rawText.trim()) { setError('お問い合わせ内容を入力してください。'); return }
    setError('')
    setLoading(true)
    try {
      const [recRes, fqRes] = await Promise.all([
        fetch('/api/ai/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: rawText }) }),
        fetch('/api/ai/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: rawText }) }),
      ])
      if (recRes.ok) {
        const d = await recRes.json()
        setRecommendations(d.recommendations || [])
        setDisclaimer(d.disclaimer || '')
      }
      if (fqRes.ok) {
        const d = await fqRes.json()
        setFollowupQuestions(d.questions || [])
      }
      setStep(1)
    } catch {
      setError('エラーが発生しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const followupQA = followupQuestions.map((q) => ({ question: q.text, answer: followupAnswers[q.id] || '' }))
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, channel: 'web', followupQAJson: JSON.stringify(followupQA), needsReply, contactName, contactEmail, contactPhone, addressText, lat, lng, locale: 'ja' }),
      })
      if (!res.ok) throw new Error('Submit failed')
      const data = await res.json()
      router.push(`/citizen/done?id=${data.id}`)
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 40%, #1d4ed8 100%)' }}>
      {/* Logo bar */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">P</div>
          <span className="text-white/80 text-sm font-medium tracking-wide">PubTech AI 行政サポート</span>
        </div>
      </div>

      {/* Hero */}
      <div className="px-6 pt-6 pb-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">お問い合わせ</h1>
        <p className="text-blue-200 text-sm">AIが自動で内容を整理・担当部署へ転送します</p>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-3 mt-5">
          {['内容入力', '確認・追加情報', '送信'].map((label, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= i ? 'bg-white text-blue-700' : 'bg-white/20 text-white/50'}`}>
                  {step > i ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${step >= i ? 'text-blue-100' : 'text-white/40'}`}>{label}</span>
              </div>
              {i < 2 && <div className={`w-10 h-px mx-1 mb-4 ${step > i ? 'bg-white' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="mx-4 mb-8 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-red-700 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="p-6">
          {/* ─── Step 0: 入力 ─── */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">お問い合わせ内容 <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-4 min-h-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm resize-none leading-relaxed transition"
                  placeholder="例：近所の道路に大きな穴が開いていて危険です。場所は〇〇町2丁目の交差点付近です。"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={startVoice}
                    disabled={isListening}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition disabled:opacity-50"
                  >
                    🎤 {isListening ? '録音中...' : '音声入力'}
                  </button>
                  {isListening && <span className="text-red-500 text-xs animate-pulse font-medium">● 録音中</span>}
                  <span className="text-xs text-gray-400">{rawText.length}文字</span>
                </div>
              </div>

              <button
                onClick={handleStep0Next}
                disabled={loading || !rawText.trim()}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AIが分析中...
                  </span>
                ) : '次へ　→'}
              </button>
            </div>
          )}

          {/* ─── Step 1: レコメンド + 追加質問 ─── */}
          {step === 1 && (
            <div className="space-y-6">
              {/* レコメンド */}
              {recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs">📚</div>
                    <h3 className="font-semibold text-gray-800 text-sm">AIが見つけた関連情報</h3>
                  </div>
                  <div className="space-y-2.5">
                    {recommendations.map((rec, i) => (
                      <div key={i} className="border border-blue-100 rounded-xl p-4 bg-blue-50/50">
                        <p className="font-semibold text-blue-900 text-sm">{rec.title}</p>
                        <p className="text-gray-600 text-xs mt-1 leading-relaxed">{rec.body}</p>
                        {rec.url && (
                          <a href={rec.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 text-xs mt-2 hover:underline font-medium">
                            詳しく見る <span>→</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  {disclaimer && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex gap-1.5">
                      <span className="shrink-0">⚠️</span>
                      <span>{disclaimer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 追加質問 */}
              {followupQuestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs">💬</div>
                    <h3 className="font-semibold text-gray-800 text-sm">追加の質問（任意）</h3>
                    <span className="text-xs text-gray-400 ml-auto">スキップ可能です</span>
                  </div>
                  <div className="space-y-3">
                    {followupQuestions.map((q) => (
                      <div key={q.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-gray-800 text-sm font-medium mb-2.5">{q.text}</p>
                        {q.type === 'text' && (
                          <textarea
                            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none bg-white"
                            rows={2}
                            placeholder="任意で入力してください"
                            value={followupAnswers[q.id] || ''}
                            onChange={(e) => setFollowupAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          />
                        )}
                        {q.type === 'single' && q.options && (
                          <div className="grid gap-1.5">
                            {q.options.map((opt) => (
                              <label key={opt} className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition text-sm ${followupAnswers[q.id] === opt ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt}
                                  checked={followupAnswers[q.id] === opt}
                                  onChange={() => setFollowupAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                  className="accent-blue-600"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {q.type === 'multi' && q.options && (
                          <div className="grid gap-1.5">
                            {q.options.map((opt) => {
                              const checked = (followupAnswers[q.id] || '').split(',').includes(opt)
                              return (
                                <label key={opt} className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition text-sm ${checked ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const cur = (followupAnswers[q.id] || '').split(',').filter(Boolean)
                                      const next = e.target.checked ? [...cur, opt] : cur.filter((v) => v !== opt)
                                      setFollowupAnswers((prev) => ({ ...prev, [q.id]: next.join(',') }))
                                    }}
                                    className="accent-blue-600"
                                  />
                                  {opt}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(0)}
                  className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition font-medium">
                  ← 戻る
                </button>
                <button onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}>
                  次へ　→
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: 連絡先・確認 ─── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* 送信内容確認 */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">お問い合わせ内容</p>
                <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{rawText}</p>
              </div>

              {/* 返答希望 */}
              <div className={`rounded-xl border-2 p-4 cursor-pointer transition ${needsReply ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
                onClick={() => setNeedsReply(!needsReply)}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${needsReply ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {needsReply && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${needsReply ? 'text-blue-800' : 'text-gray-700'}`}>返答を希望する</p>
                    <p className="text-xs text-gray-500 mt-0.5">チェックすると担当者からご連絡します</p>
                  </div>
                </label>
              </div>

              {needsReply && (
                <div className="space-y-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">連絡先情報</p>
                  {[
                    { label: 'お名前', type: 'text', value: contactName, set: setContactName, placeholder: '山田 太郎' },
                    { label: 'メールアドレス', type: 'email', value: contactEmail, set: setContactEmail, placeholder: 'example@mail.com' },
                    { label: '電話番号', type: 'tel', value: contactPhone, set: setContactPhone, placeholder: '090-0000-0000' },
                  ].map(({ label, type, value, set, placeholder }) => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input
                        type={type}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 位置情報 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">場所・位置情報（任意）</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
                  placeholder="例：〇〇市〇〇町1-2-3"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                />
                <div className="h-52 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <MapPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng) }} />
                </div>
                {lat && lng && (
                  <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                    <span>📍</span> 位置設定済み: {lat.toFixed(4)}, {lng.toFixed(4)}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition font-medium">
                  ← 戻る
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50"
                  style={{ background: loading ? '#6b7280' : 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      送信中...
                    </span>
                  ) : '送信する ✓'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
