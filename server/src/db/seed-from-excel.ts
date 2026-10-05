import path from 'path';
import db from './connection';
import { parseExcelFile } from '../utils/excel-parser';
import { auditLog } from '../middleware/audit';

const EXCEL_PATH = path.join(__dirname, '..', '..', '..', 'Calendario 1° anno 25225.xlsx');

async function seed() {
  console.log('🚀 Starting Excel import...');
  console.log(`📁 Excel file: ${EXCEL_PATH}`);

  // Parse Excel
  const modules = parseExcelFile(EXCEL_PATH);

  if (modules.length === 0) {
    console.log('❌ No modules found in Excel file');
    process.exit(1);
  }

  // Get or create admin user for audit
  const adminUser = await db.get('SELECT id FROM users WHERE username = ?', ['admin']) as any;
  const adminId = adminUser?.id || 1;

  // Create academic period
  const existingPeriod = await db.get("SELECT id FROM academic_periods WHERE name = ?", ['1° Anno 25225']) as any;
  let periodId: number;

  if (existingPeriod) {
    periodId = existingPeriod.id;
    console.log(`📅 Using existing period: ${periodId}`);
  } else {
    const periodResult = await db.run(
      `INSERT INTO academic_periods (name, description, start_date, end_date, is_active, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      ['1° Anno 25225', 'Primo anno corso 25225', '2025-01-01', '2025-12-31', adminId]
    );
    periodId = Number(periodResult.lastInsertRowid);
    console.log(`📅 Created period: ${periodId}`);
    await auditLog(adminId, 'academic_period', periodId, 'CREATE', null, { name: '1° Anno 25225' });
  }

  try {
    await db.transaction(async () => {
      // Track unique teachers
      const teacherMap = new Map<string, number>();

      for (const mod of modules) {
        // Create course
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
        await auditLog(adminId, 'course', courseId, 'CREATE', null, { code: mod.code, name: mod.name });
        console.log(`  ✅ Course: ${mod.code} - ${mod.name} (id: ${courseId})`);

        for (const unit of mod.units) {
          // Create unit
          const unitResult = await db.run(
            'INSERT INTO units (course_id, name, contracted_hours, created_by) VALUES (?, ?, ?, ?)',
            [courseId, unit.name, unit.contractedHours, adminId]
          );
          const unitId = Number(unitResult.lastInsertRowid);
          await auditLog(adminId, 'unit', unitId, 'CREATE', null, { name: unit.name, contracted_hours: unit.contractedHours });

          // Get or create teacher
          const teacherKey = unit.teacherName.toLowerCase().trim();
          let teacherId: number;

          if (teacherMap.has(teacherKey)) {
            teacherId = teacherMap.get(teacherKey)!;
          } else {
            const existingTeacher = await db.get(
              'SELECT id FROM teachers WHERE LOWER(name) = ? AND period_id = ?',
              [teacherKey, periodId]
            ) as any;

            if (existingTeacher) {
              teacherId = existingTeacher.id;
            } else {
              const teacherResult = await db.run(
                'INSERT INTO teachers (period_id, name, created_by) VALUES (?, ?, ?)',
                [periodId, unit.teacherName, adminId]
              );
              teacherId = Number(teacherResult.lastInsertRowid);
              await auditLog(adminId, 'teacher', teacherId, 'CREATE', null, { name: unit.teacherName });
              console.log(`  👤 Teacher: ${unit.teacherName} (id: ${teacherId})`);
            }
            teacherMap.set(teacherKey, teacherId);
          }

          // Create assignment
          const assignmentResult = await db.run(
            'INSERT INTO assignments (unit_id, teacher_id, total_hours, created_by) VALUES (?, ?, ?, ?)',
            [unitId, teacherId, unit.contractedHours, adminId]
          );
          const assignmentId = Number(assignmentResult.lastInsertRowid);
          await auditLog(adminId, 'assignment', assignmentId, 'CREATE', null, {
            unit_id: unitId, teacher_id: teacherId, total_hours: unit.contractedHours
          });
        }
      }
    });

    console.log('\n✅ Excel import completed successfully!');

    // Print summary
    const courseCount = (await db.get('SELECT COUNT(*) as c FROM courses WHERE period_id = ?', [periodId]) as any).c;
    const unitCount = (await db.get('SELECT COUNT(*) as c FROM units u JOIN courses c ON u.course_id = c.id WHERE c.period_id = ?', [periodId]) as any).c;
    const teacherCount = (await db.get('SELECT COUNT(*) as c FROM teachers WHERE period_id = ?', [periodId]) as any).c;
    const assignmentCount = (await db.get('SELECT COUNT(*) as c FROM assignments a JOIN units u ON a.unit_id = u.id JOIN courses c ON u.course_id = c.id WHERE c.period_id = ?', [periodId]) as any).c;

    console.log(`\n📊 Summary:`);
    console.log(`  Courses: ${courseCount}`);
    console.log(`  Units: ${unitCount}`);
    console.log(`  Teachers: ${teacherCount}`);
    console.log(`  Assignments: ${assignmentCount}`);
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  }
}

seed();
