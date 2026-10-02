import db from '../db/connection';
import { Request, Response, NextFunction } from 'express';

export function auditLog(
  userId: number | null,
  entityType: string,
  entityId: number | null,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  oldValues: any = null,
  newValues: any = null
): void {
  db.prepare(
    `INSERT INTO audit_log (user_id, entity_type, entity_id, action, old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    entityType,
    entityId,
    action,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null
  );
}

// Helper to create an audited route handler wrapper
export function withAudit(entityType: string) {
  return {
    create: (req: Request, entityId: number, newValues: any) => {
      auditLog(req.user?.id || null, entityType, entityId, 'CREATE', null, newValues);
    },
    update: (req: Request, entityId: number, oldValues: any, newValues: any) => {
      auditLog(req.user?.id || null, entityType, entityId, 'UPDATE', oldValues, newValues);
    },
    delete: (req: Request, entityId: number, oldValues: any) => {
      auditLog(req.user?.id || null, entityType, entityId, 'DELETE', oldValues, null);
    }
  };
}
