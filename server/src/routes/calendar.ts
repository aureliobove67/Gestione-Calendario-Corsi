import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/public/periods
router.get('/periods', (_req: Request, res: Response) => {
  try {
    const periods = db.prepare(
      'SELECT id, name, description, start_date, end_date, is_active FROM academic_periods WHERE is_active = 1 ORDER BY start_date DESC'
    ).all();
    res.json(periods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/courses?period_id=
router.get('/courses', (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;

    let query = `
      SELECT c.*,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'AULA'), 0) as used_hours_aula,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'WEBINAR'), 0) as used_hours_webinar,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'FAD'), 0) as used_hours_fad,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'PW'), 0) as used_hours_pw,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'STAGE'), 0) as used_hours_stage,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          WHERE l.course_id = c.id AND l.location_type = 'EXTRA'), 0) as used_hours_extra
      FROM courses c
    `;

    const params: any[] = [];
    if (period_id) {
      query += ' WHERE c.period_id = ?';
      params.push(period_id);
    }
    query += ' ORDER BY c.code';

    const courses = db.prepare(query).all(...params);
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/progress?period_id= — Global period progress (only lessons up to today, deadline-aware)
router.get('/progress', (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;
    if (!period_id) {
      res.status(400).json({ error: 'period_id è obbligatorio' });
      return;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get all courses for this period
    const courses = db.prepare(`
      SELECT c.id, c.code, c.name,
        COALESCE(c.total_hours_aula, 0) as total_hours_aula,
        COALESCE(c.total_hours_webinar, 0) as total_hours_webinar,
        COALESCE(c.total_hours_fad, 0) as total_hours_fad,
        COALESCE(c.total_hours_pw, 0) as total_hours_pw,
        COALESCE(c.total_hours_stage, 0) as total_hours_stage,
        COALESCE(c.total_hours_extra, 0) as total_hours_extra,
        c.non_contract_deadline
      FROM courses c
      WHERE c.period_id = ?
      ORDER BY c.code
    `).all(period_id as any) as any[];

    let totalHoursPeriod = 0;
    let scheduledUpToToday = 0;

    for (const course of courses) {
      // Always include: Aula + PW (contract hours)
      let courseTotal = course.total_hours_aula + course.total_hours_pw;

      // Non-contract hours (Webinar, FAD, Stage): include only if deadline NOT expired
      const deadline = course.non_contract_deadline;
      const deadlineActive = !deadline || deadline >= today;

      if (deadlineActive) {
        courseTotal += course.total_hours_webinar + course.total_hours_fad + course.total_hours_stage;
      }

      totalHoursPeriod += courseTotal;

      // Scheduled hours UP TO TODAY ONLY (not future)
      // Regular lessons (via assignments)
      const regularResult = db.prepare(`
        SELECT COALESCE(SUM(l.hours), 0) as total
        FROM lessons l
        JOIN assignments a ON l.assignment_id = a.id
        JOIN units u ON a.unit_id = u.id
        WHERE u.course_id = ? AND l.date <= ? AND l.location_type != 'EXTRA'
      `).get(course.id, today) as any;

      let courseScheduled = regularResult.total || 0;

      // If deadline is expired, exclude non-contract type lessons from scheduled count
      if (!deadlineActive) {
        const nonContractScheduled = db.prepare(`
          SELECT COALESCE(SUM(l.hours), 0) as total
          FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = ? AND l.date <= ? AND l.location_type IN ('WEBINAR', 'FAD', 'STAGE')
        `).get(course.id, today) as any;
        courseScheduled -= (nonContractScheduled.total || 0);
      }

      scheduledUpToToday += courseScheduled;
    }

    const progressPercent = totalHoursPeriod > 0 
      ? Math.min(100, Math.round((scheduledUpToToday / totalHoursPeriod) * 100)) 
      : 0;

    res.json({
      period_id: parseInt(period_id as string),
      today,
      total_hours: totalHoursPeriod,
      scheduled_hours: scheduledUpToToday,
      remaining_hours: totalHoursPeriod - scheduledUpToToday,
      progress_percent: progressPercent,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/teachers?period_id=
router.get('/teachers', (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;
    let teachers;
    if (period_id) {
      teachers = db.prepare(
        'SELECT id, name, organization, email FROM teachers WHERE period_id = ? ORDER BY name'
      ).all(period_id as any);
    } else {
      teachers = db.prepare('SELECT id, name, organization, email FROM teachers ORDER BY name').all();
    }
    res.json(teachers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/calendar?period_id=&week=YYYY-MM-DD
router.get('/calendar', (req: Request, res: Response) => {
  try {
    const { period_id, week } = req.query;

    if (!week) {
      res.status(400).json({ error: 'week parameter is required (format: YYYY-MM-DD, start of the week)' });
      return;
    }

    // Calculate the end of the week (Sunday) - parse safely to avoid timezone issues
    const [wy, wm, wd] = (week as string).split('-').map(Number);
    const weekStart = new Date(wy, wm - 1, wd);
    const weekEnd = new Date(wy, wm - 1, wd + 6);
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;

    // Build queries for regular and EXTRA lessons
    let regularQuery = `
      SELECT l.id, l.date, l.start_time, l.end_time, l.hours, l.location_type, l.notes,
             t.name as teacher_name, u.name as unit_name,
             c.name as course_name, c.code as course_code
      FROM lessons l
      JOIN assignments a ON l.assignment_id = a.id
      JOIN teachers t ON a.teacher_id = t.id
      JOIN units u ON a.unit_id = u.id
      JOIN courses c ON u.course_id = c.id
      WHERE l.assignment_id IS NOT NULL AND l.date >= ? AND l.date <= ?
    `;
    let extraQuery = `
      SELECT l.id, l.date, l.start_time, l.end_time, l.hours, l.location_type, l.notes,
             NULL as teacher_name, 'Ore Extra' as unit_name,
             c.name as course_name, c.code as course_code
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.location_type = 'EXTRA' AND l.date >= ? AND l.date <= ?
    `;
    const regularParams: any[] = [week, weekEndStr];
    const extraParams: any[] = [week, weekEndStr];

    if (period_id) {
      regularQuery += ' AND c.period_id = ?';
      regularParams.push(period_id);
      extraQuery += ' AND c.period_id = ?';
      extraParams.push(period_id);
    }

    const fullQuery = `${regularQuery} UNION ALL ${extraQuery} ORDER BY date, start_time`;
    const allParams = [...regularParams, ...extraParams];

    const lessons = db.prepare(fullQuery).all(...allParams);
    res.json(lessons);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/calendar/month?period_id=&month=YYYY-MM
router.get('/calendar/month', (req: Request, res: Response) => {
  try {
    const { period_id, month } = req.query;

    if (!month) {
      res.status(400).json({ error: 'month parameter is required (format: YYYY-MM)' });
      return;
    }

    const monthStr = month as string;
    const [year, m] = monthStr.split('-').map(Number);
    const startDate = `${monthStr}-01`;
    // Last day of month
    const lastDay = new Date(year, m, 0).getDate();
    const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // Build queries for regular and EXTRA lessons
    let regularQuery = `
      SELECT l.id, l.date, l.start_time, l.end_time, l.hours, l.location_type, l.notes,
             t.name as teacher_name, u.name as unit_name,
             c.name as course_name, c.code as course_code
      FROM lessons l
      JOIN assignments a ON l.assignment_id = a.id
      JOIN teachers t ON a.teacher_id = t.id
      JOIN units u ON a.unit_id = u.id
      JOIN courses c ON u.course_id = c.id
      WHERE l.assignment_id IS NOT NULL AND l.date >= ? AND l.date <= ?
    `;
    let extraQuery = `
      SELECT l.id, l.date, l.start_time, l.end_time, l.hours, l.location_type, l.notes,
             NULL as teacher_name, 'Ore Extra' as unit_name,
             c.name as course_name, c.code as course_code
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.location_type = 'EXTRA' AND l.date >= ? AND l.date <= ?
    `;
    const regularParams: any[] = [startDate, endDate];
    const extraParams: any[] = [startDate, endDate];

    if (period_id) {
      regularQuery += ' AND c.period_id = ?';
      regularParams.push(period_id);
      extraQuery += ' AND c.period_id = ?';
      extraParams.push(period_id);
    }

    const fullQuery = `${regularQuery} UNION ALL ${extraQuery} ORDER BY date, start_time`;
    const allParams = [...regularParams, ...extraParams];

    const lessons = db.prepare(fullQuery).all(...allParams);
    res.json(lessons);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
