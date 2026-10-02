import { Router, Request, Response } from 'express';
import path from 'path';
import { parseExcelFile } from '../utils/excel-parser';
import db from '../db/connection';
import { auditLog } from '../middleware/audit';

const router = Router();

// POST /api/admin/import-excel
router.post('/', (req: Request, res: Response) => {
  try {
    const excelPath = path.join(__dirname, '..', '..', '..', 'Calendario 1° anno 25225.xlsx');
    const adminId = req.user!.id;

    console.log(`📁 Importing from: ${excelPath}`);

    const modules = parseExcelFile(excelPath);

    if (modules.length === 0) {
      res.status(400).json({ error: 'No modules found in Excel file' });
      return;
    }

    // Create or get period
    let period = db.prepare("SELECT id FROM academic_periods WHERE name = ?").get('1° Anno 25225') as any;
    let periodId: number;

    if (period) {
      periodId = period.id;
    } else {
      const result = db.prepare(
        `INSERT INTO academic_periods (name, description, start_date, end_date, is_active, created_by)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).run('1° Anno 25225', 'Primo anno corso 25225 - importato da Excel', '2025-01-01', '2025-12-31', adminId);
      periodId = Number(result.lastInsertRowid);
      auditLog(adminId, 'academic_period', periodId, 'CREATE', null, { name: '1° Anno 25225' });
    }

    const teacherMap = new Map<string, number>();
    const importResults: any[] = [];

    const importTransaction = (db as any).transaction(() => {
      for (const mod of modules) {
        const courseResult = db.prepare(
          `INSERT INTO courses (period_id, code, name, total_hours_aula, total_hours_webinar, total_hours_fad, total_hours_pw, total_hours_stage, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          periodId, mod.code, mod.name,
          mod.totalHoursAula, mod.totalHoursWebinar, mod.totalHoursFad,
          mod.totalHoursPw, mod.totalHoursStage, adminId
        );
        const courseId = Number(courseResult.lastInsertRowid);
        auditLog(adminId, 'course', courseId, 'CREATE', null, { code: mod.code, name: mod.name, source: 'excel-import' });

        const unitsImported: any[] = [];

        for (const unit of mod.units) {
          const unitResult = db.prepare(
            'INSERT INTO units (course_id, name, contracted_hours, created_by) VALUES (?, ?, ?, ?)'
          ).run(courseId, unit.name, unit.contractedHours, adminId);
          const unitId = Number(unitResult.lastInsertRowid);

          const teacherKey = unit.teacherName.toLowerCase().trim();
          let teacherId: number;

          if (teacherMap.has(teacherKey)) {
            teacherId = teacherMap.get(teacherKey)!;
          } else {
            const existing = db.prepare(
              'SELECT id FROM teachers WHERE LOWER(name) = ? AND period_id = ?'
            ).get(teacherKey, periodId) as any;

            if (existing) {
              teacherId = existing.id;
            } else {
              const teacherResult = db.prepare(
                'INSERT INTO teachers (period_id, name, created_by) VALUES (?, ?, ?)'
              ).run(periodId, unit.teacherName, adminId);
              teacherId = Number(teacherResult.lastInsertRowid);
            }
            teacherMap.set(teacherKey, teacherId);
          }

          const assignmentResult = db.prepare(
            'INSERT INTO assignments (unit_id, teacher_id, total_hours, created_by) VALUES (?, ?, ?, ?)'
          ).run(unitId, teacherId, unit.contractedHours, adminId);

          unitsImported.push({
            name: unit.name,
            teacher: unit.teacherName,
            hours: unit.contractedHours
          });
        }

        importResults.push({
          code: mod.code,
          name: mod.name,
          units: unitsImported
        });
      }
    });

    importTransaction();

    res.json({
      message: 'Excel import completed successfully',
      periodId,
      modulesImported: importResults.length,
      details: importResults
    });
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
});

export default router;
