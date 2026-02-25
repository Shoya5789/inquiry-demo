import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ai } from '@/lib/ai'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const schema = z.object({
  rawContent: z.string().min(1), // .eml content or plain text
})

// 簡易メール本文抽出（mailparser不要版）
function extractBody(raw: string): string {
  // EMLヘッダーをスキップして本文を取得
  const lines = raw.split('\n')
  let bodyStart = false
  const bodyLines: string[] = []

  for (const line of lines) {
    if (bodyStart) {
      bodyLines.push(line)
    } else if (line.trim() === '') {
      bodyStart = true
    }
  }

  const body = bodyLines.join('\n').trim()
  return body || raw.trim()
}

function extractSubject(raw: string): string {
  const match = raw.match(/^Subject:\s*(.+)$/im)
  return match ? match[1].trim() : ''
}

function extractFromName(raw: string): string {
  const match = raw.match(/^From:\s*(.+)$/im)
  if (!match) return ''
  // "Name <email>" または "email" を解析
  const fromLine = match[1]
  const nameMatch = fromLine.match(/^(.+?)\s*</)
  return nameMatch ? nameMatch[1].trim() : ''
}

export async function POST(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { rawContent } = schema.parse(body)

    const bodyText = extractBody(rawContent)
    const subject = extractSubject(rawContent)
    const fromName = extractFromName(rawContent)
    const fullText = subject ? `件名: ${subject}\n\n${bodyText}` : bodyText

    const aiResult = await ai.summarizeAndRoute(fullText)

    const inquiry = await prisma.inquiry.create({
      data: {
        channel: 'email',
        rawText: fullText,
        normalizedText: fullText.trim(),
        aiSummary: aiResult.summary,
        urgency: aiResult.urgency,
        importance: aiResult.importance,
        deptSuggested: aiResult.deptSuggested,
        deptActual: aiResult.deptSuggested,
        tags: JSON.stringify(aiResult.tagSuggestions),
        contactName: fromName,
      },
    })

    await writeAuditLog({
      actorUserId: session.id,
      action: 'IMPORT_EMAIL',
      targetType: 'Inquiry',
      targetId: inquiry.id,
      meta: { subject },
    })

    return NextResponse.json({ id: inquiry.id, aiSummary: aiResult.summary })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
