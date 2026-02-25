import { prisma } from './prisma'

export type AuditAction =
  | 'VIEW_INQUIRY'
  | 'EDIT_TAGS'
  | 'GENERATE_AI'
  | 'APPROVE_ANSWER'
  | 'SEND_ANSWER'
  | 'IMPORT_EMAIL'
  | 'IMPORT_PHONE'
  | 'SYNC_KB'
  | 'CREATE_KB'
  | 'UPDATE_KB'
  | 'DELETE_KB'
  | 'SUBMIT_INQUIRY'

export async function writeAuditLog(params: {
  actorUserId?: string | null
  action: AuditAction
  targetType: 'Inquiry' | 'Answer' | 'KnowledgeSource'
  targetId: string
  meta?: Record<string, unknown>
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metaJson: JSON.stringify(params.meta ?? {}),
    },
  })
}
