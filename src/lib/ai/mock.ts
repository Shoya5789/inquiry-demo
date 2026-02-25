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

  // ─── ドメイン特化質問 ────────────────────────────────────────────

  // ゴミ・廃棄物
  if (/(ゴミ|ごみ|廃棄|粗大|不燃|可燃|資源ゴミ|回収|収集)/.test(text)) {
    questions.push({
      id: 'garbage_type',
      text: '廃棄したいものの種類を教えてください',
      type: 'single',
      options: ['可燃ごみ', '不燃ごみ', '資源ごみ（びん・缶・ペットボトル）', '粗大ごみ', 'その他'],
    })
    if (questions.length < 3) {
      questions.push({
        id: 'garbage_volume',
        text: 'おおよその量・サイズを教えてください（例：45Lの袋3袋、タンス1台）',
        type: 'text',
      })
    }
  }

  // 道路・インフラ
  else if (/(道路|陥没|穴|舗装|アスファルト|歩道|車道|段差|ひび|路面)/.test(text)) {
    questions.push({
      id: 'road_severity',
      text: '損傷の程度を教えてください',
      type: 'single',
      options: ['人や車が通れない（通行不可）', '通行できるが危険を感じる', '軽微なひびや段差がある'],
    })
    if (questions.length < 3) {
      questions.push({
        id: 'road_location',
        text: '損傷箇所の詳しい場所（交差点名・目印など）を教えてください',
        type: 'text',
      })
    }
  }

  // 騒音・振動・悪臭
  else if (/(騒音|うるさい|振動|悪臭|臭い|においが|音がする|轟音)/.test(text)) {
    questions.push({
      id: 'noise_time',
      text: '騒音・被害が発生する時間帯はいつですか？',
      type: 'multi',
      options: ['早朝（6時前）', '日中（6〜18時）', '夜間（18〜22時）', '深夜（22時〜）', '不定期'],
    })
    if (questions.length < 3) {
      questions.push({
        id: 'noise_source',
        text: '騒音・悪臭の原因として考えられるものを教えてください',
        type: 'single',
        options: ['工事・建設作業', '近隣住民', '商業施設・店舗', '車両・交通', '原因不明'],
      })
    }
  }

  // 公園・遊具
  else if (/(公園|遊具|ブランコ|滑り台|砂場|ベンチ|花壇|草木|雑草)/.test(text)) {
    questions.push({
      id: 'park_issue',
      text: '問題の種類を教えてください',
      type: 'single',
      options: ['遊具の破損・危険', '草木の手入れ（草刈り・剪定）', '清掃・ゴミ', '施設・設備の不具合', 'その他'],
    })
  }

  // 水道・下水
  else if (/(水道|水漏れ|断水|下水|排水|詰まり|異臭|水が出ない|ガス管)/.test(text)) {
    questions.push({
      id: 'water_type',
      text: '水道に関する問題の種類を教えてください',
      type: 'single',
      options: ['水が出ない（断水）', '水漏れ・破裂している', '水の色・におい・味がおかしい', '下水・排水の詰まり', 'その他'],
    })
    if (questions.length < 3) {
      questions.push({
        id: 'water_urgency',
        text: '現在の状況はどの程度緊急ですか？',
        type: 'single',
        options: ['今すぐ対応が必要（水が使えない・漏水中）', '本日中に対応してほしい', '数日内でよい'],
      })
    }
  }

  // 年金・手続き
  else if (/(年金|国民年金|厚生年金|受給|申請|手続|書類|マイナンバー|住所変更|転入|転出)/.test(text)) {
    questions.push({
      id: 'procedure_type',
      text: 'お手続きの種類を教えてください',
      type: 'single',
      options: ['転入・転出・住所変更', '年金・給付金の申請', '各種証明書の発行', 'マイナンバー関連', 'その他'],
    })
    if (questions.length < 3) {
      questions.push({
        id: 'procedure_urgency',
        text: '期限はありますか？',
        type: 'single',
        options: ['今週中に必要', '今月中に必要', '急ぎではない'],
      })
    }
  }

  // 子育て・保育
  else if (/(子育て|保育|幼稚園|保育園|育児|児童|小学校|学童|入園)/.test(text)) {
    questions.push({
      id: 'childcare_type',
      text: 'お子さんの年齢や状況を教えてください',
      type: 'single',
      options: ['0〜2歳（乳幼児）', '3〜5歳（幼稚園・保育園年齢）', '小学生', '中学生以上'],
    })
    if (questions.length < 3) {
      questions.push({
        id: 'childcare_issue',
        text: 'ご相談の内容はどちらですか？',
        type: 'single',
        options: ['保育園・幼稚園への入園', '学童保育', '子育て支援サービスの紹介', 'その他'],
      })
    }
  }

  // ─── 共通質問（ドメイン特化がない場合 or 補足として） ────────────

  // 場所情報がなければ追加
  if (questions.length < 3 && !/(丁目|番地|交差点|公園|駅|付近|の前|場所|住所|地図)/.test(text)) {
    questions.push({
      id: 'location',
      text: '問い合わせに関連する場所・住所があれば教えてください',
      type: 'text',
    })
  }

  // 日時情報がなく、かつ問題発生日時が関係しそうな場合
  if (questions.length < 3 && !/(今日|昨日|先週|\d+日|午前|午後|時頃|いつから)/.test(text)
    && /(いつ|発生|困って|気づい|始まっ)/.test(text)) {
    questions.push({
      id: 'datetime',
      text: '問題に気づいた日時や時間帯を教えてください',
      type: 'text',
    })
  }

  // 緊急度確認（緊急ワードがある場合）
  if (questions.length < 3 && /(困って|危険|今すぐ|至急|緊急|早急)/.test(text)) {
    questions.push({
      id: 'urgency_level',
      text: 'どの程度の緊急対応が必要ですか？',
      type: 'single',
      options: ['今すぐ（生命・安全に関わる）', '本日中', '数日内でよい', '急ぎではない'],
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
