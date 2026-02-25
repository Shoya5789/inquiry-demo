import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  answerId: z.string(),
  finalAnswerText: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await req.json()
    const { answerId, finalAnswerText } = schema.parse(body)

    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: {
        finalAnswerText,
        approvedByUserId: session.id,
        approvedAt: new Date(),
      },
    })

    await prisma.inquiry.update({ where: { id }, data: { status: 'IN_PROGRESS' } })

    await writeAuditLog({
      actorUserId: session.id,
      action: 'APPROVE_ANSWER',
      targetType: 'Answer',
      targetId: answerId,
      meta: { inquiryId: id },
    })

    return NextResponse.json({ answer })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
