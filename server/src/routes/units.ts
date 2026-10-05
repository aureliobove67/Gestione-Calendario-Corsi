import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('unit');

// GET /api/admin/units
router.get('/', async (req: Request, res: Response) => {
  try {
    const { course_id } = req.query;
    let units;
    if (course_id) {
      units = await db.all('SELECT * FROM units WHERE course_id = ? ORDER BY name', [course_id as any]);
    } else {
      units = await db.all('SELECT * FROM units ORDER BY name');
    }
    res.json(units);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/units
router.post('/', async (req: Request, res: Response) => {
  try {
    const { course_id, name, contracted_hours } = req.body;

    if (!course_id || !name) {
      res.status(400).json({ error: 'course_id and name are required' });
      return;
    }

    const result = await db.run(
      'INSERT INTO units (course_id, name, contracted_hours, created_by) VALUES (?, ?, ?, ?)',
      [course_id, name, contracted_hours || 0, req.user!.id]
    );

    const unit = await db.get('SELECT * FROM units WHERE id = ?', [result.lastInsertRowid]);
    await audit.create(req, Number(result.lastInsertRowid), unit);

    res.status(201).json(unit);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/units/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = (await db.get('SELECT * FROM units WHERE id = ?', [id])) as any;
    if (!old) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }

    const { course_id, name, contracted_hours } = req.body;

    await db.run(
      'UPDATE units SET course_id = ?, name = ?, contracted_hours = ? WHERE id = ?',
      [
        course_id || old.course_id,
        name || old.name,
        contracted_hours !== undefined ? contracted_hours : old.contracted_hours,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM units WHERE id = ?', [id]);
    await audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/units/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = (await db.get('SELECT * FROM units WHERE id = ?', [id])) as any;
    if (!old) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }

    await db.run('DELETE FROM units WHERE id = ?', [id]);
    await audit.delete(req, id, old);

    res.json({ message: 'Unit deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
