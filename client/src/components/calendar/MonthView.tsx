import { useState, useEffect, useMemo } from 'react';
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

const locationTypeColor: Record<string, string> = {
  AULA: 'var(--accent-blue)',
  PW: 'var(--accent-orange)',
  WEBINAR: 'var(--accent-purple)',
  FAD: 'var(--accent-teal)',
  STAGE: 'var(--accent-green)',
  EXTRA: '#ec4899',
};

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
  // Mobile view mode toggle: 'compact' (grid + agenda below) vs 'grid' (full wide table)
  const [mobileViewMode, setMobileViewMode] = useState<'compact' | 'grid'>('compact');

  // Currently selected date for mobile daily agenda
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month) {
      return formatDate(year, month, today.getDate());
    }
    const mStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    const firstLesson = lessons.find((l) => l.date.startsWith(mStr));
    return firstLesson ? firstLesson.date : formatDate(year, month, 1);
  });

  // Keep selectedDate valid when year or month changes
  useEffect(() => {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month) {
      setSelectedDate(formatDate(year, month, today.getDate()));
    } else {
      const mStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
      const firstLesson = lessons.find((l) => l.date.startsWith(mStr));
      setSelectedDate(firstLesson ? firstLesson.date : formatDate(year, month, 1));
    }
  }, [year, month]);

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

  // Lessons for the selected day in mobile view
  const selectedDayLessons = useMemo(() => {
    return lessonMap[selectedDate] || [];
  }, [lessonMap, selectedDate]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  const selectedDayTotalHours = useMemo(() => {
    return selectedDayLessons.reduce((sum, l) => sum + (l.hours || 0), 0);
  }, [selectedDayLessons]);

  const handleCellClick = (cell: DayCell, isBlocked: boolean) => {
    setSelectedDate(cell.dateStr);
    if (!isBlocked) {
      onDayClick?.(cell.dateStr);
    }
  };

  return (
    <div className="calendar-month-wrapper">
      {/* Mobile view toggle (visible on smartphones and small tablets) */}
      <div className="mobile-view-toolbar">
        <div className="mobile-view-toggle">
          <button
            type="button"
            className={`btn btn-xs ${mobileViewMode === 'compact' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMobileViewMode('compact')}
          >
            📱 Vista Mobile (Agenda)
          </button>
          <button
            type="button"
            className={`btn btn-xs ${mobileViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMobileViewMode('grid')}
          >
            🖥️ Griglia Intera
          </button>
        </div>
        {mobileViewMode === 'grid' && (
          <span className="mobile-scroll-hint">
            👉 Scorri orizzontalmente
          </span>
        )}
      </div>

      {/* Main Month Grid (scrollable container for grid mode or desktop) */}
      <div className={`calendar-month-scroll-container ${mobileViewMode === 'grid' ? 'force-scroll' : ''}`}>
        <div className={`calendar-month ${mobileViewMode === 'compact' ? 'mobile-compact' : ''}`} id="calendar-month-view">
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
            const isSelected = cell.dateStr === selectedDate;
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
                className={`calendar-month-day${!cell.isCurrentMonth ? ' outside' : ''}${today ? ' today' : ''}${isSelected ? ' selected-day' : ''}${isBlocked && cell.isCurrentMonth ? ' blocked' : ''}${dayLessons.length > 0 ? ' has-lessons' : ''}`}
                onClick={() => handleCellClick(cell, isBlocked)}
                style={{
                  ...(cellBg ? { background: cellBg } : {}),
                }}
                title={isHoliday ? holiday.name : ''}
              >
                {/* Header row in cell */}
                <div className="month-day-cell-header">
                  <div className="day-number" style={{ color: numColor }}>
                    {cell.day} {isBlocked && cell.isCurrentMonth ? '🔒' : ''}
                  </div>
                  {isHoliday && cell.isCurrentMonth && (
                    <div className="month-holiday-badge">
                      🎉 {holiday.name}
                    </div>
                  )}
                </div>

                {/* Blocked tooltip on hover */}
                {isBlocked && cell.isCurrentMonth && (
                  <div className="blocked-tooltip">{blockedReason}</div>
                )}

                {/* DESKTOP / WIDE VIEW: Full lesson pills */}
                <div className="desktop-lessons-container">
                  {dayLessons.slice(0, 3).map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={onLessonClick}
                      compact
                    />
                  ))}
                  {dayLessons.length > 3 && (
                    <div className="more-lessons-indicator">
                      +{dayLessons.length - 3} altre
                    </div>
                  )}
                </div>

                {/* MOBILE COMPACT VIEW: Lesson dots & badge */}
                {dayLessons.length > 0 && (
                  <div className="mobile-lesson-dots">
                    <div className="dots-row">
                      {dayLessons.slice(0, 4).map((l, dotIdx) => (
                        <span
                          key={dotIdx}
                          className="lesson-dot"
                          style={{ backgroundColor: locationTypeColor[l.location_type] || 'var(--accent-blue)' }}
                        />
                      ))}
                    </div>
                    <span className="mobile-lesson-count">
                      {dayLessons.length} {dayLessons.length === 1 ? 'lez.' : 'lez.'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE AGENDA SECTION (Visible below month calendar on mobile) */}
      <div className="mobile-agenda-section">
        <div className="mobile-agenda-header">
          <div className="mobile-agenda-title">
            <span className="calendar-icon">📅</span>
            <div>
              <h4 style={{ margin: 0, textTransform: 'capitalize' }}>{selectedDateFormatted}</h4>
              <span className="mobile-agenda-subtitle">
                {selectedDayLessons.length === 0
                  ? 'Nessuna lezione in programma'
                  : `${selectedDayLessons.length} ${selectedDayLessons.length === 1 ? 'lezione' : 'lezioni'} (${selectedDayTotalHours} ore totali)`}
              </span>
            </div>
          </div>
        </div>

        {selectedDayLessons.length === 0 ? (
          <div className="mobile-agenda-empty">
            <p>Non ci sono lezioni programmate per questo giorno.</p>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
              Tocca un giorno con il pallino per vederne le lezioni.
            </span>
          </div>
        ) : (
          <div className="mobile-agenda-list">
            {selectedDayLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="mobile-lesson-item glass-card"
                onClick={() => onLessonClick?.(lesson)}
              >
                <div className="mobile-lesson-time-column">
                  <span className="mobile-lesson-time">
                    {lesson.start_time?.slice(0, 5)}
                  </span>
                  <span className="mobile-lesson-time-end">
                    {lesson.end_time?.slice(0, 5)}
                  </span>
                  <span className="mobile-lesson-hours">
                    {lesson.hours}h
                  </span>
                </div>

                <div className="mobile-lesson-details">
                  <div className="mobile-lesson-course">
                    <span className="course-code-badge">{lesson.course_code}</span>
                    <span className="course-name-text">{lesson.course_name}</span>
                  </div>

                  <div className="mobile-lesson-unit">
                    {lesson.location_type === 'EXTRA' ? 'Ore Extra' : lesson.unit_name}
                  </div>

                  <div className="mobile-lesson-meta">
                    {lesson.teacher_name && (
                      <span className="mobile-lesson-teacher">
                        👤 {lesson.teacher_name}
                      </span>
                    )}
                    <span
                      className={`badge badge-${lesson.location_type?.toLowerCase() || 'aula'}`}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                    >
                      {lesson.location_type}
                    </span>
                  </div>

                  {lesson.notes && (
                    <div className="mobile-lesson-note">
                      📝 {lesson.notes}
                    </div>
                  )}
                </div>

                <div className="mobile-lesson-arrow">
                  ▶
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
