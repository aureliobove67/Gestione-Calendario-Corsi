import db from '../db/connection';

export interface HoursStatus {
  totalHours: number;
  usedHours: number;
  remainingHours: number;
}

export interface HoursValidation {
  valid: boolean;
  warning: boolean;
  message?: string;
  totalHours: number;
  usedHours: number;
  remainingHours: number;
}

export async function getAssignmentHoursStatus(assignmentId: number): Promise<HoursStatus> {
  const assignment = await db.get('SELECT total_hours FROM assignments WHERE id = ?', [assignmentId]) as any;
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }

  const result = await db.get(
    'SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE assignment_id = ?',
    [assignmentId]
  ) as any;

  return {
    totalHours: assignment.total_hours,
    usedHours: result?.used || 0,
    remainingHours: assignment.total_hours - (result?.used || 0)
  };
}

export async function validateNewLessonHours(
  assignmentId: number,
  newHours: number,
  excludeLessonId?: number
): Promise<HoursValidation> {
  const assignment = await db.get('SELECT total_hours FROM assignments WHERE id = ?', [assignmentId]) as any;
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }

  let query = 'SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE assignment_id = ?';
  const params: any[] = [assignmentId];

  if (excludeLessonId) {
    query += ' AND id != ?';
    params.push(excludeLessonId);
  }

  const result = await db.get(query, params) as any;
  const usedHours = result?.used || 0;
  const totalHours = assignment.total_hours;
  const remainingHours = totalHours - usedHours;

  if (usedHours + newHours > totalHours) {
    return {
      valid: false,
      warning: true,
      message: `Adding ${newHours}h would exceed the assigned ${totalHours}h (currently used: ${usedHours}h, remaining: ${remainingHours}h)`,
      totalHours,
      usedHours,
      remainingHours
    };
  }

  return {
    valid: true,
    warning: false,
    totalHours,
    usedHours,
    remainingHours
  };
}
