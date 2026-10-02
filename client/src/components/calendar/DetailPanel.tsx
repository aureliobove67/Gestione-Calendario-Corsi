import { useState, useEffect } from 'react';
import { publicApi, CourseDetail, TeacherDetail } from '../../api/client';

interface DetailPanelProps {
  courseId?: number;
  teacherId?: number;
  periodId?: number;
}

function formatDateIT(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function LocationBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    AULA: 'var(--accent-blue)',
    PW: 'var(--accent-orange)',
    WEBINAR: 'var(--accent-purple)',
    FAD: 'var(--accent-teal)',
    STAGE: 'var(--accent-green)',
  };
  return (
    <span style={{
      fontSize: '9px',
      padding: '1px 5px',
      borderRadius: '4px',
      fontWeight: 600,
      background: `${colorMap[type] || 'var(--text-tertiary)'}20`,
      color: colorMap[type] || 'var(--text-tertiary)',
    }}>
      {type}
    </span>
  );
}

export default function DetailPanel({ courseId, teacherId, periodId }: DetailPanelProps) {
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (courseId) {
      setLoading(true);
      setTeacherDetail(null);
      setError('');
      publicApi.getCourseDetail(courseId)
        .then(setCourseDetail)
        .catch((err) => setError(err.message || 'Errore'))
        .finally(() => setLoading(false));
    } else {
      setCourseDetail(null);
    }
  }, [courseId]);

  useEffect(() => {
    if (teacherId) {
      setLoading(true);
      setCourseDetail(null);
      setError('');
      publicApi.getTeacherDetail(teacherId, periodId)
        .then(setTeacherDetail)
        .catch((err) => setError(err.message || 'Errore'))
        .finally(() => setLoading(false));
    } else {
      setTeacherDetail(null);
    }
  }, [teacherId, periodId]);

  if (!courseId && !teacherId) return null;

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)', textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-md)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Caricamento dettagli...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
        <div className="alert alert-error">⚠️ {error}</div>
      </div>
    );
  }

  // ---- COURSE DETAIL VIEW ----
  if (courseDetail) {
    return (
      <div className="glass-card detail-panel" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
        {/* Course Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-lg)',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
        }}>
          <div>
            <h3 style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📚 [{courseDetail.course_code}] {courseDetail.course_name}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
              Vista dettagliata per corso
            </p>
          </div>
          <div style={{
            display: 'flex',
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
          }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{courseDetail.total_contracted}h</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Contratto</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{courseDetail.total_scheduled}h</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Programmate</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: `1px solid ${courseDetail.total_remaining < 0 ? 'var(--border-error)' : 'var(--border-subtle)'}` }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: courseDetail.total_remaining < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{courseDetail.total_remaining}h</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Residuo</div>
            </div>
          </div>
        </div>

        {/* Badges for Aula/PW */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <span className="badge badge-blue" style={{ padding: '3px 10px', fontSize: '11px' }}>Aula: {courseDetail.total_hours_aula}h</span>
          <span className="badge badge-orange" style={{ padding: '3px 10px', fontSize: '11px' }}>PW: {courseDetail.total_hours_pw}h</span>
        </div>

        {/* Units */}
        {courseDetail.units.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-lg)' }}>
            Nessuna Unità Formativa per questo corso.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {courseDetail.units.map((unit) => (
              <div key={unit.unit_id} style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--bg-glass)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--accent-purple)' }}>
                    📘 UF: {unit.unit_name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Contratto: <strong>{unit.contracted_hours}h</strong>
                  </span>
                </div>

                {unit.teachers.length === 0 ? (
                  <div style={{ padding: 'var(--space-md)', color: 'var(--accent-red)', fontSize: 'var(--font-size-sm)' }}>
                    ⚠️ Nessun docente assegnato
                  </div>
                ) : (
                  unit.teachers.map((teacher) => (
                    <div key={teacher.teacher_id} style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-xs)',
                        flexWrap: 'wrap',
                        gap: '4px',
                      }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                          👨‍🏫 {teacher.teacher_name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Assegnate: <strong>{teacher.assigned_hours}h</strong> | 
                          Programmate: <strong style={{ color: 'var(--accent-yellow)' }}>{teacher.scheduled_hours}h</strong> | 
                          Residuo: <strong style={{ color: teacher.remaining_hours < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{teacher.remaining_hours}h</strong>
                        </span>
                      </div>

                      {teacher.lessons.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingLeft: 'var(--space-md)' }}>
                          Nessuna lezione programmata
                        </div>
                      ) : (
                        <div style={{ paddingLeft: 'var(--space-md)' }}>
                          {teacher.lessons.map((lesson) => (
                            <div key={lesson.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              padding: '2px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                            }}>
                              <span>📅</span>
                              <span style={{ fontWeight: 500, color: 'var(--text-primary)', minWidth: '80px' }}>
                                {formatDateIT(lesson.date)}
                              </span>
                              <span style={{ color: 'var(--accent-blue)', minWidth: '90px' }}>
                                {lesson.start_time} - {lesson.end_time}
                              </span>
                              <span>({lesson.hours}h)</span>
                              <LocationBadge type={lesson.location_type} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- TEACHER DETAIL VIEW ----
  if (teacherDetail) {
    return (
      <div className="glass-card detail-panel" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
        {/* Teacher Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-lg)',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
        }}>
          <div>
            <h3 style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              👨‍🏫 {teacherDetail.teacher_name}
            </h3>
            {teacherDetail.organization && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                {teacherDetail.organization}
              </p>
            )}
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
              Vista dettagliata per docente
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{teacherDetail.total_assigned_hours}h</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Assegnate</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{teacherDetail.total_scheduled_hours}h</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Programmate</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: `1px solid ${teacherDetail.total_remaining_hours < 0 ? 'var(--border-error)' : 'var(--border-subtle)'}` }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: teacherDetail.total_remaining_hours < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{teacherDetail.total_remaining_hours}h</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Residuo</div>
            </div>
          </div>
        </div>

        {/* Courses */}
        {teacherDetail.courses.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-lg)' }}>
            Nessun corso assegnato a questo docente nel periodo selezionato.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {teacherDetail.courses.map((course) => (
              <div key={course.course_id} style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--bg-glass)',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--accent-blue)',
                }}>
                  📚 [{course.course_code}] {course.course_name}
                </div>

                {course.units.map((unit) => (
                  <div key={unit.unit_id} style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--space-xs)',
                      flexWrap: 'wrap',
                      gap: '4px',
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--accent-purple)' }}>
                        📘 UF: {unit.unit_name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Assegnate: <strong>{unit.assigned_hours}h</strong> | 
                        Programmate: <strong style={{ color: 'var(--accent-yellow)' }}>{unit.scheduled_hours}h</strong> | 
                        Residuo: <strong style={{ color: unit.remaining_hours < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{unit.remaining_hours}h</strong>
                      </span>
                    </div>

                    {unit.lessons.length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingLeft: 'var(--space-md)' }}>
                        Nessuna lezione programmata
                      </div>
                    ) : (
                      <div style={{ paddingLeft: 'var(--space-md)' }}>
                        {unit.lessons.map((lesson) => (
                          <div key={lesson.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            padding: '2px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                          }}>
                            <span>📅</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)', minWidth: '80px' }}>
                              {formatDateIT(lesson.date)}
                            </span>
                            <span style={{ color: 'var(--accent-blue)', minWidth: '90px' }}>
                              {lesson.start_time} - {lesson.end_time}
                            </span>
                            <span>({lesson.hours}h)</span>
                            <LocationBadge type={lesson.location_type} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
