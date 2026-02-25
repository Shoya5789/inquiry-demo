import Anthropic from '@anthropic-ai/sdk'
import { maskPII } from './pii'
import type {
  SummarizeResult,
  Recommendation,
  FollowupQuestion,
  SimilarInquiry,
  SearchSource,
  AnswerPackage,
} from './types'
import {
  mockSummarizeAndRoute,
  mockRecommendSelfHelp,
  mockGenerateFollowupQuestions,
  mockFindSimilarInquiries,
  mockAgenticSearch,
  mockGenerateAnswerPackage,
} from './mock'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

async function callClaude(prompt: string): Promise<string> {
  const client = getClient()
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = res.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function llmSummarizeAndRoute(text: string): Promise<SummarizeResult> {
  const masked = maskPII(text)
  const prompt = `以下の行政問い合わせを分析してください。JSONのみ返してください（コードブロック不要）。

問い合わせ: ${masked}

出力形式:
{
  "summary": "80文字以内のサマリー",
  "urgency": "HIGH|MED|LOW",
  "importance": "HIGH|MED|LOW",
  "deptSuggested": "担当部署名",
  "tagSuggestions": ["タグ1", "タグ2"]
}`

  try {
    const raw = await callClaude(prompt)
    return JSON.parse(raw) as SummarizeResult
  } catch {
    return mockSummarizeAndRoute(text)
  }
}

export async function llmRecommendSelfHelp(text: string): Promise<{ recommendations: Recommendation[]; disclaimer: string }> {
  // KnowledgeSourceを取得してコンテキストとして渡す
  const { mockRecommendSelfHelp: mock } = await import('./mock')
  // まずmockで候補を取得
  const mockResult = await mockRecommendSelfHelp(text)
  if (!mockResult.recommendations.length) return mockResult

  const masked = maskPII(text)
  const context = mockResult.recommendations.map((r) => `【${r.title}】\n${r.body}`).join('\n\n')

  const prompt = `行政窓口の問い合わせに対し、自己解決できる情報を3件以内で提案してください。JSONのみ返してください。

問い合わせ: ${masked}

参考情報:
${context}

出力形式:
{
  "recommendations": [
    {"title": "タイトル", "body": "案内文（200文字以内）", "url": "URLまたは空文字"}
  ],
  "disclaimer": "注意書き"
}`

  try {
    const raw = await callClaude(prompt)
    return JSON.parse(raw)
  } catch {
    return mockResult
  }
}

export async function llmGenerateFollowupQuestions(text: string): Promise<{ questions: FollowupQuestion[] }> {
  const masked = maskPII(text)
  const prompt = `行政への問い合わせに対し、回答に必要な追加情報を聞く質問を0〜3件生成してください。不要なら空配列。JSONのみ返してください。

問い合わせ: ${masked}

出力形式:
{
  "questions": [
    {"id": "q1", "text": "質問文", "type": "text|single|multi", "options": ["選択肢1"] }
  ]
}`

  try {
    const raw = await callClaude(prompt)
    const parsed = JSON.parse(raw) as { questions: FollowupQuestion[] }
    return { questions: parsed.questions.slice(0, 3) }
  } catch {
    return mockGenerateFollowupQuestions(text)
  }
}

export async function llmFindSimilarInquiries(text: string): Promise<SimilarInquiry[]> {
  // 類似検索はMockのキーワードマッチングで十分
  return mockFindSimilarInquiries(text)
}

export async function llmAgenticSearch(text: string): Promise<{ sources: SearchSource[] }> {
  return mockAgenticSearch(text)
}

export async function llmGenerateAnswerPackage(
  inquiryText: string,
  followupQA: Array<{ question: string; answer: string }>,
  sources: SearchSource[],
  similarCases: SimilarInquiry[]
): Promise<AnswerPackage> {
  const masked = maskPII(inquiryText)
  const sourceContext = sources.map((s) => `[${s.sourceId}] ${s.title}: ${s.snippet.slice(0, 300)}`).join('\n')
  const similarContext = similarCases
    .filter((c) => c.finalAnswerText)
    .slice(0, 2)
    .map((c) => `類似事例(スコア${c.score}): ${c.summary}\n過去回答: ${c.finalAnswerText}`)
    .join('\n')

  const qaContext = followupQA.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n')

  const prompt = `あなたは行政職員のAIアシスタントです。以下の問い合わせに対する回答案を作成してください。JSONのみ返してください。

【問い合わせ】
${masked}

【追加情報】
${qaContext || '（なし）'}

【参照ソース】
${sourceContext || '（なし）'}

【類似過去事例】
${similarContext || '（なし）'}

出力形式:
{
  "policy": {
    "conclusion": "回答方針",
    "reasoning": "根拠",
    "missingInfo": ["不足情報"],
    "cautions": ["注意点"],
    "nextActions": ["次のアクション"]
  },
  "answerText": "住民への回答文（です・ます調）",
  "supplementalText": "補足情報",
  "citations": [{"claim": "根拠となる主張", "sourceId": "ソースID"}]
}`

  try {
    const raw = await callClaude(prompt)
    return JSON.parse(raw) as AnswerPackage
  } catch {
    return mockGenerateAnswerPackage(inquiryText, followupQA, sources, similarCases)
  }
}
