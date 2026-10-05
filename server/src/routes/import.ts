import { Router, Request, Response } from 'express';
import path from 'path';
import { parseExcelFile } from '../utils/excel-parser';
import db from '../db/connection';
import { auditLog } from '../middleware/audit';

const router = Router();

// POST /api/admin/import-excel
router.post('/', async (req: Request, res: Response) => {
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
    let period = await db.get("SELECT id FROM academic_periods WHERE name = ?", ['1° Anno 25225']) as any;
    let periodId: number;

    if (period) {
      periodId = period.id;
    } else {
      const result = await db.run(
        `INSERT INTO academic_periods (name, description, start_date, end_date, is_active, created_by)
         VALUES (?, ?, ?, ?, 1, ?)`,
        ['1° Anno 25225', 'Primo anno corso 25225 - importato da Excel', '2025-01-01', '2025-12-31', adminId]
      );
      periodId = Number(result.lastInsertRowid);
      await auditLog(adminId, 'academic_period', periodId, 'CREATE', null, { name: '1° Anno 25225' });
    }

    const teacherMap = new Map<string, number>();
    const importResults: any[] = [];

    await db.transaction(async () => {
      for (const mod of modules) {
        const courseResult = await db.run(
          `INSERT INTO courses (period_id, code, name, total_hours_aula, total_hours_webinar, total_hours_fad, total_hours_pw, total_hours_stage, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            periodId, mod.code, mod.name,
            mod.totalHoursAula, mod.totalHoursWebinar, mod.totalHoursFad,
            mod.totalHoursPw, mod.totalHoursStage, adminId
          ]
        );
        const courseId = Number(courseResult.lastInsertRowid);
        await auditLog(adminId, 'course', courseId, 'CREATE', null, { code: mod.code, name: mod.name, source: 'excel-import' });

        const unitsImported: any[] = [];

        for (const unit of mod.units) {
          const unitResult = await db.run(
            'INSERT INTO units (course_id, name, contracted_hours, created_by) VALUES (?, ?, ?, ?)',
            [courseId, unit.name, unit.contractedHours, adminId]
          );
          const unitId = Number(unitResult.lastInsertRowid);

          const teacherKey = unit.teacherName.toLowerCase().trim();
          let teacherId: number;

          if (teacherMap.has(teacherKey)) {
            teacherId = teacherMap.get(teacherKey)!;
          } else {
            const existing = await db.get(
              'SELECT id FROM teachers WHERE LOWER(name) = ? AND period_id = ?',
              [teacherKey, periodId]
            ) as any;

            if (existing) {
              teacherId = existing.id;
            } else {
              const teacherResult = await db.run(
                'INSERT INTO teachers (period_id, name, created_by) VALUES (?, ?, ?)',
                [periodId, unit.teacherName, adminId]
              );
              teacherId = Number(teacherResult.lastInsertRowid);
            }
            teacherMap.set(teacherKey, teacherId);
          }

          await db.run(
            'INSERT INTO assignments (unit_id, teacher_id, total_hours, created_by) VALUES (?, ?, ?, ?)',
            [unitId, teacherId, unit.contractedHours, adminId]
          );

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
