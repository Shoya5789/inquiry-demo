import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === '1'
  const unansweredOnly = searchParams.get('unanswered') === '1'
  const myDeptOnly = searchParams.get('mydept') === '1'
  const sortBy = searchParams.get('sort') || 'createdAt'
  const urgency = searchParams.get('urgency') || ''

  const where: Record<string, unknown> = {}
  if (unreadOnly) where.isRead = false
  if (unansweredOnly) where.status = { not: 'ANSWERED' }
  if (myDeptOnly) where.deptActual = session.dept
  if (urgency) where.urgency = urgency

  const orderBy: Record<string, string> =
    sortBy === 'urgency'
      ? { urgency: 'asc' }
      : sortBy === 'importance'
      ? { importance: 'asc' }
      : { createdAt: 'desc' }

  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy,
    include: { answers: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  return NextResponse.json({ inquiries })
}
