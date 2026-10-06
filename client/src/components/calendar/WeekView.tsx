import { useMemo } from 'react';
import { Lesson } from '../../api/client';
import TimeSlot from './TimeSlot';
import LessonCard from './LessonCard';
import { getItalianHoliday } from '../../utils/holidays';

interface WeekViewProps {
  lessons: Lesson[];
  weekStart: Date;
  onSlotClick?: (date: string, hour: number) => void;
  onLessonClick?: (lesson: Lesson) => void;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00 to 17:00
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function getBlockedInfo(date: Date): { blocked: boolean; reason: string } {
  const dow = date.getDay();
  const holiday = getItalianHoliday(date);
  if (holiday.isHoliday) return { blocked: true, reason: `🚫 ${holiday.name} — Inserimento bloccato` };
  if (dow === 0) return { blocked: true, reason: '🚫 Domenica — Inserimento bloccato' };
  if (dow === 6) return { blocked: true, reason: '🚫 Sabato — Inserimento bloccato' };
  return { blocked: false, reason: '' };
}

export default function WeekView({ lessons, weekStart, onSlotClick, onLessonClick }: WeekViewProps) {
  const dayDates = useMemo(() => getDayDates(weekStart), [weekStart]);

  // Group lessons by date and hour
  const lessonMap = useMemo(() => {
    const map: Record<string, Record<number, Lesson[]>> = {};
    for (const lesson of lessons) {
      const date = lesson.date;
      const startHour = parseInt(lesson.start_time?.split(':')[0] || '9');
      if (!map[date]) map[date] = {};
      if (!map[date][startHour]) map[date][startHour] = [];
      map[date][startHour].push(lesson);
    }
    return map;
  }, [lessons]);

  return (
    <div className="calendar-week-wrapper">
      <div className="mobile-scroll-hint week-scroll-hint">
        👉 Scorri con il dito per visualizzare tutti i giorni
      </div>
      <div className="calendar-week-scroll-container">
        <div className="calendar-week" id="calendar-week-view">
          {/* Header row */}
          <div className="calendar-week-header-cell" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="day-name" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Ora</span>
          </div>
          {dayDates.map((date, i) => {
            const holiday = getItalianHoliday(date);
            const isSunday = date.getDay() === 0;
            const isSaturday = date.getDay() === 6;
            const isHoliday = holiday.isHoliday;
            const isBlocked = isSunday || isSaturday || isHoliday;

            let labelColor = 'var(--text-secondary)';
            let numColor = 'var(--text-primary)';

            if (isSunday || isHoliday) {
              labelColor = 'var(--accent-red)';
              numColor = 'var(--accent-red)';
            } else if (isSaturday) {
              labelColor = 'var(--accent-orange)';
              numColor = 'var(--accent-orange)';
            }

            return (
              <div
                key={i}
                className={`calendar-week-header-cell${isToday(date) ? ' today' : ''}${isBlocked ? ' blocked' : ''}`}
                title={isHoliday ? holiday.name : isBlocked ? (isSaturday ? 'Sabato — Bloccato' : 'Domenica — Bloccato') : ''}
              >
                <div className="day-name" style={{ color: labelColor }}>
                  {DAY_NAMES[i]} {isHoliday ? '🎉' : isBlocked ? '🔒' : ''}
                </div>
                <div className="day-number" style={{ color: numColor }}>
                  {date.getDate()}
                </div>
                {isHoliday && (
                  <div style={{ fontSize: '9px', color: 'var(--accent-red)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70px', margin: '0 auto' }}>
                    {holiday.name}
                  </div>
                )}
              </div>
            );
          })}

          {/* Time rows */}
          {HOURS.map((hour) => (
            <div key={hour} style={{ display: 'contents' }}>
              <div className="calendar-time-label">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {dayDates.map((date, dayIndex) => {
                const dateStr = formatDate(date);
                const slotLessons = lessonMap[dateStr]?.[hour] || [];
                const { blocked, reason } = getBlockedInfo(date);

                let style: React.CSSProperties = {};
                if (blocked) {
                  style = {
                    background: date.getDay() === 6
                      ? 'rgba(251, 146, 60, 0.06)'
                      : 'rgba(248, 113, 113, 0.06)',
                    cursor: 'not-allowed',
                  };
                }

                return (
                  <TimeSlot
                    key={`${dayIndex}-${hour}`}
                    hour={hour}
                    dayIndex={dayIndex}
                    onClick={blocked ? undefined : () => onSlotClick?.(dateStr, hour)}
                    style={style}
                    className={blocked ? 'blocked' : ''}
                  >
                    {blocked && (
                      <div className="blocked-tooltip">{reason}</div>
                    )}
                    {slotLessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onClick={onLessonClick}
                      />
                    ))}
                  </TimeSlot>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
