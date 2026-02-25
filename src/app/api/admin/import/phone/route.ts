import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ai } from '@/lib/ai'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  text: z.string().min(1).max(2000),
  callerName: z.string().default(''),
  callerPhone: z.string().default(''),
})

export async function POST(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = schema.parse(body)

    const aiResult = await ai.summarizeAndRoute(data.text)

    const inquiry = await prisma.inquiry.create({
      data: {
        channel: 'phone',
        rawText: data.text,
        normalizedText: data.text.trim(),
        aiSummary: aiResult.summary,
        urgency: aiResult.urgency,
        importance: aiResult.importance,
        deptSuggested: aiResult.deptSuggested,
        deptActual: aiResult.deptSuggested,
        tags: JSON.stringify(aiResult.tagSuggestions),
        contactName: data.callerName,
        contactPhone: data.callerPhone,
        needsReply: !!data.callerPhone,
      },
    })

    await writeAuditLog({
      actorUserId: session.id,
      action: 'IMPORT_PHONE',
      targetType: 'Inquiry',
      targetId: inquiry.id,
      meta: {},
    })

    return NextResponse.json({ id: inquiry.id, aiSummary: aiResult.summary })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
