import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ai } from '@/lib/ai'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const inquiry = await prisma.inquiry.findUnique({ where: { id } })
    if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Agentic Search
    const { sources } = await ai.agenticSearch(inquiry.normalizedText)

    // Similar Inquiries
    const similar = await ai.findSimilarInquiries(inquiry.normalizedText)

    // Follow-up QA
    const followupQA: Array<{ question: string; answer: string }> = JSON.parse(inquiry.followupQAJson || '[]')

    // Answer Package
    const pkg = await ai.generateAnswerPackage(inquiry.normalizedText, followupQA, sources, similar)

    // Save as Draft Answer
    const existing = await prisma.answer.findFirst({ where: { inquiryId: id }, orderBy: { createdAt: 'desc' } })

    let answer
    if (existing && !existing.approvedAt) {
      answer = await prisma.answer.update({
        where: { id: existing.id },
        data: {
          draftPolicyJson: JSON.stringify(pkg.policy),
          draftAnswerText: pkg.answerText,
          draftSupplementalText: pkg.supplementalText,
          sourcesJson: JSON.stringify(sources),
        },
      })
    } else {
      answer = await prisma.answer.create({
        data: {
          inquiryId: id,
          draftPolicyJson: JSON.stringify(pkg.policy),
          draftAnswerText: pkg.answerText,
          draftSupplementalText: pkg.supplementalText,
          sourcesJson: JSON.stringify(sources),
        },
      })
    }

    // Mark inquiry as IN_PROGRESS
    await prisma.inquiry.update({ where: { id }, data: { status: 'IN_PROGRESS', isRead: true } })

    await writeAuditLog({
      actorUserId: session.id,
      action: 'GENERATE_AI',
      targetType: 'Answer',
      targetId: answer.id,
      meta: { inquiryId: id, sourcesCount: sources.length },
    })

    return NextResponse.json({ answer, sources, similar, pkg })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
