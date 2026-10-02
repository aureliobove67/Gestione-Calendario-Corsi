import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('unit');

// GET /api/admin/units
router.get('/', (req: Request, res: Response) => {
  try {
    const { course_id } = req.query;
    let units;
    if (course_id) {
      units = db.prepare('SELECT * FROM units WHERE course_id = ? ORDER BY name').all(course_id as any);
    } else {
      units = db.prepare('SELECT * FROM units ORDER BY name').all();
    }
    res.json(units);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/units
router.post('/', (req: Request, res: Response) => {
  try {
    const { course_id, name, contracted_hours } = req.body;

    if (!course_id || !name) {
      res.status(400).json({ error: 'course_id and name are required' });
      return;
    }

    const result = db.prepare(
      'INSERT INTO units (course_id, name, contracted_hours, created_by) VALUES (?, ?, ?, ?)'
    ).run(course_id, name, contracted_hours || 0, req.user!.id);

    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(result.lastInsertRowid);
    audit.create(req, Number(result.lastInsertRowid), unit);

    res.status(201).json(unit);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/units/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM units WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }

    const { course_id, name, contracted_hours } = req.body;

    db.prepare(
      'UPDATE units SET course_id = ?, name = ?, contracted_hours = ? WHERE id = ?'
    ).run(
      course_id || old.course_id,
      name || old.name,
      contracted_hours !== undefined ? contracted_hours : old.contracted_hours,
      id
    );

    const updated = db.prepare('SELECT * FROM units WHERE id = ?').get(id);
    audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/units/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM units WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }

    db.prepare('DELETE FROM units WHERE id = ?').run(id);
    audit.delete(req, id, old);

    res.json({ message: 'Unit deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
