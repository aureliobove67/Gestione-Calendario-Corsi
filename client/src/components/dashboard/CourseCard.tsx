import { Course } from '../../api/client';
import HoursProgressBar from './HoursProgressBar';

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course }: CourseCardProps) {
  return (
    <div className="glass-card course-card" id={`course-card-${course.id}`}>
      <div className="course-card-header">
        <div>
          <div className="course-card-code">{course.code}</div>
          <div className="course-card-name">{course.name}</div>
        </div>
        <span className="badge badge-blue">
          {course.units?.length || 0} UF
        </span>
      </div>

      {course.units && course.units.length > 0 && (
        <div className="course-card-units">
          {course.units.map((unit) => {
            const used = unit.used_hours || 0;
            const total = unit.contracted_hours || 0;
            return (
              <div key={unit.id} className="unit-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="unit-row-name">{unit.name}</div>
                  {unit.teacher_name && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                      👨‍🏫 {unit.teacher_name}
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <HoursProgressBar used={used} total={total} />
                  </div>
                </div>
                <div className="unit-row-hours">
                  {used}/{total}h
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
