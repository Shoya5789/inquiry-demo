import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

function hashContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function POST(req: NextRequest) {
  const session = getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 差分更新: contentHashが変わったものだけ更新
  const sources = await prisma.knowledgeSource.findMany()
  const updated: string[] = []
  const unchanged: string[] = []

  for (const source of sources) {
    const currentHash = hashContent(source.content)
    if (currentHash !== source.contentHash) {
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { contentHash: currentHash, lastSyncedAt: new Date() },
      })
      updated.push(source.id)
    } else {
      unchanged.push(source.id)
    }
  }

  await writeAuditLog({
    actorUserId: session.id,
    action: 'SYNC_KB',
    targetType: 'KnowledgeSource',
    targetId: sources[0]?.id ?? 'none',
    meta: { updated: updated.length, unchanged: unchanged.length },
  })

  return NextResponse.json({
    updated: updated.length,
    unchanged: unchanged.length,
    total: sources.length,
    message: `${updated.length}件を更新、${unchanged.length}件は変更なし`,
  })
}
