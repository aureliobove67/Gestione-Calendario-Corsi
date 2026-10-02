import { useMemo } from 'react';
import { Lesson } from '../../api/client';
import LessonCard from './LessonCard';
import { getItalianHoliday } from '../../utils/holidays';

interface MonthViewProps {
  lessons: Lesson[];
  year: number;
  month: number; // 0-indexed
  onDayClick?: (date: string) => void;
  onLessonClick?: (lesson: Lesson) => void;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function isToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

interface DayCell {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  dateStr: string;
}

export default function MonthView({ lessons, year, month, onDayClick, onLessonClick }: MonthViewProps) {
  // Group lessons by date
  const lessonMap = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    for (const lesson of lessons) {
      if (!map[lesson.date]) map[lesson.date] = [];
      map[lesson.date].push(lesson);
    }
    return map;
  }, [lessons]);

  // Build calendar grid
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: DayCell[] = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonth.getDate() - i;
      cells.push({
        day: d,
        month: month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
        dateStr: formatDate(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d),
      });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({
        day: d,
        month,
        year,
        isCurrentMonth: true,
        dateStr: formatDate(year, month, d),
      });
    }

    // Next month padding (fill to complete rows of 7)
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({
          day: d,
          month: month + 1,
          year: month === 11 ? year + 1 : year,
          isCurrentMonth: false,
          dateStr: formatDate(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, d),
        });
      }
    }

    return cells;
  }, [year, month]);

  return (
    <div className="calendar-month" id="calendar-month-view">
      {/* Header */}
      {DAY_NAMES.map((name, idx) => {
        let headerColor = 'var(--text-secondary)';
        if (idx === 5) headerColor = 'var(--accent-orange)';
        if (idx === 6) headerColor = 'var(--accent-red)';
        
        return (
          <div key={name} className="calendar-month-header-cell" style={{ color: headerColor }}>
            {name}
          </div>
        );
      })}

      {/* Days */}
      {days.map((cell, i) => {
        const dayLessons = lessonMap[cell.dateStr] || [];
        const today = cell.isCurrentMonth && isToday(cell.year, cell.month, cell.day);
        const cellDate = new Date(cell.year, cell.month, cell.day);
        const holiday = getItalianHoliday(cellDate);
        const isSunday = cellDate.getDay() === 0;
        const isSaturday = cellDate.getDay() === 6;
        const isHoliday = holiday.isHoliday;
        const isBlocked = isSunday || isSaturday || isHoliday;

        let numColor = 'var(--text-primary)';
        let cellBg = '';

        if (isSunday || isHoliday) {
          numColor = 'var(--accent-red)';
          if (cell.isCurrentMonth) {
            cellBg = 'rgba(248, 113, 113, 0.06)';
          }
        } else if (isSaturday) {
          numColor = 'var(--accent-orange)';
          if (cell.isCurrentMonth) {
            cellBg = 'rgba(251, 146, 60, 0.06)';
          }
        }

        if (!cell.isCurrentMonth) {
          numColor = 'var(--text-tertiary)';
        }

        const blockedReason = isHoliday
          ? `🚫 ${holiday.name} — Bloccato`
          : isSunday
            ? '🚫 Domenica — Bloccato'
            : isSaturday
              ? '🚫 Sabato — Bloccato'
              : '';

        return (
          <div
            key={i}
            className={`calendar-month-day${!cell.isCurrentMonth ? ' outside' : ''}${today ? ' today' : ''}${isBlocked && cell.isCurrentMonth ? ' blocked' : ''}`}
            onClick={isBlocked ? undefined : () => onDayClick?.(cell.dateStr)}
            style={{
              ...(cellBg ? { background: cellBg } : {}),
              ...(isBlocked ? { cursor: 'not-allowed' } : {}),
            }}
            title={isHoliday ? holiday.name : ''}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
              <div className="day-number" style={{ color: numColor }}>
                {cell.day} {isBlocked && cell.isCurrentMonth ? '🔒' : ''}
              </div>
              {isHoliday && cell.isCurrentMonth && (
                <div style={{ fontSize: '7.5px', color: 'var(--accent-red)', fontWeight: 'bold', padding: '1px 4px', background: 'var(--accent-red-dim)', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                  🎉 {holiday.name}
                </div>
              )}
            </div>
            {/* Blocked tooltip on hover */}
            {isBlocked && cell.isCurrentMonth && (
              <div className="blocked-tooltip">{blockedReason}</div>
            )}
            {dayLessons.slice(0, 3).map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onClick={onLessonClick}
                compact
              />
            ))}
            {dayLessons.length > 3 && (
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  padding: '2px 6px',
                }}
              >
                +{dayLessons.length - 3} altre
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
