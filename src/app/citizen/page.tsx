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

type Locale = 'ja' | 'en'

const T: Record<string, Record<Locale, string>> = {
  title: { ja: '市への問い合わせ', en: 'Contact the City' },
  step0Title: { ja: 'お問い合わせ内容の入力', en: 'Enter Your Inquiry' },
  step1Title: { ja: '参考情報・追加質問', en: 'Reference & Follow-up' },
  step2Title: { ja: '確認・連絡先', en: 'Confirm & Contact' },
  placeholder: { ja: 'お問い合わせ内容を入力してください（例：ゴミの収集日を教えてください）', en: 'Enter your inquiry (e.g., When is garbage collection day?)' },
  next: { ja: '次へ', en: 'Next' },
  back: { ja: '戻る', en: 'Back' },
  submit: { ja: '送信する', en: 'Submit' },
  skip: { ja: 'スキップして送信', en: 'Skip & Submit' },
  needsReply: { ja: '返答を希望する', en: 'I want a reply' },
  contactName: { ja: 'お名前', en: 'Name' },
  contactEmail: { ja: 'メールアドレス', en: 'Email' },
  contactPhone: { ja: '電話番号', en: 'Phone' },
  address: { ja: '住所（任意）', en: 'Address (optional)' },
  disclaimer: { ja: 'この情報はAIが自動生成したものです。内容に不正確な部分が含まれる可能性があります。', en: 'This info is AI-generated and may contain inaccuracies.' },
  easyLang: { ja: 'やさしい日本語', en: 'Simple Japanese' },
  aiSummaryLabel: { ja: 'AI要約', en: 'AI Summary' },
  loading: { ja: '処理中...', en: 'Processing...' },
  voiceStart: { ja: '音声入力', en: 'Voice Input' },
  voiceStop: { ja: '停止', en: 'Stop' },
  recInfo: { ja: '参考になりうる情報', en: 'Helpful Information' },
  followupTitle: { ja: '追加質問（任意・スキップ可）', en: 'Follow-up Questions (optional)' },
}

function t(key: string, locale: Locale): string {
  return T[key]?.[locale] ?? key
}

export default function CitizenPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('ja')
  const [easy, setEasy] = useState(false)
  const [step, setStep] = useState(0)
  const [rawText, setRawText] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [disclaimer, setDisclaimer] = useState('')
  const [followupQuestions, setFollowupQuestions] = useState<FollowupQuestion[]>([])
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({})
  const [aiSummary, setAiSummary] = useState('')
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

  // 音声入力
  const startVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('このブラウザは音声入力に対応していません。テキストで入力してください。')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = locale === 'ja' ? 'ja-JP' : 'en-US'
    recognition.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setRawText((prev) => prev + transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
    setIsListening(true)
  }, [locale])

  // Step 0 → Step 1: AI分析
  const handleStep0Next = async () => {
    if (!rawText.trim()) { setError('問い合わせ内容を入力してください。'); return }
    setError('')
    setLoading(true)
    try {
      const [recRes, fqRes] = await Promise.all([
        fetch('/api/ai/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: rawText }) }),
        fetch('/api/ai/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: rawText }) }),
      ])
      if (recRes.ok) {
        const recData = await recRes.json()
        setRecommendations(recData.recommendations || [])
        setDisclaimer(recData.disclaimer || '')
      }
      if (fqRes.ok) {
        const fqData = await fqRes.json()
        setFollowupQuestions(fqData.questions || [])
      }
      setStep(1)
    } catch {
      setError('エラーが発生しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  // Step 1 → Step 2
  const handleStep1Next = () => {
    setStep(2)
  }

  // 最終送信
  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const followupQA = followupQuestions.map((q) => ({
        question: q.text,
        answer: followupAnswers[q.id] || '',
      }))

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          channel: 'web',
          followupQAJson: JSON.stringify(followupQA),
          needsReply,
          contactName,
          contactEmail,
          contactPhone,
          addressText,
          lat,
          lng,
          locale,
        }),
      })
      if (!res.ok) throw new Error('Submit failed')
      const data = await res.json()
      setAiSummary(data.aiSummary || '')
      router.push(`/citizen/done?id=${data.id}`)
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const textClass = easy ? 'text-xl leading-relaxed' : 'text-base'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t('title', locale)}</h1>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setEasy(!easy)}
            className={`px-2 py-1 rounded text-xs font-medium border transition ${easy ? 'bg-yellow-300 text-gray-900 border-yellow-400' : 'border-white text-white'}`}
          >
            {t('easyLang', locale)}
          </button>
          <button
            onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
            className="px-2 py-1 rounded text-xs font-medium border border-white"
          >
            {locale === 'ja' ? 'EN' : 'JA'}
          </button>
        </div>
      </header>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 py-4 bg-white border-b">
        {[0, 1, 2].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {s + 1}
            </div>
            {s < 2 && <div className={`w-8 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <main className={`max-w-2xl mx-auto p-4 ${textClass}`}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}

        {/* Step 0: テキスト入力 */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">{t('step0Title', locale)}</h2>
            <textarea
              className="w-full border rounded-lg p-3 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
              placeholder={t('placeholder', locale)}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={startVoice}
                disabled={isListening}
                className="flex items-center gap-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                🎤 {isListening ? t('voiceStop', locale) : t('voiceStart', locale)}
              </button>
              {isListening && <span className="text-red-500 text-sm animate-pulse">● 録音中</span>}
            </div>
            <button
              onClick={handleStep0Next}
              disabled={loading || !rawText.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
            >
              {loading ? t('loading', locale) : t('next', locale)}
            </button>
          </div>
        )}

        {/* Step 1: レコメンド + 追加質問 */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">{t('step1Title', locale)}</h2>

            {/* レコメンド */}
            {recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  📚 {t('recInfo', locale)}
                </h3>
                {recommendations.map((rec, i) => (
                  <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="font-medium text-blue-800">{rec.title}</p>
                    <p className="text-gray-600 text-sm mt-1">{rec.body}</p>
                    {rec.url && (
                      <a href={rec.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline mt-1 block">
                        詳しく見る →
                      </a>
                    )}
                  </div>
                ))}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                  ⚠️ {disclaimer || t('disclaimer', locale)}
                </div>
              </div>
            )}

            {/* 追加質問 */}
            {followupQuestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700">{t('followupTitle', locale)}</h3>
                {followupQuestions.map((q) => (
                  <div key={q.id} className="bg-white border rounded-lg p-4 space-y-2">
                    <p className="text-gray-800">{q.text}</p>
                    {q.type === 'text' && (
                      <textarea
                        className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        rows={2}
                        placeholder="任意で入力してください"
                        value={followupAnswers[q.id] || ''}
                        onChange={(e) => setFollowupAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      />
                    )}
                    {q.type === 'single' && q.options && (
                      <div className="space-y-1">
                        {q.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={followupAnswers[q.id] === opt}
                              onChange={() => setFollowupAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === 'multi' && q.options && (
                      <div className="space-y-1">
                        {q.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(followupAnswers[q.id] || '').split(',').includes(opt)}
                              onChange={(e) => {
                                const cur = (followupAnswers[q.id] || '').split(',').filter(Boolean)
                                const next = e.target.checked ? [...cur, opt] : cur.filter((v) => v !== opt)
                                setFollowupAnswers((prev) => ({ ...prev, [q.id]: next.join(',') }))
                              }}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition">
                {t('back', locale)}
              </button>
              <button
                onClick={handleStep1Next}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
              >
                {t('next', locale)}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 連絡先・確認 */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">{t('step2Title', locale)}</h2>

            {/* 送信内容確認 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-600 mb-1">送信内容：</p>
              <p className="text-gray-800 text-sm whitespace-pre-wrap">{rawText}</p>
            </div>

            {/* 返答希望 */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={needsReply}
                onChange={(e) => setNeedsReply(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-medium">{t('needsReply', locale)}</span>
            </label>

            {needsReply && (
              <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('contactName', locale)}</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('contactEmail', locale)}</label>
                  <input
                    type="email"
                    className="w-full border rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('contactPhone', locale)}</label>
                  <input
                    type="tel"
                    className="w-full border rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* 住所・地図 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{t('address', locale)}</label>
              <input
                type="text"
                className="w-full border rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="例：〇〇市〇〇町1-2-3"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
              />
              <div className="h-48 rounded-lg overflow-hidden border">
                <MapPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng) }} />
              </div>
              {lat && lng && (
                <p className="text-xs text-gray-500">📍 ピン位置: {lat.toFixed(4)}, {lng.toFixed(4)}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition">
                {t('back', locale)}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50"
              >
                {loading ? t('loading', locale) : t('submit', locale)}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
