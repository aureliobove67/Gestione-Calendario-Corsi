import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/admin/detail/course/:id — Full course detail with UFs, teachers, and lessons
router.get('/course/:id', async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.id as string);

    // Get course info with used hours
    const course = await db.get(`
      SELECT c.*,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'AULA'), 0) as used_hours_aula,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'PW'), 0) as used_hours_pw
      FROM courses c
      WHERE c.id = ?
    `, [courseId]) as any;

    if (!course) {
      res.status(404).json({ error: 'Corso non trovato' });
      return;
    }

    // Get all units with assignments and lessons
    const units = await db.all(
      'SELECT * FROM units WHERE course_id = ? ORDER BY name',
      [courseId]
    ) as any[];

    const unitsDetail = await Promise.all(units.map(async (unit: any) => {
      const assignments = await db.all(`
        SELECT a.id as assignment_id, a.total_hours as assigned_hours, a.teacher_id,
               t.name as teacher_name
        FROM assignments a
        JOIN teachers t ON a.teacher_id = t.id
        WHERE a.unit_id = ?
        ORDER BY t.name
      `, [unit.id]) as any[];

      const teachersDetail = await Promise.all(assignments.map(async (a: any) => {
        const lessons = await db.all(`
          SELECT l.id, l.date, l.start_time, l.end_time, l.hours, l.location_type, l.notes
          FROM lessons l
          WHERE l.assignment_id = ?
          ORDER BY l.date, l.start_time
        `, [a.assignment_id]) as any[];

        const scheduledHours = lessons.reduce((sum: number, l: any) => sum + (l.hours || 0), 0);

        return {
          teacher_id: a.teacher_id,
          teacher_name: a.teacher_name,
          assignment_id: a.assignment_id,
          assigned_hours: a.assigned_hours,
          scheduled_hours: scheduledHours,
          remaining_hours: a.assigned_hours - scheduledHours,
          lessons
        };
      }));

      return {
        unit_id: unit.id,
        unit_name: unit.name,
        contracted_hours: unit.contracted_hours || 0,
        teachers: teachersDetail
      };
    }));

    const totalContracted = (course.total_hours_aula || 0) + (course.total_hours_pw || 0);
    const totalScheduled = (course.used_hours_aula || 0) + (course.used_hours_pw || 0);

    res.json({
      course_id: course.id,
      course_code: course.code,
      course_name: course.name,
      total_hours_aula: course.total_hours_aula || 0,
      total_hours_pw: course.total_hours_pw || 0,
      total_contracted: totalContracted,
      total_scheduled: totalScheduled,
      total_remaining: totalContracted - totalScheduled,
      units: unitsDetail
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/detail/teacher/:id?period_id= — Full teacher detail with courses/UFs/lessons
router.get('/teacher/:id', async (req: Request, res: Response) => {
  try {
    const teacherId = parseInt(req.params.id as string);
    const { period_id } = req.query;

    const teacher = await db.get('SELECT * FROM teachers WHERE id = ?', [teacherId]) as any;
    if (!teacher) {
      res.status(404).json({ error: 'Docente non trovato' });
      return;
    }

    // Get all assignments for this teacher, optionally filtered by period
    let assignQuery = `
      SELECT a.id as assignment_id, a.total_hours as assigned_hours,
             u.id as unit_id, u.name as unit_name, u.contracted_hours,
             c.id as course_id, c.code as course_code, c.name as course_name
      FROM assignments a
      JOIN units u ON a.unit_id = u.id
      JOIN courses c ON u.course_id = c.id
      WHERE a.teacher_id = ?
    `;
    const params: any[] = [teacherId];

    if (period_id) {
      assignQuery += ' AND c.period_id = ?';
      params.push(parseInt(period_id as string));
    }

    assignQuery += ' ORDER BY c.code, u.name';

    const assignments = await db.all(assignQuery, params) as any[];

    // Group by course
    const courseMap: Record<number, any> = {};

    for (const a of assignments) {
      if (!courseMap[a.course_id]) {
        courseMap[a.course_id] = {
          course_id: a.course_id,
          course_code: a.course_code,
          course_name: a.course_name,
          units: []
        };
      }

      const lessons = await db.all(`
        SELECT l.id, l.date, l.start_time, l.end_time, l.hours, l.location_type, l.notes
        FROM lessons l
        WHERE l.assignment_id = ?
        ORDER BY l.date, l.start_time
      `, [a.assignment_id]) as any[];

      const scheduledHours = lessons.reduce((sum: number, l: any) => sum + (l.hours || 0), 0);

      courseMap[a.course_id].units.push({
        unit_id: a.unit_id,
        unit_name: a.unit_name,
        contracted_hours: a.contracted_hours || 0,
        assignment_id: a.assignment_id,
        assigned_hours: a.assigned_hours,
        scheduled_hours: scheduledHours,
        remaining_hours: a.assigned_hours - scheduledHours,
        lessons
      });
    }

    const coursesArr = Object.values(courseMap);
    const totalAssigned = assignments.reduce((s: number, a: any) => s + (a.assigned_hours || 0), 0);

    // Calculate total scheduled for the teacher
    let totalScheduled = 0;
    for (const c of coursesArr) {
      for (const u of (c as any).units) {
        totalScheduled += u.scheduled_hours;
      }
    }

    res.json({
      teacher_id: teacher.id,
      teacher_name: teacher.name,
      organization: teacher.organization,
      total_assigned_hours: totalAssigned,
      total_scheduled_hours: totalScheduled,
      total_remaining_hours: totalAssigned - totalScheduled,
      courses: coursesArr
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
