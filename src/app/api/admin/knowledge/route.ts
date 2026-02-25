import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const createSchema = z.object({
  type: z.enum(['text', 'file', 'url']),
  name: z.string().min(1),
  uri: z.string().default(''),
  content: z.string().min(1),
})

function hashContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function GET(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sources = await prisma.knowledgeSource.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ sources })
}

export async function POST(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const source = await prisma.knowledgeSource.create({
      data: { ...data, contentHash: hashContent(data.content) },
    })

    await writeAuditLog({
      actorUserId: session.id,
      action: 'CREATE_KB',
      targetType: 'KnowledgeSource',
      targetId: source.id,
      meta: { name: data.name },
    })

    return NextResponse.json({ source })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
