import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: { answers: { include: { approvedBy: { select: { username: true, dept: true } } }, orderBy: { createdAt: 'desc' } } },
  })
  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 既読にする
  if (!inquiry.isRead) {
    await prisma.inquiry.update({ where: { id }, data: { isRead: true } })
  }

  await writeAuditLog({
    actorUserId: session.id,
    action: 'VIEW_INQUIRY',
    targetType: 'Inquiry',
    targetId: id,
    meta: {},
  })

  return NextResponse.json({ inquiry })
}

const updateSchema = z.object({
  tags: z.string().optional(),
  deptActual: z.string().optional(),
  status: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const inquiry = await prisma.inquiry.update({ where: { id }, data })

    if (data.tags !== undefined) {
      await writeAuditLog({
        actorUserId: session.id,
        action: 'EDIT_TAGS',
        targetType: 'Inquiry',
        targetId: id,
        meta: { tags: data.tags },
      })
    }

    return NextResponse.json({ inquiry })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
