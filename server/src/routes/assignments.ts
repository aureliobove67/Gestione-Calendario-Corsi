import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';
import { getAssignmentHoursStatus } from '../utils/hours-validator';

const router = Router();
const audit = withAudit('assignment');

// GET /api/admin/assignments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { unit_id, teacher_id, course_id } = req.query;
    let query = `
      SELECT a.id, a.unit_id, a.teacher_id, a.total_hours as hours, a.notes,
             u.name as unit_name, t.name as teacher_name, c.name as course_name, c.code as course_code
      FROM assignments a
      JOIN units u ON a.unit_id = u.id
      JOIN teachers t ON a.teacher_id = t.id
      JOIN courses c ON u.course_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (unit_id) {
      query += ' AND a.unit_id = ?';
      params.push(unit_id);
    }
    if (teacher_id) {
      query += ' AND a.teacher_id = ?';
      params.push(teacher_id);
    }
    if (course_id) {
      query += ' AND u.course_id = ?';
      params.push(course_id);
    }

    query += ' ORDER BY c.code, u.name, t.name';

    const assignments = await db.all(query, params);
    res.json(assignments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/assignments/:id/hours-status
router.get('/:id/hours-status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const status = await getAssignmentHoursStatus(id);
    res.json(status);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/admin/assignments
router.post('/', async (req: Request, res: Response) => {
  try {
    const { unit_id, teacher_id, total_hours, hours, notes } = req.body;
    const finalHours = total_hours !== undefined ? total_hours : hours;

    if (!unit_id || !teacher_id) {
      res.status(400).json({ error: 'unit_id and teacher_id are required' });
      return;
    }

    const result = await db.run(
      'INSERT INTO assignments (unit_id, teacher_id, total_hours, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [unit_id, teacher_id, finalHours || 0, notes || null, req.user!.id]
    );

    const assignment = await db.get('SELECT id, unit_id, teacher_id, total_hours as hours, notes FROM assignments WHERE id = ?', [result.lastInsertRowid]);
    await audit.create(req, Number(result.lastInsertRowid), assignment);

    res.status(201).json(assignment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/assignments/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = await db.get('SELECT * FROM assignments WHERE id = ?', [id]) as any;
    if (!old) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const { unit_id, teacher_id, total_hours, hours, notes } = req.body;
    const finalHours = total_hours !== undefined ? total_hours : hours;

    await db.run(
      'UPDATE assignments SET unit_id = ?, teacher_id = ?, total_hours = ?, notes = ? WHERE id = ?',
      [
        unit_id || old.unit_id,
        teacher_id || old.teacher_id,
        finalHours !== undefined ? finalHours : old.total_hours,
        notes !== undefined ? notes : old.notes,
        id
      ]
    );

    const updated = await db.get('SELECT id, unit_id, teacher_id, total_hours as hours, notes FROM assignments WHERE id = ?', [id]);
    await audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/assignments/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = await db.get('SELECT * FROM assignments WHERE id = ?', [id]) as any;
    if (!old) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    await db.run('DELETE FROM assignments WHERE id = ?', [id]);
    await audit.delete(req, id, old);

    res.json({ message: 'Assignment deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
