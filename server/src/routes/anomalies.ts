import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

interface Anomaly {
  type: string;
  severity: 'critical' | 'warning';
  course_code: string;
  course_name: string;
  course_id: number;
  unit_name?: string;
  unit_id?: number;
  teacher_name?: string;
  teacher_id?: number;
  detail: string;
}

// GET /api/admin/anomalies?period_id=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;
    if (!period_id) {
      res.status(400).json({ error: 'period_id è obbligatorio' });
      return;
    }

    const anomalies: Anomaly[] = [];
    const periodId = parseInt(period_id as string);

    // 1. Get all courses for the period
    const courses = await db.all(`
      SELECT c.*,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'AULA'), 0) as used_hours_aula,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          JOIN assignments a ON l.assignment_id = a.id
          JOIN units u ON a.unit_id = u.id
          WHERE u.course_id = c.id AND l.location_type = 'PW'), 0) as used_hours_pw,
        COALESCE((SELECT SUM(l.hours) FROM lessons l
          WHERE l.course_id = c.id AND l.location_type = 'EXTRA'), 0) as used_hours_extra
      FROM courses c
      WHERE c.period_id = ?
      ORDER BY c.code
    `, [periodId]) as any[];

    for (const course of courses) {
      const isNonContractCourse = ((course.total_hours_aula || 0) + (course.total_hours_pw || 0)) === 0;

      // 2. Get units for this course
      const units = await db.all(`
        SELECT u.*,
          COALESCE((SELECT SUM(l.hours) FROM lessons l
            JOIN assignments a ON l.assignment_id = a.id
            WHERE a.unit_id = u.id), 0) as used_hours
        FROM units u
        WHERE u.course_id = ?
        ORDER BY u.name
      `, [course.id]) as any[];

      // Check: Corso senza UF
      if (units.length === 0) {
        anomalies.push({
          type: 'CORSO_SENZA_UF',
          severity: 'warning',
          course_code: course.code || '',
          course_name: course.name,
          course_id: course.id,
          detail: `Il corso "${course.code || ''} ${course.name}" non ha nessuna Unità Formativa.`
        });
        // Don't skip - still check Extra hours below
      }

      // Check: Somma ore UF vs ore contratto corso (Aula + PW)
      const totalContractHours = (course.total_hours_aula || 0) + (course.total_hours_pw || 0);
      const sumUfHours = units.reduce((sum: number, u: any) => sum + (u.contracted_hours || 0), 0);
      if (totalContractHours > 0 && sumUfHours !== totalContractHours) {
        anomalies.push({
          type: 'ORE_UF_MISMATCH',
          severity: 'warning',
          course_code: course.code || '',
          course_name: course.name,
          course_id: course.id,
          detail: `Ore contratto corso (Aula+PW): ${totalContractHours}h — Somma ore UF: ${sumUfHours}h. Differenza: ${Math.abs(totalContractHours - sumUfHours)}h.`
        });
      }

      // Check: Sforamento ore corso (calendarizzate > contratto)
      const totalScheduledCourse = (course.used_hours_aula || 0) + (course.used_hours_pw || 0);
      if (totalContractHours > 0 && totalScheduledCourse > totalContractHours) {
        anomalies.push({
          type: 'SFORAMENTO_ORE_CORSO',
          severity: 'critical',
          course_code: course.code || '',
          course_name: course.name,
          course_id: course.id,
          detail: `Ore calendarizzate: ${totalScheduledCourse}h superano le ore contratto: ${totalContractHours}h (+${totalScheduledCourse - totalContractHours}h).`
        });
      }

      // Check: Ore Extra non completamente calendarizzate
      const totalExtra = course.total_hours_extra || 0;
      const usedExtra = course.used_hours_extra || 0;
      if (totalExtra > 0 && usedExtra < totalExtra) {
        const remainingExtra = totalExtra - usedExtra;
        anomalies.push({
          type: 'ORE_EXTRA_NON_CALENDARIZZATE',
          severity: 'warning',
          course_code: course.code || '',
          course_name: course.name,
          course_id: course.id,
          detail: `Ore Extra: ${usedExtra}h calendarizzate su ${totalExtra}h previste (mancano ${remainingExtra}h da inserire nel calendario).`
        });
      }

      // Check: Sforamento Ore Extra (calendarizzate > previste)
      if (totalExtra > 0 && usedExtra > totalExtra) {
        anomalies.push({
          type: 'SFORAMENTO_ORE_EXTRA',
          severity: 'critical',
          course_code: course.code || '',
          course_name: course.name,
          course_id: course.id,
          detail: `Ore Extra calendarizzate: ${usedExtra}h superano le ore previste: ${totalExtra}h (+${usedExtra - totalExtra}h).`
        });
      }

      // Skip unit/assignment checks if no units
      if (units.length === 0) continue;

      for (const unit of units) {
        const unitNameUpper = (unit.name || '').toUpperCase();
        const isNonContractUnit = isNonContractCourse ||
                                 unitNameUpper.includes('FAD') ||
                                 unitNameUpper.includes('WEBINAR') ||
                                 unitNameUpper.includes('STAGE') ||
                                 unitNameUpper.includes('E-LEARNING') ||
                                 unitNameUpper.includes('E-LEARN');

        // 3. Get assignments for this unit
        const assignments = await db.all(`
          SELECT a.*, t.name as teacher_name
          FROM assignments a
          JOIN teachers t ON a.teacher_id = t.id
          WHERE a.unit_id = ?
        `, [unit.id]) as any[];

        // Check: UF senza docente
        if (assignments.length === 0) {
          anomalies.push({
            type: 'UF_SENZA_DOCENTE',
            severity: 'critical',
            course_code: course.code || '',
            course_name: course.name,
            course_id: course.id,
            unit_name: unit.name,
            unit_id: unit.id,
            detail: `L'UF "${unit.name}" non ha nessun docente assegnato (ore contrattualizzate: ${unit.contracted_hours || 0}h).`
          });
          continue;
        }

        // Check: Somma ore assegnate docenti vs ore contrattualizzate UF (only for contract units)
        const sumAssignedHours = assignments.reduce((sum: number, a: any) => sum + (a.total_hours || 0), 0);
        if (!isNonContractUnit && unit.contracted_hours > 0 && sumAssignedHours !== unit.contracted_hours) {
          const diff = unit.contracted_hours - sumAssignedHours;
          anomalies.push({
            type: diff > 0 ? 'ORE_DOCENTE_INFERIORI' : 'ORE_DOCENTE_SUPERIORI',
            severity: 'warning',
            course_code: course.code || '',
            course_name: course.name,
            course_id: course.id,
            unit_name: unit.name,
            unit_id: unit.id,
            detail: `UF "${unit.name}": ore contratto ${unit.contracted_hours}h, ore assegnate docenti: ${sumAssignedHours}h (${diff > 0 ? 'mancano ' + diff + 'h' : 'eccedenza ' + Math.abs(diff) + 'h'}).`
          });
        }

        // Check: Sforamento/Mancanza ore per singolo docente
        for (const assignment of assignments) {
          const usedResult = await db.get(
            'SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE assignment_id = ?',
            [assignment.id]
          ) as any;
          const usedHours = usedResult.used || 0;

          if (usedHours > assignment.total_hours) {
            anomalies.push({
              type: 'SFORAMENTO_ORE_DOCENTE',
              severity: 'critical',
              course_code: course.code || '',
              course_name: course.name,
              course_id: course.id,
              unit_name: unit.name,
              unit_id: unit.id,
              teacher_name: assignment.teacher_name,
              teacher_id: assignment.teacher_id,
              detail: `Docente "${assignment.teacher_name}" per UF "${unit.name}": calendarizzate ${usedHours}h su ${assignment.total_hours}h assegnate (+${usedHours - assignment.total_hours}h sforamento).`
            });
          } else if (!isNonContractUnit && usedHours < assignment.total_hours) {
            const diff = assignment.total_hours - usedHours;
            anomalies.push({
              type: 'MANCANZA_ORE_DOCENTE',
              severity: 'warning',
              course_code: course.code || '',
              course_name: course.name,
              course_id: course.id,
              unit_name: unit.name,
              unit_id: unit.id,
              teacher_name: assignment.teacher_name,
              teacher_id: assignment.teacher_id,
              detail: `Docente "${assignment.teacher_name}" per UF "${unit.name}": calendarizzate ${usedHours}h su ${assignment.total_hours}h assegnate (mancano ${diff}h).`
            });
          }
        }
      }
    }

    res.json({
      period_id: periodId,
      total: anomalies.length,
      critical: anomalies.filter(a => a.severity === 'critical').length,
      warnings: anomalies.filter(a => a.severity === 'warning').length,
      anomalies
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
