import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi, publicApi, Period, Course, Teacher, Lesson } from '../api/client';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import LessonModal from '../components/calendar/LessonModal';
import AnomalyPanel from '../components/calendar/AnomalyPanel';
import DetailPanel from '../components/calendar/DetailPanel';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function AdminCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // Date and View navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewType, setViewType] = useState<'week' | 'month'>('week');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState('');
  const [prefillHour, setPrefillHour] = useState<number | undefined>(undefined);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAnomalyOpen, setIsAnomalyOpen] = useState(false);
  // Handle sidebar Anomalie and new lesson navigation
  useEffect(() => {
    if (searchParams.get('anomalies') === 'true') {
      setIsAnomalyOpen(true);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('newLesson') === 'true') {
      setSelectedLesson(null);
      setPrefillDate('');
      setPrefillHour(undefined);
      setIsModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load periods
  useEffect(() => {
    adminApi.getPeriods()
      .then((data) => {
        const activeOnly = data.filter(p => p.is_active);
        setPeriods(activeOnly);
        
        // Retrieve persistent selection
        const savedPeriodId = localStorage.getItem('selectedPeriodId');
        if (savedPeriodId) {
          const parsed = Number(savedPeriodId);
          if (activeOnly.some(p => p.id === parsed)) {
            setSelectedPeriodId(parsed);
            return;
          }
        }
        
        const active = activeOnly.find(p => p.is_active);
        if (active) {
          setSelectedPeriodId(active.id);
          localStorage.setItem('selectedPeriodId', String(active.id));
        } else if (activeOnly.length > 0) {
          setSelectedPeriodId(activeOnly[0].id);
          localStorage.setItem('selectedPeriodId', String(activeOnly[0].id));
        }
      })
      .catch((err) => setError(err.message || 'Errore nel caricamento dei periodi'))
      .finally(() => setLoading(false));
  }, []);

  // Load courses, teachers when period changes
  useEffect(() => {
    if (!selectedPeriodId) return;
    setLoading(true);
    Promise.all([
      publicApi.getCourses(selectedPeriodId),
      publicApi.getTeachers(selectedPeriodId)
    ])
      .then(([coursesData, teachersData]) => {
        setCourses(coursesData);
        setTeachers(teachersData);
      })
      .catch((err) => setError(err.message || 'Errore nel caricamento dei filtri'))
      .finally(() => setLoading(false));
  }, [selectedPeriodId]);

  const selectedPeriod = useMemo(() => {
    return periods.find(p => p.id === selectedPeriodId);
  }, [periods, selectedPeriodId]);

  // Adjust currentDate if it falls outside the selected period's date range
  useEffect(() => {
    if (!selectedPeriod) return;
    const start = new Date(selectedPeriod.start_date);
    const end = new Date(selectedPeriod.end_date);
    const current = new Date(currentDate);

    const today = new Date();
    if (today >= start && today <= end) {
      if (current < start || current > end) {
        setCurrentDate(today);
      }
    } else {
      if (current < start || current > end) {
        setCurrentDate(start);
      }
    }
  }, [selectedPeriod, selectedPeriodId]);

  // Load lessons based on period, view and date
  const loadLessons = () => {
    if (!selectedPeriodId) return;
    setLoading(true);

    if (viewType === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      publicApi.getCalendarWeek(selectedPeriodId, weekStr)
        .then(setLessons)
        .catch((err) => setError(err.message || 'Errore nel caricamento del calendario'))
        .finally(() => setLoading(false));
    } else {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const monthStr = `${year}-${month}`;
      publicApi.getCalendarMonth(selectedPeriodId, monthStr)
        .then(setLessons)
        .catch((err) => setError(err.message || 'Errore nel caricamento del calendario'))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadLessons();
  }, [selectedPeriodId, viewType, currentDate]);

  // Apply filters
  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (selectedCourseId) {
        const course = courses.find(c => c.id.toString() === selectedCourseId);
        if (!course || (lesson.course_code !== course.code)) {
          return false;
        }
      }
      if (selectedTeacherId) {
        const teacher = teachers.find(t => t.id.toString() === selectedTeacherId);
        if (!teacher || lesson.teacher_name !== teacher.name) {
          return false;
        }
      }
      return true;
    });
  }, [lessons, selectedCourseId, selectedTeacherId, courses, teachers]);

  const isPrevDisabled = useMemo(() => {
    if (!selectedPeriod) return false;
    const startLimit = new Date(selectedPeriod.start_date);
    if (viewType === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      return getWeekStart(d) < getWeekStart(startLimit);
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      const firstOfD = new Date(d.getFullYear(), d.getMonth(), 1);
      const firstOfLimit = new Date(startLimit.getFullYear(), startLimit.getMonth(), 1);
      return firstOfD < firstOfLimit;
    }
  }, [currentDate, selectedPeriod, viewType]);

  const isNextDisabled = useMemo(() => {
    if (!selectedPeriod) return false;
    const endLimit = new Date(selectedPeriod.end_date);
    if (viewType === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      return getWeekStart(d) > getWeekStart(endLimit);
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      const firstOfD = new Date(d.getFullYear(), d.getMonth(), 1);
      const firstOfLimit = new Date(endLimit.getFullYear(), endLimit.getMonth(), 1);
      return firstOfD > firstOfLimit;
    }
  }, [currentDate, selectedPeriod, viewType]);

  const handlePrev = () => {
    if (isPrevDisabled) return;
    if (viewType === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (isNextDisabled) return;
    if (viewType === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    if (!selectedPeriod) return;
    const today = new Date();
    const start = new Date(selectedPeriod.start_date);
    const end = new Date(selectedPeriod.end_date);
    if (today >= start && today <= end) {
      setCurrentDate(today);
    } else {
      setCurrentDate(start);
    }
  };

  const getNavigationLabel = () => {
    if (viewType === 'week') {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `Settimana: ${start.getDate()} ${start.toLocaleString('it-IT', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('it-IT', { month: 'short' })} ${end.getFullYear()}`;
    } else {
      return currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
    }
  };

  // Grid click (Create lesson)
  const handleSlotClick = (dateStr: string, hour: number) => {
    setPrefillDate(dateStr);
    setPrefillHour(hour);
    setSelectedLesson(null);
    setIsModalOpen(true);
  };

  // Lesson card click (View details or Edit)
  const handleLessonClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setIsDetailOpen(true);
  };

  const handleOpenEdit = () => {
    setIsDetailOpen(false);
    setPrefillDate('');
    setPrefillHour(undefined);
    setIsModalOpen(true);
  };

  const handleDeleteLesson = async () => {
    if (!selectedLesson) return;
    if (!window.confirm('Sei sicuro di voler eliminare questa lezione? Questa azione non è reversibile.')) return;

    try {
      setLoading(true);
      await adminApi.deleteLesson(selectedLesson.id);
      setIsDetailOpen(false);
      setSelectedLesson(null);
      loadLessons();
    } catch (err: any) {
      setError(err.message || 'Errore nella cancellazione della lezione');
      setLoading(false);
    }
  };

  const handleSaved = () => {
    loadLessons();
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <div>
          <h2>📅 Calendario Lezioni</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Pianifica le lezioni. Clicca su uno slot orario vuoto per aggiungere una lezione o su una lezione per gestirla.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <select
            className="input"
            style={{ width: 'auto', minWidth: 200 }}
            value={selectedPeriodId || ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedPeriodId(val);
              localStorage.setItem('selectedPeriodId', String(val));
            }}
            id="admin-period-select"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_active ? '(Attivo)' : ''}
              </option>
            ))}
          </select>

          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedLesson(null);
              setPrefillDate('');
              setPrefillHour(undefined);
              setIsModalOpen(true);
            }}
            id="btn-add-lesson"
          >
            ➕ Nuova Lezione
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setIsAnomalyOpen(true)}
            id="btn-anomalies"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ⚠️ Anomalie
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', flex: 1 }}>
            <div className="input-group" style={{ margin: 0, minWidth: 220, flex: 1 }}>
              <select
                className="input"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                id="admin-course-filter"
              >
                <option value="">Tutti i Corsi</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ margin: 0, minWidth: 220, flex: 1 }}>
              <select
                className="input"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                id="admin-teacher-filter"
              >
                <option value="">Tutti i Docenti</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* View navigation & View Toggle */}
          {!selectedCourseId && !selectedTeacherId && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div className="btn-group">
                <button className="btn btn-secondary btn-sm" onClick={handlePrev} disabled={isPrevDisabled} id="btn-admin-prev">◀</button>
                <button className="btn btn-secondary btn-sm" onClick={handleToday} id="btn-admin-today">Oggi</button>
                <button className="btn btn-secondary btn-sm" onClick={handleNext} disabled={isNextDisabled} id="btn-admin-next">▶</button>
              </div>

              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', minWidth: 180, textAlign: 'center' }}>
                {getNavigationLabel()}
              </span>

              <div className="btn-group">
                <button
                  className={`btn btn-sm ${viewType === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewType('week')}
                  id="btn-admin-view-week"
                >
                  Settimana
                </button>
                <button
                  className={`btn btn-sm ${viewType === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewType('month')}
                  id="btn-admin-view-month"
                >
                  Mese
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Calendar View Container */}
      {!selectedCourseId && !selectedTeacherId && (
        loading && lessons.length === 0 ? (
          <div className="loading-container" style={{ minHeight: 400 }}>
            <div className="spinner spinner-lg" />
            <p>Caricamento lezioni in corso...</p>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: 'var(--space-md)', overflowX: 'auto' }}>
            {viewType === 'week' ? (
              <WeekView
                lessons={filteredLessons}
                weekStart={getWeekStart(currentDate)}
                onSlotClick={handleSlotClick}
                onLessonClick={handleLessonClick}
              />
            ) : (
              <MonthView
                lessons={filteredLessons}
                year={currentDate.getFullYear()}
                month={currentDate.getMonth()}
                onDayClick={(dateStr) => handleSlotClick(dateStr, 9)}
                onLessonClick={handleLessonClick}
              />
            )}
          </div>
        )
      )}

      {/* Lesson details read-only modal for actions */}
      {selectedLesson && isDetailOpen && (
        <div className="modal-overlay" onClick={() => setIsDetailOpen(false)} id="admin-lesson-details-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📖 Dettagli Lezione</h3>
              <button className="modal-close-btn" onClick={() => setIsDetailOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <div>
                <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>CORSO</strong>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  [{selectedLesson.course_code}] {selectedLesson.course_name}
                </div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>UNITÀ FORMATIVA</strong>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedLesson.unit_name}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div>
                  <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>DOCENTE</strong>
                  <div style={{ color: 'var(--text-secondary)' }}>{selectedLesson.teacher_name}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>MODALITÀ</strong>
                  <div>
                    <span className={`badge badge-${selectedLesson.location_type?.toLowerCase() || 'aula'}`}>
                      {selectedLesson.location_type}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div>
                  <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>DATA</strong>
                  <div style={{ color: 'var(--text-secondary)' }}>{new Date(selectedLesson.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>ORARIO & DURATA</strong>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    ⏰ {selectedLesson.start_time} - {selectedLesson.end_time} ({selectedLesson.hours}h)
                  </div>
                </div>
              </div>

              {selectedLesson.notes && (
                <div>
                  <strong style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>NOTE</strong>
                  <p className="glass-card" style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap', margin: '4px 0 0 0' }}>
                    {selectedLesson.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-danger" onClick={handleDeleteLesson} id="btn-delete-lesson">
                🗑️ Elimina
              </button>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" onClick={() => setIsDetailOpen(false)}>
                  Chiudi
                </button>
                <button className="btn btn-primary" onClick={handleOpenEdit} id="btn-edit-lesson">
                  ✏️ Modifica
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel (shows when course or teacher filter is active) */}
      {(selectedCourseId || selectedTeacherId) && (
        <DetailPanel
          courseId={selectedCourseId ? parseInt(selectedCourseId) : undefined}
          teacherId={selectedTeacherId ? parseInt(selectedTeacherId) : undefined}
          periodId={selectedPeriodId || undefined}
        />
      )}

      {/* Anomaly Panel */}
      <AnomalyPanel
        isOpen={isAnomalyOpen}
        onClose={() => setIsAnomalyOpen(false)}
        periodId={selectedPeriodId || 0}
      />

      {/* Write/Edit Lesson Modal */}
      <LessonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        editLesson={selectedLesson}
        prefillDate={prefillDate}
        prefillHour={prefillHour}
        periodId={selectedPeriodId || undefined}
      />
    </div>
  );
}
