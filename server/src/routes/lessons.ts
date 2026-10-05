import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { withAudit } from '../middleware/audit';
import { validateNewLessonHours } from '../utils/hours-validator';

const router = Router();
const audit = withAudit('lesson');

// Holiday calculation helpers for the backend
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getItalianHoliday(dateStr: string): { isHoliday: boolean; name?: string } {
  // Match YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { isHoliday: false };
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  const date = new Date(year, month - 1, day);

  // Fixed holidays
  if (month === 1 && day === 1) return { isHoliday: true, name: 'Capodanno' };
  if (month === 1 && day === 6) return { isHoliday: true, name: 'Epifania' };
  if (month === 4 && day === 25) return { isHoliday: true, name: 'Festa della Liberazione' };
  if (month === 5 && day === 1) return { isHoliday: true, name: 'Festa del Lavoro' };
  if (month === 6 && day === 2) return { isHoliday: true, name: 'Festa della Repubblica' };
  if (month === 8 && day === 15) return { isHoliday: true, name: 'Ferragosto' };
  if (month === 11 && day === 1) return { isHoliday: true, name: 'Tutti i Santi' };
  if (month === 12 && day === 8) return { isHoliday: true, name: 'Immacolata Concezione' };
  if (month === 12 && day === 25) return { isHoliday: true, name: 'Natale' };
  if (month === 12 && day === 26) return { isHoliday: true, name: 'Santo Stefano' };

  // Variable holidays
  const easter = getEasterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  if (date.getMonth() === easter.getMonth() && date.getDate() === easter.getDate()) {
    return { isHoliday: true, name: 'Pasqua' };
  }
  if (date.getMonth() === easterMonday.getMonth() && date.getDate() === easterMonday.getDate()) {
    return { isHoliday: true, name: "Lunedì dell'Angelo (Pasquetta)" };
  }

  return { isHoliday: false };
}

async function validateLessonOverlapsAndHolidays(
  assignmentId: number,
  dateStr: string,
  startTime: string,
  endTime: string,
  excludeLessonId?: number
): Promise<{ valid: boolean; error?: string }> {
  // 1. Holiday / Saturday / Sunday check
  // Match YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    const parsedDate = new Date(year, month - 1, day);
    const dayOfWeek = parsedDate.getDay(); // 0 = Sunday, 6 = Saturday
    const holiday = getItalianHoliday(dateStr);

    if (dayOfWeek === 0 || holiday.isHoliday) {
      return {
        valid: false,
        error: `Impossibile programmare lezioni di Domenica o nei giorni festivi (${holiday.name || 'Domenica'})!`
      };
    }
    if (dayOfWeek === 6) {
      return {
        valid: false,
        error: `Impossibile programmare lezioni di Sabato! L'inserimento è bloccato.`
      };
    }
  }

  // 2. Fetch teacher and course info for this assignment
  const assignmentInfo = await db.get(`
    SELECT a.teacher_id, u.course_id
    FROM assignments a
    JOIN units u ON a.unit_id = u.id
    WHERE a.id = ?
  `, [assignmentId]) as any;

  if (!assignmentInfo) {
    return { valid: false, error: 'Assegnazione non trovata!' };
  }

  // 3. Overlap check (if times are set)
  if (startTime && endTime) {
    // Check teacher double booking
    const teacherOverlap = await db.get(`
      SELECT l.id, c.name as course_name, u.name as unit_name, t.name as teacher_name, l.date, l.start_time, l.end_time
      FROM lessons l
      JOIN assignments a ON l.assignment_id = a.id
      JOIN teachers t ON a.teacher_id = t.id
      JOIN units u ON a.unit_id = u.id
      JOIN courses c ON u.course_id = c.id
      WHERE t.id = ? AND l.date = ? AND l.start_time < ? AND l.end_time > ? ${excludeLessonId ? `AND l.id != ${excludeLessonId}` : ''}
    `, [assignmentInfo.teacher_id, dateStr, endTime, startTime]) as any;

    if (teacherOverlap) {
      return {
        valid: false,
        error: `⚠️ Il docente ${teacherOverlap.teacher_name} è già impegnato in un'altra lezione per il corso "${teacherOverlap.course_name}" dalle ${teacherOverlap.start_time} alle ${teacherOverlap.end_time}!`
      };
    }

    // Check course double booking
    const courseOverlap = await db.get(`
      SELECT l.id, c.name as course_name, u.name as unit_name, t.name as teacher_name, l.date, l.start_time, l.end_time
      FROM lessons l
      JOIN assignments a ON l.assignment_id = a.id
      JOIN teachers t ON a.teacher_id = t.id
      JOIN units u ON a.unit_id = u.id
      JOIN courses c ON u.course_id = c.id
      WHERE c.id = ? AND l.date = ? AND l.start_time < ? AND l.end_time > ? ${excludeLessonId ? `AND l.id != ${excludeLessonId}` : ''}
    `, [assignmentInfo.course_id, dateStr, endTime, startTime]) as any;

    if (courseOverlap) {
      return {
        valid: false,
        error: `⚠️ Il corso "${courseOverlap.course_name}" ha già un'altra lezione programmata dalle ${courseOverlap.start_time} alle ${courseOverlap.end_time} con il docente ${courseOverlap.teacher_name}!`
      };
    }
  }

  return { valid: true };
}

// GET /api/admin/lessons
router.get('/', async (req: Request, res: Response) => {
  try {
    const { assignment_id, date_from, date_to, course_id } = req.query;
    let query = `
      SELECT l.*,
             COALESCE(a.total_hours, 0) as assignment_total_hours,
             COALESCE(t.name, NULL) as teacher_name,
             COALESCE(u.name, CASE WHEN l.location_type = 'EXTRA' THEN 'Ore Extra' ELSE NULL END) as unit_name,
             COALESCE(c1.name, c2.name) as course_name,
             COALESCE(c1.code, c2.code) as course_code
      FROM lessons l
      LEFT JOIN assignments a ON l.assignment_id = a.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN units u ON a.unit_id = u.id
      LEFT JOIN courses c1 ON u.course_id = c1.id
      LEFT JOIN courses c2 ON l.course_id = c2.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (assignment_id) {
      query += ' AND l.assignment_id = ?';
      params.push(assignment_id);
    }
    if (date_from) {
      query += ' AND l.date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      query += ' AND l.date <= ?';
      params.push(date_to);
    }
    if (course_id) {
      query += ' AND (u.course_id = ? OR l.course_id = ?)';
      params.push(course_id, course_id);
    }

    query += ' ORDER BY l.date, l.start_time';

    const lessons = await db.all(query, params);
    res.json(lessons);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/lessons/:id - single lesson with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    
    // First try to get the lesson to check if it's EXTRA
    const rawLesson = await db.get('SELECT * FROM lessons WHERE id = ?', [id]) as any;
    if (!rawLesson) {
      res.status(404).json({ error: 'Lezione non trovata' });
      return;
    }
    
    if (rawLesson.location_type === 'EXTRA') {
      // EXTRA lesson: join directly with courses
      const lesson = await db.get(`
        SELECT l.*, c.name as course_name, c.code as course_code, c.id as course_id,
               c.total_hours_extra,
               NULL as unit_id, NULL as unit_name, NULL as teacher_id, NULL as teacher_name,
               NULL as assignment_total_hours
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = ?
      `, [id]);
      res.json(lesson);
    } else {
      // Regular lesson: join through assignments
      const lesson = await db.get(`
        SELECT l.*, a.total_hours as assignment_total_hours,
               a.unit_id, a.teacher_id,
               t.name as teacher_name, u.name as unit_name,
               u.course_id,
               c.name as course_name, c.code as course_code
        FROM lessons l
        JOIN assignments a ON l.assignment_id = a.id
        JOIN teachers t ON a.teacher_id = t.id
        JOIN units u ON a.unit_id = u.id
        JOIN courses c ON u.course_id = c.id
        WHERE l.id = ?
      `, [id]);
      res.json(lesson);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/lessons
router.post('/', async (req: Request, res: Response) => {
  try {
    const { assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, force, override_reason } = req.body;

    if (!date || !hours || !location_type) {
      res.status(400).json({ error: 'date, hours, and location_type sono obbligatori' });
      return;
    }

    // === EXTRA lesson: no assignment, only course_id ===
    if (location_type === 'EXTRA') {
      if (!course_id) {
        res.status(400).json({ error: 'course_id è obbligatorio per le lezioni Ore Extra' });
        return;
      }
      if (!notes || notes.trim() === '') {
        res.status(400).json({ error: 'Le note sono obbligatorie per le lezioni Ore Extra' });
        return;
      }

      // Validate date (holidays/weekends)
      const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        const parsedDate = new Date(year, month - 1, day);
        const dayOfWeek = parsedDate.getDay();
        const holiday = getItalianHoliday(date);
        if (dayOfWeek === 0 || holiday.isHoliday) {
          res.status(409).json({ error: `Impossibile programmare lezioni di Domenica o nei giorni festivi (${holiday.name || 'Domenica'})!` });
          return;
        }
        if (dayOfWeek === 6) {
          res.status(409).json({ error: `Impossibile programmare lezioni di Sabato! L'inserimento è bloccato.` });
          return;
        }
      }

      // Check course has extra hours
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [course_id]) as any;
      if (!course) {
        res.status(404).json({ error: 'Corso non trovato' });
        return;
      }
      const totalExtra = course.total_hours_extra || 0;
      const usedExtra = ((await db.get(
        `SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE course_id = ? AND location_type = 'EXTRA'`,
        [course_id]
      )) as any).used;
      const remainingExtra = totalExtra - usedExtra;

      if (totalExtra <= 0) {
        res.status(400).json({ error: `Il corso "${course.name}" non ha Ore Extra configurate. Configura le Ore Extra nella Gestione Corsi.` });
        return;
      }
      if (hours > remainingExtra) {
        res.status(400).json({ error: `Ore Extra insufficienti per il corso "${course.name}". Disponibili: ${remainingExtra}h, richieste: ${hours}h.` });
        return;
      }

      // Check course overlap (for EXTRA lessons, check via course_id across ALL lesson types)
      if (start_time && end_time) {
        // Check overlap with regular lessons of the same course
        const regularOverlap = await db.get(`
          SELECT l.id, c.name as course_name, l.start_time, l.end_time
          FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          JOIN courses c ON u.course_id = c.id
          WHERE c.id = ? AND l.date = ? AND l.start_time < ? AND l.end_time > ?
        `, [course_id, date, end_time, start_time]) as any;
        if (regularOverlap) {
          res.status(409).json({ error: `⚠️ Il corso ha già una lezione programmata dalle ${regularOverlap.start_time} alle ${regularOverlap.end_time}!` });
          return;
        }
        // Check overlap with other EXTRA lessons of the same course
        const extraOverlap = await db.get(`
          SELECT l.id, l.start_time, l.end_time
          FROM lessons l
          WHERE l.course_id = ? AND l.location_type = 'EXTRA' AND l.date = ? AND l.start_time < ? AND l.end_time > ?
        `, [course_id, date, end_time, start_time]) as any;
        if (extraOverlap) {
          res.status(409).json({ error: `⚠️ Il corso ha già un'altra lezione Ore Extra programmata dalle ${extraOverlap.start_time} alle ${extraOverlap.end_time}!` });
          return;
        }
      }

      const result = await db.run(
        `INSERT INTO lessons (assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, is_override, override_reason, created_by)
         VALUES (NULL, ?, ?, ?, ?, ?, 'EXTRA', ?, 0, NULL, ?)`,
        [course_id, date, start_time || null, end_time || null, hours, notes, req.user!.id]
      );

      const lesson = await db.get('SELECT * FROM lessons WHERE id = ?', [result.lastInsertRowid]);
      await audit.create(req, Number(result.lastInsertRowid), lesson);
      res.status(201).json(lesson);
      return;
    }

    // === Regular lesson (existing logic) ===
    if (!assignment_id) {
      res.status(400).json({ error: 'assignment_id è obbligatorio per le lezioni regolari' });
      return;
    }

    // Validate overlaps and holidays
    const overlapValidation = await validateLessonOverlapsAndHolidays(assignment_id, date, start_time, end_time);
    if (!overlapValidation.valid) {
      res.status(409).json({ error: overlapValidation.error });
      return;
    }

    // Validate hours
    const validation = await validateNewLessonHours(assignment_id, hours);

    if (!validation.valid) {
      if (!force) {
        res.status(409).json({
          warning: true,
          message: validation.message,
          remainingHours: validation.remainingHours,
          usedHours: validation.usedHours,
          totalHours: validation.totalHours
        });
        return;
      }
      if (!override_reason) {
        res.status(400).json({ error: 'override_reason is required when forcing an override' });
        return;
      }
    }

    const isOverride = !validation.valid && force ? 1 : 0;

    const result = await db.run(
      `INSERT INTO lessons (assignment_id, date, start_time, end_time, hours, location_type, notes, is_override, override_reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assignment_id, date, start_time || null, end_time || null, hours, location_type,
        notes || null, isOverride, isOverride ? override_reason : null, req.user!.id
      ]
    );

    const lesson = await db.get('SELECT * FROM lessons WHERE id = ?', [result.lastInsertRowid]);
    await audit.create(req, Number(result.lastInsertRowid), lesson);

    res.status(201).json(lesson);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/lessons/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = await db.get('SELECT * FROM lessons WHERE id = ?', [id]) as any;
    if (!old) {
      res.status(404).json({ error: 'Lezione non trovata' });
      return;
    }

    const { assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, force, override_reason } = req.body;

    const newLocationType = location_type || old.location_type;
    const newHours = hours !== undefined ? hours : old.hours;
    const newDate = date || old.date;
    const newStartTime = start_time !== undefined ? start_time : old.start_time;
    const newEndTime = end_time !== undefined ? end_time : old.end_time;

    // === EXTRA lesson update ===
    if (newLocationType === 'EXTRA') {
      const effectiveCourseId = course_id || old.course_id;
      const newNotes = notes !== undefined ? notes : old.notes;
      
      if (!newNotes || newNotes.trim() === '') {
        res.status(400).json({ error: 'Le note sono obbligatorie per le lezioni Ore Extra' });
        return;
      }

      // Holiday/weekend check
      const match = newDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const yr = parseInt(match[1]);
        const mo = parseInt(match[2]);
        const dy = parseInt(match[3]);
        const pd = new Date(yr, mo - 1, dy);
        const dow = pd.getDay();
        const hol = getItalianHoliday(newDate);
        if (dow === 0 || hol.isHoliday) {
          res.status(409).json({ error: `Impossibile programmare lezioni di Domenica o nei giorni festivi (${hol.name || 'Domenica'})!` });
          return;
        }
        if (dow === 6) {
          res.status(409).json({ error: `Impossibile programmare lezioni di Sabato! L'inserimento è bloccato.` });
          return;
        }
      }

      // Validate extra hours
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [effectiveCourseId]) as any;
      if (!course) {
        res.status(404).json({ error: 'Corso non trovato' });
        return;
      }
      const totalExtra = course.total_hours_extra || 0;
      const usedExtra = ((await db.get(
        `SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE course_id = ? AND location_type = 'EXTRA' AND id != ?`,
        [effectiveCourseId, id]
      )) as any).used;
      const remainingExtra = totalExtra - usedExtra;

      if (newHours > remainingExtra) {
        res.status(400).json({ error: `Ore Extra insufficienti per il corso "${course.name}". Disponibili: ${remainingExtra}h, richieste: ${newHours}h.` });
        return;
      }

      await db.run(
        `UPDATE lessons SET assignment_id = NULL, course_id = ?, date = ?, start_time = ?, end_time = ?,
         hours = ?, location_type = 'EXTRA', notes = ?,
         updated_at = CURRENT_TIMESTAMP, updated_by = ?
         WHERE id = ?`,
        [
          effectiveCourseId, newDate, newStartTime, newEndTime,
          newHours, newNotes, req.user!.id, id
        ]
      );

      const updated = await db.get('SELECT * FROM lessons WHERE id = ?', [id]);
      await audit.update(req, id, old, updated);
      res.json(updated);
      return;
    }

    // === Regular lesson update (existing logic) ===
    const newAssignmentId = assignment_id || old.assignment_id;

    const overlapValidation = await validateLessonOverlapsAndHolidays(newAssignmentId, newDate, newStartTime, newEndTime, id);
    if (!overlapValidation.valid) {
      res.status(409).json({ error: overlapValidation.error });
      return;
    }

    const validation = await validateNewLessonHours(newAssignmentId, newHours, id);

    if (!validation.valid) {
      if (!force) {
        res.status(409).json({
          warning: true,
          message: validation.message,
          remainingHours: validation.remainingHours,
          usedHours: validation.usedHours,
          totalHours: validation.totalHours
        });
        return;
      }
      if (!override_reason) {
        res.status(400).json({ error: 'override_reason is required when forcing an override' });
        return;
      }
    }

    const isOverride = !validation.valid && force ? 1 : old.is_override;

    await db.run(
      `UPDATE lessons SET assignment_id = ?, date = ?, start_time = ?, end_time = ?,
       hours = ?, location_type = ?, notes = ?, is_override = ?, override_reason = ?,
       updated_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ?`,
      [
        newAssignmentId,
        newDate,
        newStartTime,
        newEndTime,
        newHours,
        location_type || old.location_type,
        notes !== undefined ? notes : old.notes,
        isOverride,
        isOverride ? (override_reason || old.override_reason) : null,
        req.user!.id,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM lessons WHERE id = ?', [id]);
    await audit.update(req, id, old, updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/lessons/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const old = await db.get('SELECT * FROM lessons WHERE id = ?', [id]) as any;
    if (!old) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    await db.run('DELETE FROM lessons WHERE id = ?', [id]);
    await audit.delete(req, id, old);

    res.json({ message: 'Lesson deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
