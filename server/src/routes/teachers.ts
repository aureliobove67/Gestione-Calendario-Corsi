import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';

const router = Router();
const audit = withAudit('teacher');

// GET /api/admin/teachers
router.get('/', (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;
    let teachers;
    if (period_id) {
      teachers = db.prepare('SELECT * FROM teachers WHERE period_id = ? ORDER BY name').all(period_id as any);
    } else {
      teachers = db.prepare('SELECT * FROM teachers ORDER BY name').all();
    }
    res.json(teachers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/teachers
router.post('/', (req: Request, res: Response) => {
  try {
    const { period_id, name, organization, email, phone } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    let activePeriodId = period_id;
    if (!activePeriodId) {
      const activePeriod = db.prepare('SELECT id FROM academic_periods WHERE is_active = 1').get() as any;
      if (activePeriod) {
        activePeriodId = activePeriod.id;
      } else {
        const firstPeriod = db.prepare('SELECT id FROM academic_periods LIMIT 1').get() as any;
        if (firstPeriod) {
          activePeriodId = firstPeriod.id;
        }
      }
    }

    if (!activePeriodId) {
      res.status(400).json({ error: 'Nessun periodo accademico trovato. Crea prima un periodo.' });
      return;
    }

    // Controlla se esiste già un docente con lo stesso nome nel periodo (case-insensitive)
    const existing = db.prepare('SELECT name FROM teachers WHERE period_id = ? AND LOWER(name) = LOWER(?)').get(activePeriodId, name.trim()) as any;
    if (existing) {
      res.status(400).json({
        error: `Impossibile creare il docente: esiste già un docente con il nome "${existing.name}" in questo periodo. Se si tratta di un omonimo, inserisci un elemento distintivo (es. un secondo nome, un'iniziale o l'organizzazione).`
      });
      return;
    }

    const result = db.prepare(
      'INSERT INTO teachers (period_id, name, organization, email, phone, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(activePeriodId, name.trim(), organization || null, email || null, phone || null, req.user!.id);

    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(result.lastInsertRowid);
    audit.create(req, Number(result.lastInsertRowid), teacher);

    res.status(201).json(teacher);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/teachers/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    const { period_id, name, organization, email, phone } = req.body;

    const newPeriodId = period_id || old.period_id;
    const newName = name !== undefined ? name.trim() : old.name;

    if (name !== undefined) {
      const existing = db.prepare('SELECT name FROM teachers WHERE period_id = ? AND LOWER(name) = LOWER(?) AND id != ?').get(newPeriodId, newName, id) as any;
      if (existing) {
        res.status(400).json({
          error: `Impossibile aggiornare il docente: esiste già un docente con il nome "${existing.name}" in questo periodo. Se si tratta di un omonimo, inserisci un elemento distintivo (es. un secondo nome, un'iniziale o l'organizzazione).`
        });
        return;
      }
    }

    db.prepare(
      'UPDATE teachers SET period_id = ?, name = ?, organization = ?, email = ?, phone = ? WHERE id = ?'
    ).run(
      newPeriodId,
      newName,
      organization !== undefined ? organization : old.organization,
      email !== undefined ? email : old.email,
      phone !== undefined ? phone : old.phone,
      id
    );

    const updated = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id);
    audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/teachers/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    if (!old) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    // Controlla se il docente è collegato ad un corso (tramite assignments)
    const linkedAssignments = db.prepare('SELECT COUNT(*) as count FROM assignments WHERE teacher_id = ?').get(id) as any;
    if (linkedAssignments && linkedAssignments.count > 0) {
      res.status(400).json({ error: 'Impossibile eliminare il docente: è attualmente collegato ad uno o più corsi (assegnato ad una o più Unità Formative).' });
      return;
    }

    db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
    audit.delete(req, id, old);

    res.json({ message: 'Teacher deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
