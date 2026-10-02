import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('academic_period');

// GET /api/admin/periods
router.get('/', (req: Request, res: Response) => {
  try {
    const periods = db.prepare('SELECT * FROM academic_periods ORDER BY start_date DESC').all();
    res.json(periods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/periods
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, start_date, end_date, is_active } = req.body;

    if (!name || !start_date || !end_date) {
      res.status(400).json({ error: 'Name, start_date, and end_date are required' });
      return;
    }

    const result = db.prepare(
      `INSERT INTO academic_periods (name, description, start_date, end_date, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, description || null, start_date, end_date, is_active !== undefined ? (is_active ? 1 : 0) : 1, req.user!.id);

    const period = db.prepare('SELECT * FROM academic_periods WHERE id = ?').get(result.lastInsertRowid);
    audit.create(req, Number(result.lastInsertRowid), period);

    res.status(201).json(period);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/periods/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM academic_periods WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    const { name, description, start_date, end_date, is_active } = req.body;

    db.prepare(
      `UPDATE academic_periods SET name = ?, description = ?, start_date = ?, end_date = ?, is_active = ?
       WHERE id = ?`
    ).run(
      name || old.name,
      description !== undefined ? description : old.description,
      start_date || old.start_date,
      end_date || old.end_date,
      is_active !== undefined ? (is_active ? 1 : 0) : old.is_active,
      id
    );

    const updated = db.prepare('SELECT * FROM academic_periods WHERE id = ?').get(id);
    audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/periods/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM academic_periods WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Controlla se ci sono corsi legati a questo periodo
    const linkedCourses = db.prepare('SELECT COUNT(*) as count FROM courses WHERE period_id = ?').get(id) as any;
    if (linkedCourses && linkedCourses.count > 0) {
      res.status(400).json({
        error: 'Impossibile eliminare il periodo: ci sono ancora corsi ad esso associati. Elimina prima tutti i corsi legati a questo periodo.'
      });
      return;
    }

    // Controlla se ci sono docenti legati a questo periodo
    const linkedTeachers = db.prepare('SELECT COUNT(*) as count FROM teachers WHERE period_id = ?').get(id) as any;
    if (linkedTeachers && linkedTeachers.count > 0) {
      res.status(400).json({
        error: 'Impossibile eliminare il periodo: ci sono ancora docenti ad esso associati. Elimina prima tutti i docenti legati a questo periodo.'
      });
      return;
    }

    db.prepare('DELETE FROM academic_periods WHERE id = ?').run(id);
    audit.delete(req, id, old);

    res.json({ message: 'Period deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
