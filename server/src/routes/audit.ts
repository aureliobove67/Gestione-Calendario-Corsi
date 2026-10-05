import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/admin/audit-log
router.get('/', async (req: Request, res: Response) => {
  try {
    const { entity_type, user_id, from, to, entity_id, limit, offset } = req.query;

    let query = `
      SELECT al.*, u.username as user_username
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (entity_type) {
      query += ' AND al.entity_type = ?';
      params.push(entity_type);
    }
    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(user_id);
    }
    if (entity_id) {
      query += ' AND al.entity_id = ?';
      params.push(entity_id);
    }
    if (from) {
      query += ' AND al.timestamp >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND al.timestamp <= ?';
      params.push(to);
    }

    query += ' ORDER BY al.timestamp DESC';

    const queryLimit = parseInt(limit as string) || 100;
    const queryOffset = parseInt(offset as string) || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(queryLimit, queryOffset);

    const logs = await db.all(query, params);

    // Parse JSON fields
    const parsed = logs.map((log: any) => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
