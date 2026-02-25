import { prisma } from '../prisma'
import type {
  SummarizeResult,
  Recommendation,
  FollowupQuestion,
  SimilarInquiry,
  SearchSource,
  AnswerPackage,
  AnswerPolicy,
} from './types'

// キーワードルール
const URGENCY_HIGH = ['緊急', '危険', '事故', '破裂', '爆発', '火事', '倒れ', '死', '血', '骨折', '至急']
const URGENCY_LOW = ['教えて', '知りたい', '確認', '案内', '申込方法']

const IMPORTANCE_HIGH = ['道路', '水道', '信号', 'ライフライン', '緊急', '危険']

const DEPT_RULES: [string[], string][] = [
  [['ゴミ', '粗大', '分別', '可燃', '不燃', '資源', 'リサイクル'], '環境課'],
  [['道路', '陥没', '信号', '舗装', 'アスファルト', '歩道'], '道路管理課'],
  [['年金', '国民年金', '厚生年金', '老齢', '受給'], '市民課'],
  [['公園', '遊具', '花壇', '緑地', '草'], '公園管理課'],
  [['水道', '下水', '排水', '水漏れ', '断水'], '上下水道課'],
  [['イベント', '講座', '市民活動', '参加', '申込'], '市民活動推進課'],
  [['騒音', '振動', '悪臭', '環境被害'], '生活安全課'],
  [['子育て', '保育', '幼稚園', '育児', '児童'], '子育て支援課'],
  [['高齢', '介護', '福祉', 'ケア', 'ヘルパー'], '福祉課'],
  [['税金', '市税', '固定資産', '軽自動車税'], '税務課'],
]

const TAG_KEYWORDS: string[] = [
  'ゴミ', '粗大ごみ', '道路', '年金', '公園', '水道', 'イベント', '騒音',
  '子育て', '介護', '税金', '喫煙', '信号', '陥没', '申込', '手続き',
  '住所変更', '収集日', '費用', '緊急',
]

function detectUrgency(text: string): 'HIGH' | 'MED' | 'LOW' {
  if (URGENCY_HIGH.some((k) => text.includes(k))) return 'HIGH'
  if (URGENCY_LOW.some((k) => text.includes(k))) return 'LOW'
  return 'MED'
}

function detectImportance(text: string): 'HIGH' | 'MED' | 'LOW' {
  if (IMPORTANCE_HIGH.some((k) => text.includes(k))) return 'HIGH'
  if (text.length > 100) return 'MED'
  return 'LOW'
}

function detectDept(text: string): string {
  for (const [keywords, dept] of DEPT_RULES) {
    if (keywords.some((k) => text.includes(k))) return dept
  }
  return '総務課'
}

function detectTags(text: string): string[] {
  return TAG_KEYWORDS.filter((k) => text.includes(k)).slice(0, 5)
}

export async function mockSummarizeAndRoute(text: string): Promise<SummarizeResult> {
  const urgency = detectUrgency(text)
  const importance = detectImportance(text)
  const deptSuggested = detectDept(text)
  const tagSuggestions = detectTags(text)

  // サマリー：先頭60文字 + 部署提案
  const summary = text.length > 60 ? text.slice(0, 60) + '…に関するお問い合わせです。' : text + 'に関するお問い合わせです。'

  return { summary, urgency, importance, deptSuggested, tagSuggestions }
}

export async function mockRecommendSelfHelp(text: string): Promise<{ recommendations: Recommendation[]; disclaimer: string }> {
  const sources = await prisma.knowledgeSource.findMany()

  const scored = sources.map((s) => {
    const words = text.split(/[\s、。！？\n]+/).filter((w) => w.length > 1)
    const score = words.filter((w) => s.content.includes(w) || s.name.includes(w)).length
    return { ...s, score }
  })

  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const recommendations: Recommendation[] = top.map((s) => ({
    title: s.name,
    body: s.content.slice(0, 150) + (s.content.length > 150 ? '…' : ''),
    url: s.uri || undefined,
  }))

  // KSが0件でもデモ用にフォールバック
  if (recommendations.length === 0) {
    recommendations.push({
      title: '市のホームページをご確認ください',
      body: '各種手続きや問い合わせ情報は市の公式ホームページに掲載されています。',
      url: 'https://www.city.example.jp',
    })
  }

  return {
    recommendations,
    disclaimer: 'この情報はAIが自動生成したものです。内容に不正確な部分が含まれる可能性があります。最新情報は各担当窓口にご確認ください。',
  }
}

export async function mockGenerateFollowupQuestions(text: string): Promise<{ questions: FollowupQuestion[] }> {
  const questions: FollowupQuestion[] = []

  // 場所情報がなければ質問
  if (!/(丁目|番地|交差点|公園|駅|付近|の前|場所|住所|地図)/.test(text)) {
    questions.push({
      id: 'location',
      text: '問い合わせの場所や住所があれば教えてください（任意）',
      type: 'text',
    })
  }

  // 日時情報がなければ質問
  if (!/(今日|昨日|先週|\d+日|午前|午後|時頃|いつ|日時)/.test(text)) {
    questions.push({
      id: 'datetime',
      text: '発生した日時や時間帯を教えてください（任意）',
      type: 'text',
    })
  }

  // 緊急度確認
  if (/(困|危|急|早急)/.test(text) && questions.length < 3) {
    questions.push({
      id: 'urgency',
      text: '緊急の対応が必要ですか？',
      type: 'single',
      options: ['今すぐ対応が必要', '数日以内でよい', '急ぎではない'],
    })
  }

  return { questions: questions.slice(0, 3) }
}

export async function mockFindSimilarInquiries(text: string): Promise<SimilarInquiry[]> {
  const inquiries = await prisma.inquiry.findMany({
    include: { answers: { where: { finalAnswerText: { not: '' } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const words = text.split(/[\s、。！？\n]+/).filter((w) => w.length > 1)

  const scored = inquiries.map((inq) => {
    const target = inq.normalizedText + ' ' + inq.aiSummary
    const matchCount = words.filter((w) => target.includes(w)).length
    const score = words.length > 0 ? matchCount / words.length : 0
    return {
      inquiryId: inq.id,
      score: Math.round(score * 100) / 100,
      summary: inq.aiSummary || inq.rawText.slice(0, 80),
      finalAnswerText: inq.answers[0]?.finalAnswerText || undefined,
    }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export async function mockAgenticSearch(text: string): Promise<{ sources: SearchSource[] }> {
  const sources = await prisma.knowledgeSource.findMany()

  const words = text.split(/[\s、。！？\n]+/).filter((w) => w.length > 1)

  const scored = sources.map((s) => {
    const target = s.name + ' ' + s.content
    const matchCount = words.filter((w) => target.includes(w)).length
    const score = words.length > 0 ? matchCount / words.length : 0
    return {
      sourceId: s.id,
      type: s.type,
      title: s.name,
      uri: s.uri,
      snippet: s.content.slice(0, 200),
      score: Math.round(score * 100) / 100,
    }
  })

  return {
    sources: scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  }
}

export async function mockGenerateAnswerPackage(
  inquiryText: string,
  followupQA: Array<{ question: string; answer: string }>,
  sources: SearchSource[],
  similarCases: SimilarInquiry[]
): Promise<AnswerPackage> {
  const dept = detectDept(inquiryText)
  const urgency = detectUrgency(inquiryText)

  const policy: AnswerPolicy = {
    conclusion: `${dept}として対応し、関連情報を提供します。`,
    reasoning:
      sources.length > 0
        ? `${sources.map((s) => s.title).join('、')}の情報を参照しました。`
        : '類似事例と一般的な行政手続きの知識に基づいています。',
    missingInfo:
      followupQA.filter((qa) => !qa.answer).map((qa) => qa.question),
    cautions:
      urgency === 'HIGH'
        ? ['緊急案件として優先対応が必要です。', '現地確認が必要な場合があります。']
        : ['内容によっては現地確認や追加書類が必要な場合があります。'],
    nextActions: ['担当部署（' + dept + '）へ連絡', '必要に応じて現地確認'],
  }

  // 回答文本体
  let answerText = `お問い合わせありがとうございます。\n\n`
  answerText += `【ご質問の内容】\n${inquiryText.slice(0, 100)}${inquiryText.length > 100 ? '…' : ''}\n\n`

  if (sources.length > 0) {
    answerText += `【ご案内】\n`
    for (const src of sources.slice(0, 3)) {
      answerText += `■ ${src.title}\n${src.snippet.slice(0, 200)}\n\n`
    }
  } else {
    answerText += `担当窓口（${dept}）より詳しいご案内をいたします。\n\n`
  }

  if (similarCases.length > 0 && similarCases[0].finalAnswerText) {
    answerText += `【参考：過去の類似回答】\n${similarCases[0].finalAnswerText.slice(0, 200)}\n\n`
  }

  answerText += `ご不明な点がございましたら、お気軽にお問い合わせください。`

  const supplementalText =
    sources.length > 0
      ? `【参照情報】\n` + sources.map((s) => `・${s.title}${s.uri ? `（${s.uri}）` : ''}`).join('\n')
      : ''

  const citations = sources.map((s) => ({
    claim: s.title + 'に基づく情報',
    sourceId: s.sourceId,
  }))

  return { policy, answerText, supplementalText, citations }
}
