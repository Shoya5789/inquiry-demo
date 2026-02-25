import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  answerId: z.string(),
  sentChannel: z.enum(['email', 'phone', 'none']).default('email'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await req.json()
    const { answerId, sentChannel } = schema.parse(body)

    const existingAnswer = await prisma.answer.findUnique({ where: { id: answerId } })
    if (!existingAnswer?.approvedAt) {
      return NextResponse.json({ error: 'Answer not approved yet' }, { status: 400 })
    }

    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: { sentChannel, sentAt: new Date() },
    })

    await prisma.inquiry.update({ where: { id }, data: { status: 'ANSWERED' } })

    // 擬似送信ログ（実際のメール送信はオプション）
    await writeAuditLog({
      actorUserId: session.id,
      action: 'SEND_ANSWER',
      targetType: 'Answer',
      targetId: answerId,
      meta: { inquiryId: id, channel: sentChannel, simulatedSend: true },
    })

    const channelName = sentChannel === 'email' ? 'メール' : sentChannel === 'phone' ? '電話' : 'ログ'
    return NextResponse.json({ answer, message: `回答を${channelName}で送信しました（擬似送信）` })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
