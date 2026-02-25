/**
 * AI functions dispatcher
 * ANTHROPIC_API_KEY が設定されていればLLMモード、なければMockモード
 */

import {
  mockSummarizeAndRoute,
  mockRecommendSelfHelp,
  mockGenerateFollowupQuestions,
  mockFindSimilarInquiries,
  mockAgenticSearch,
  mockGenerateAnswerPackage,
} from './mock'

import {
  llmSummarizeAndRoute,
  llmRecommendSelfHelp,
  llmGenerateFollowupQuestions,
  llmFindSimilarInquiries,
  llmAgenticSearch,
  llmGenerateAnswerPackage,
} from './llm'

export type { SummarizeResult, Recommendation, FollowupQuestion, SimilarInquiry, SearchSource, AnswerPackage, AnswerPolicy } from './types'

function isLLMMode(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export const ai = {
  summarizeAndRoute: (text: string) =>
    isLLMMode() ? llmSummarizeAndRoute(text) : mockSummarizeAndRoute(text),

  recommendSelfHelp: (text: string) =>
    isLLMMode() ? llmRecommendSelfHelp(text) : mockRecommendSelfHelp(text),

  generateFollowupQuestions: (text: string) =>
    isLLMMode() ? llmGenerateFollowupQuestions(text) : mockGenerateFollowupQuestions(text),

  findSimilarInquiries: (text: string) =>
    isLLMMode() ? llmFindSimilarInquiries(text) : mockFindSimilarInquiries(text),

  agenticSearch: (text: string) =>
    isLLMMode() ? llmAgenticSearch(text) : mockAgenticSearch(text),

  generateAnswerPackage: (
    inquiryText: string,
    followupQA: Array<{ question: string; answer: string }>,
    sources: import('./types').SearchSource[],
    similarCases: import('./types').SimilarInquiry[]
  ) =>
    isLLMMode()
      ? llmGenerateAnswerPackage(inquiryText, followupQA, sources, similarCases)
      : mockGenerateAnswerPackage(inquiryText, followupQA, sources, similarCases),

  isLLMMode,
}
