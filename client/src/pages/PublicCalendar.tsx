import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi, Period, Course, Teacher, Lesson } from '../api/client';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import { useAuth } from '../context/AuthContext';
import DetailPanel from '../components/calendar/DetailPanel';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function PublicCalendar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

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
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Load periods
  useEffect(() => {
    publicApi.getPeriods()
      .then((data) => {
        setPeriods(data);

        // Retrieve persistent selection
        const savedPeriodId = localStorage.getItem('selectedPeriodId');
        if (savedPeriodId) {
          const parsed = Number(savedPeriodId);
          if (data.some((p) => p.id === parsed)) {
            setSelectedPeriodId(parsed);
            return;
          }
        }

        const active = data.find((p) => p.is_active);
        if (active) {
          setSelectedPeriodId(active.id);
          localStorage.setItem('selectedPeriodId', String(active.id));
        } else if (data.length > 0) {
          setSelectedPeriodId(data[0].id);
          localStorage.setItem('selectedPeriodId', String(data[0].id));
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
      publicApi.getTeachers(selectedPeriodId),
    ])
      .then(([coursesData, teachersData]) => {
        setCourses(coursesData);
        setTeachers(teachersData);
      })
      .catch((err) => setError(err.message || 'Errore nel caricamento dei filtri'))
      .finally(() => setLoading(false));
  }, [selectedPeriodId]);

  const selectedPeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId);
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
  useEffect(() => {
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
  }, [selectedPeriodId, viewType, currentDate]);

  // Apply client-side filters for interactive search
  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (selectedCourseId) {
        const course = courses.find((c) => c.id.toString() === selectedCourseId);
        if (!course || (lesson.course_code !== course.code)) {
          return false;
        }
      }
      if (selectedTeacherId) {
        const teacher = teachers.find((t) => t.id.toString() === selectedTeacherId);
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
      return `${start.getDate()} ${start.toLocaleString('it-IT', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('it-IT', { month: 'short' })} ${end.getFullYear()}`;
    } else {
      return currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
    }
  };

  return (
    <div className="public-layout">
      {/* Navbar */}
      <nav className="public-navbar">
        <div className="navbar-brand">
          <div className="brand-logo">GC</div>
          <div className="brand-title">
            Gestione Calendario
            <span>Portale Pubblico</span>
          </div>
        </div>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin')} id="btn-goto-admin">
              📊 <span className="btn-text-responsive">Pannello Admin</span>
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')} id="btn-login-redirect">
              🔑 <span className="btn-text-responsive">Accedi</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <main className="public-container">
        {/* Banner info */}
        <div className="glass-card public-banner-card">
          <div className="public-banner-text">
            <h2 className="public-banner-heading">
              📅 Calendario Lezioni & Corsi
            </h2>
            <p className="public-banner-desc">
              Visualizzazione orari, docenti e aule. Filtra per corso o docente per restringere la ricerca.
            </p>
          </div>

          <div className="public-period-selector-wrapper">
            <div className="input-group" style={{ margin: 0, width: '100%' }}>
              <select
                className="input public-period-select"
                value={selectedPeriodId || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedPeriodId(val);
                  localStorage.setItem('selectedPeriodId', String(val));
                }}
                id="public-period-select"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_active ? '(Attivo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="glass-card public-toolbar-card">
          <div className="public-toolbar-inner">
            {/* Filters */}
            <div className="public-filters-row">
              <div className="input-group public-filter-group">
                <select
                  className="input"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  id="public-course-filter"
                >
                  <option value="">📚 Tutti i Corsi</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group public-filter-group">
                <select
                  className="input"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  id="public-teacher-filter"
                >
                  <option value="">👨‍🏫 Tutti i Docenti</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* View navigation & View Toggle */}
            {!selectedCourseId && !selectedTeacherId && (
              <div className="public-nav-row">
                <div className="btn-group public-arrows-group">
                  <button className="btn btn-secondary btn-sm" onClick={handlePrev} disabled={isPrevDisabled} id="btn-public-prev" title="Precedente">◀</button>
                  <button className="btn btn-secondary btn-sm" onClick={handleToday} id="btn-public-today">Oggi</button>
                  <button className="btn btn-secondary btn-sm" onClick={handleNext} disabled={isNextDisabled} id="btn-public-next" title="Successivo">▶</button>
                </div>

                <span className="public-nav-date-label">
                  {getNavigationLabel()}
                </span>

                <div className="btn-group public-viewtype-group">
                  <button
                    className={`btn btn-sm ${viewType === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewType('week')}
                    id="btn-public-view-week"
                  >
                    Settimana
                  </button>
                  <button
                    className={`btn btn-sm ${viewType === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewType('month')}
                    id="btn-public-view-month"
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
          loading ? (
            <div className="loading-container" style={{ minHeight: 350 }}>
              <div className="spinner spinner-lg" />
              <p>Caricamento calendario in corso...</p>
            </div>
          ) : (
            <div className="glass-card public-calendar-wrapper">
              {viewType === 'week' ? (
                <WeekView
                  lessons={filteredLessons}
                  weekStart={getWeekStart(currentDate)}
                  onLessonClick={setSelectedLesson}
                />
              ) : (
                <MonthView
                  lessons={filteredLessons}
                  year={currentDate.getFullYear()}
                  month={currentDate.getMonth()}
                  onLessonClick={setSelectedLesson}
                />
              )}
            </div>
          )
        )}

        {/* Detail Panel (shows when course or teacher filter is active) */}
        {(selectedCourseId || selectedTeacherId) && (
          <DetailPanel
            courseId={selectedCourseId ? parseInt(selectedCourseId) : undefined}
            teacherId={selectedTeacherId ? parseInt(selectedTeacherId) : undefined}
            periodId={selectedPeriodId || undefined}
          />
        )}
      </main>

      {/* Lesson details modal */}
      {selectedLesson && (
        <div className="modal-overlay" onClick={() => setSelectedLesson(null)} id="public-lesson-details-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📖 Dettagli Lezione</h3>
              <button className="modal-close-btn" onClick={() => setSelectedLesson(null)}>✕</button>
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
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLesson(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="public-footer">
        © {new Date().getFullYear()} Gestione Calendario Corsi — Riservato agli utenti autorizzati.
      </footer>
    </div>
  );
}
