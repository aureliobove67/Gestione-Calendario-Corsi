import { Lesson } from '../../api/client';

interface LessonCardProps {
  lesson: Lesson;
  onClick?: (lesson: Lesson) => void;
  compact?: boolean;
}

const locationTypeClass: Record<string, string> = {
  AULA: 'lesson-aula',
  WEBINAR: 'lesson-webinar',
  FAD: 'lesson-fad',
  PW: 'lesson-pw',
  STAGE: 'lesson-stage',
  EXTRA: 'lesson-extra',
};

export default function LessonCard({ lesson, onClick, compact }: LessonCardProps) {
  const cssClass = locationTypeClass[lesson.location_type] || 'lesson-aula';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent TimeSlot click from firing
    onClick?.(lesson);
  };

  if (compact) {
    return (
      <div
        className={`calendar-month-lesson ${cssClass}`}
        onClick={handleClick}
        title={lesson.location_type === 'EXTRA' 
          ? `${lesson.course_code} - Ore Extra\n${lesson.start_time}-${lesson.end_time}\n${lesson.notes || ''}` 
          : `${lesson.course_code} - ${lesson.unit_name}\n${lesson.start_time}-${lesson.end_time}\n${lesson.teacher_name}`}
        id={`lesson-compact-${lesson.id}`}
      >
        {lesson.course_code} {lesson.start_time?.slice(0, 5)}
      </div>
    );
  }

  // Calculate height based on duration
  const startHour = parseInt(lesson.start_time?.split(':')[0] || '9');
  const startMin = parseInt(lesson.start_time?.split(':')[1] || '0');
  const endHour = parseInt(lesson.end_time?.split(':')[0] || '10');
  const endMin = parseInt(lesson.end_time?.split(':')[1] || '0');
  const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const height = Math.max(durationMinutes - 4, 20); // 1px per minute, minimum 20px
  const topOffset = startMin; // offset within the hour slot

  return (
    <div
      className={`lesson-card ${cssClass}`}
      style={{
        height: `${height}px`,
        top: `${topOffset + 2}px`,
        cursor: 'pointer',
      }}
      onClick={handleClick}
      id={`lesson-card-${lesson.id}`}
    >
      <div className="lesson-card-title">
        {lesson.course_code} - {lesson.location_type === 'EXTRA' ? 'Ore Extra' : lesson.unit_name}
      </div>
      {durationMinutes > 40 && (
        <>
          <div className="lesson-card-time">
            {lesson.start_time?.slice(0, 5)} - {lesson.end_time?.slice(0, 5)}
          </div>
          <div className="lesson-card-teacher">
            {lesson.location_type === 'EXTRA' 
              ? (lesson.notes ? `📝 ${lesson.notes.substring(0, 40)}${lesson.notes.length > 40 ? '...' : ''}` : 'Ore Extra')
              : lesson.teacher_name}
          </div>
        </>
      )}
    </div>
  );
}
