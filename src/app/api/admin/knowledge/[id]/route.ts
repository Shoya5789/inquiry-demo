import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  uri: z.string().optional(),
})

function hashContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const updateData: Record<string, unknown> = { ...data }
    if (data.content) {
      updateData.contentHash = hashContent(data.content)
    }

    const source = await prisma.knowledgeSource.update({ where: { id }, data: updateData })

    await writeAuditLog({
      actorUserId: session.id,
      action: 'UPDATE_KB',
      targetType: 'KnowledgeSource',
      targetId: id,
      meta: {},
    })

    return NextResponse.json({ source })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.knowledgeSource.delete({ where: { id } })

  await writeAuditLog({
    actorUserId: session.id,
    action: 'DELETE_KB',
    targetType: 'KnowledgeSource',
    targetId: id,
    meta: {},
  })

  return NextResponse.json({ ok: true })
}
