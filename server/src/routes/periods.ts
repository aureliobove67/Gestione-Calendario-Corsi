import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('academic_period');

// GET /api/admin/periods
router.get('/', async (req: Request, res: Response) => {
  try {
    const periods = await db.all('SELECT * FROM academic_periods ORDER BY start_date DESC');
    res.json(periods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/periods
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, start_date, end_date, is_active } = req.body;

    if (!name || !start_date || !end_date) {
      res.status(400).json({ error: 'Name, start_date, and end_date are required' });
      return;
    }

    const result = await db.run(
      `INSERT INTO academic_periods (name, description, start_date, end_date, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, start_date, end_date, is_active !== undefined ? (is_active ? 1 : 0) : 1, req.user!.id]
    );

    const period = await db.get('SELECT * FROM academic_periods WHERE id = ?', [result.lastInsertRowid]);
    await audit.create(req, Number(result.lastInsertRowid), period);

    res.status(201).json(period);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/periods/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = await db.get('SELECT * FROM academic_periods WHERE id = ?', [id]) as any;
    if (!old) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    const { name, description, start_date, end_date, is_active } = req.body;

    await db.run(
      `UPDATE academic_periods SET name = ?, description = ?, start_date = ?, end_date = ?, is_active = ?
       WHERE id = ?`,
      [
        name || old.name,
        description !== undefined ? description : old.description,
        start_date || old.start_date,
        end_date || old.end_date,
        is_active !== undefined ? (is_active ? 1 : 0) : old.is_active,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM academic_periods WHERE id = ?', [id]);
    await audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/periods/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = await db.get('SELECT * FROM academic_periods WHERE id = ?', [id]) as any;
    if (!old) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Controlla se ci sono corsi legati a questo periodo
    const linkedCourses = await db.get('SELECT COUNT(*) as count FROM courses WHERE period_id = ?', [id]) as any;
    if (linkedCourses && linkedCourses.count > 0) {
      res.status(400).json({
        error: 'Impossibile eliminare il periodo: ci sono ancora corsi ad esso associati. Elimina prima tutti i corsi legati a questo periodo.'
      });
      return;
    }

    // Controlla se ci sono docenti legati a questo periodo
    const linkedTeachers = await db.get('SELECT COUNT(*) as count FROM teachers WHERE period_id = ?', [id]) as any;
    if (linkedTeachers && linkedTeachers.count > 0) {
      res.status(400).json({
        error: 'Impossibile eliminare il periodo: ci sono ancora docenti ad esso associati. Elimina prima tutti i docenti legati a questo periodo.'
      });
      return;
    }

    await db.run('DELETE FROM academic_periods WHERE id = ?', [id]);
    await audit.delete(req, id, old);

    res.json({ message: 'Period deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
