import { prisma } from './prisma';

export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  meta?: Record<string, any>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        meta: (params.meta ?? {}) as any,
      },
    });
  } catch (e) {
    console.error('[audit] failed to write', e);
  }
}
