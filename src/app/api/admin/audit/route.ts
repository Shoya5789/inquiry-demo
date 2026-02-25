import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '100')

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { username: true, dept: true } } },
  })

  return NextResponse.json({ logs })
}
