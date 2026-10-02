import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('course');

// GET /api/admin/courses
router.get('/', (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;
    let courses;
    if (period_id) {
      courses = db.prepare('SELECT * FROM courses WHERE period_id = ? ORDER BY code').all(period_id as any);
    } else {
      courses = db.prepare('SELECT * FROM courses ORDER BY code').all();
    }
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/courses
router.post('/', (req: Request, res: Response) => {
  try {
    const { period_id, code, name, description, total_hours_aula, total_hours_webinar, total_hours_fad, total_hours_pw, total_hours_stage, total_hours_extra, non_contract_deadline } = req.body;

    if (!period_id || !name) {
      res.status(400).json({ error: 'period_id and name are required' });
      return;
    }

    let formattedCode = code;
    if (code && typeof code === 'string') {
      const match = code.trim().match(/^Mod\.\s*(\d)$/i);
      if (match) {
        formattedCode = `Mod.0${match[1]}`;
      }
    }

    if (formattedCode) {
      const existing = db.prepare('SELECT id FROM courses WHERE period_id = ? AND code = ?').get(period_id, formattedCode);
      if (existing) {
        res.status(400).json({ error: `Impossibile creare il corso: esiste già un corso con codice "${formattedCode}" in questo periodo!` });
        return;
      }
    }

    const result = db.prepare(
      `INSERT INTO courses (period_id, code, name, description, total_hours_aula, total_hours_webinar, total_hours_fad, total_hours_pw, total_hours_stage, total_hours_extra, non_contract_deadline, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      period_id, formattedCode || null, name, description || null,
      total_hours_aula || 0, total_hours_webinar || 0, total_hours_fad || 0,
      total_hours_pw || 0, total_hours_stage || 0, total_hours_extra || 0, non_contract_deadline || null, req.user!.id
    );

    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
    audit.create(req, Number(result.lastInsertRowid), course);

    res.status(201).json(course);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/courses/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const { period_id, code, name, description, total_hours_aula, total_hours_webinar, total_hours_fad, total_hours_pw, total_hours_stage, total_hours_extra, non_contract_deadline } = req.body;

    let formattedCode = code;
    if (code && typeof code === 'string') {
      const match = code.trim().match(/^Mod\.\s*(\d)$/i);
      if (match) {
        formattedCode = `Mod.0${match[1]}`;
      }
    }

    const newPeriodId = period_id || old.period_id;
    const newCode = code !== undefined ? (formattedCode || null) : old.code;

    if (newCode) {
      const existing = db.prepare('SELECT id FROM courses WHERE period_id = ? AND code = ? AND id != ?').get(newPeriodId, newCode, id);
      if (existing) {
        res.status(400).json({ error: `Impossibile aggiornare il corso: esiste già un corso con codice "${newCode}" in questo periodo!` });
        return;
      }
    }

    db.prepare(
      `UPDATE courses SET period_id = ?, code = ?, name = ?, description = ?,
       total_hours_aula = ?, total_hours_webinar = ?, total_hours_fad = ?,
       total_hours_pw = ?, total_hours_stage = ?, total_hours_extra = ?, non_contract_deadline = ? WHERE id = ?`
    ).run(
      period_id || old.period_id, code !== undefined ? (formattedCode || null) : old.code,
      name || old.name, description !== undefined ? description : old.description,
      total_hours_aula !== undefined ? total_hours_aula : old.total_hours_aula,
      total_hours_webinar !== undefined ? total_hours_webinar : old.total_hours_webinar,
      total_hours_fad !== undefined ? total_hours_fad : old.total_hours_fad,
      total_hours_pw !== undefined ? total_hours_pw : old.total_hours_pw,
      total_hours_stage !== undefined ? total_hours_stage : old.total_hours_stage,
      total_hours_extra !== undefined ? total_hours_extra : old.total_hours_extra,
      non_contract_deadline !== undefined ? (non_contract_deadline || null) : old.non_contract_deadline,
      id
    );

    const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
    audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/courses/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Controlla se al corso è collegato almeno un docente (tramite assignments alle sue unit)
    const linkedTeachers = db.prepare(`
      SELECT COUNT(*) as count 
      FROM assignments a
      JOIN units u ON a.unit_id = u.id
      WHERE u.course_id = ?
    `).get(id) as any;

    if (linkedTeachers && linkedTeachers.count > 0) {
      res.status(400).json({ error: 'Impossibile eliminare il corso: uno o più docenti sono assegnati alle sue Unità Formative.' });
      return;
    }

    db.prepare('DELETE FROM courses WHERE id = ?').run(id);
    audit.delete(req, id, old);

    res.json({ message: 'Course deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
