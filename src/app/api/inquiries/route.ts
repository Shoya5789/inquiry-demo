import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ai } from '@/lib/ai'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  rawText: z.string().min(1).max(2000),
  channel: z.enum(['web', 'email', 'phone']).default('web'),
  followupQAJson: z.string().default('[]'),
  needsReply: z.boolean().default(false),
  contactName: z.string().default(''),
  contactEmail: z.string().default(''),
  contactPhone: z.string().default(''),
  addressText: z.string().default(''),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  locale: z.enum(['ja', 'en']).default('ja'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = schema.parse(body)

    // AI分析（サマリー/緊急度/担当部署/タグ）
    const aiResult = await ai.summarizeAndRoute(data.rawText)

    const inquiry = await prisma.inquiry.create({
      data: {
        channel: data.channel,
        rawText: data.rawText,
        normalizedText: data.rawText.trim().replace(/\s+/g, ' '),
        aiSummary: aiResult.summary,
        urgency: aiResult.urgency,
        importance: aiResult.importance,
        deptSuggested: aiResult.deptSuggested,
        deptActual: aiResult.deptSuggested,
        tags: JSON.stringify(aiResult.tagSuggestions),
        followupQAJson: data.followupQAJson,
        needsReply: data.needsReply,
        contactName: data.needsReply ? data.contactName : '',
        contactEmail: data.needsReply ? data.contactEmail : '',
        contactPhone: data.needsReply ? data.contactPhone : '',
        addressText: data.addressText,
        lat: data.lat,
        lng: data.lng,
        locale: data.locale,
      },
    })

    await writeAuditLog({
      action: 'SUBMIT_INQUIRY',
      targetType: 'Inquiry',
      targetId: inquiry.id,
      meta: { channel: data.channel },
    })

    return NextResponse.json({ id: inquiry.id, aiSummary: aiResult.summary })
  } catch (e) {
    console.error(e)
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
