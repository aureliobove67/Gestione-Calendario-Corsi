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

export function getAssignmentHoursStatus(assignmentId: number): HoursStatus {
  const assignment = db.prepare('SELECT total_hours FROM assignments WHERE id = ?').get(assignmentId) as any;
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }

  const result = db.prepare(
    'SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE assignment_id = ?'
  ).get(assignmentId) as any;

  return {
    totalHours: assignment.total_hours,
    usedHours: result.used,
    remainingHours: assignment.total_hours - result.used
  };
}

export function validateNewLessonHours(
  assignmentId: number,
  newHours: number,
  excludeLessonId?: number
): HoursValidation {
  const assignment = db.prepare('SELECT total_hours FROM assignments WHERE id = ?').get(assignmentId) as any;
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }

  let query = 'SELECT COALESCE(SUM(hours), 0) as used FROM lessons WHERE assignment_id = ?';
  const params: any[] = [assignmentId];

  if (excludeLessonId) {
    query += ' AND id != ?';
    params.push(excludeLessonId);
  }

  const result = db.prepare(query).get(...params) as any;
  const usedHours = result.used;
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
