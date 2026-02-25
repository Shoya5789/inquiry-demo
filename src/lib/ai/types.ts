export type UrgencyLevel = 'HIGH' | 'MED' | 'LOW'
export type ImportanceLevel = 'HIGH' | 'MED' | 'LOW'

export interface Recommendation {
  title: string
  body: string
  url?: string
}

export interface FollowupQuestion {
  id: string
  text: string
  type: 'single' | 'multi' | 'text'
  options?: string[]
}

export interface SimilarInquiry {
  inquiryId: string
  score: number
  summary: string
  finalAnswerText?: string
}

export interface SearchSource {
  sourceId: string
  type: string
  title: string
  uri: string
  snippet: string
  score: number
}

export interface AnswerPolicy {
  conclusion: string
  reasoning: string
  missingInfo: string[]
  cautions: string[]
  nextActions: string[]
}

export interface AnswerPackage {
  policy: AnswerPolicy
  answerText: string
  supplementalText: string
  citations: Array<{ claim: string; sourceId: string }>
}

export interface SummarizeResult {
  summary: string
  urgency: UrgencyLevel
  importance: ImportanceLevel
  deptSuggested: string
  tagSuggestions: string[]
}
