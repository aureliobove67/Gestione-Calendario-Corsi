import { useState, useEffect, FormEvent } from 'react';
import { adminApi, Course, Unit, Period, Assignment, Teacher } from '../../api/client';
import HoursProgressBar from '../dashboard/HoursProgressBar';

export default function CourseEditor() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Course form
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [courseHoursAula, setCourseHoursAula] = useState('0');
  const [courseHoursWebinar, setCourseHoursWebinar] = useState('0');
  const [courseHoursFad, setCourseHoursFad] = useState('0');
  const [courseHoursPw, setCourseHoursPw] = useState('0');
  const [courseHoursExtra, setCourseHoursExtra] = useState('0');
  const [courseHoursStage, setCourseHoursStage] = useState('0');
  const [courseNonContractDeadline, setCourseNonContractDeadline] = useState('');

  // Unit form
  const [showUnitForm, setShowUnitForm] = useState<number | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitName, setUnitName] = useState('');
  const [unitHours, setUnitHours] = useState('');

  // Assignment form
  const [showAssignmentForm, setShowAssignmentForm] = useState<number | null>(null);
  const [assignmentTeacherId, setAssignmentTeacherId] = useState('');
  const [assignmentHours, setAssignmentHours] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Expanded course (to show units)
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [courseUnits, setCourseUnits] = useState<Unit[]>([]);
  const [unitAssignments, setUnitAssignments] = useState<Record<number, Assignment[]>>({});

  useEffect(() => {
    adminApi.getPeriods()
      .then((periodsData) => {
        const activeOnly = periodsData.filter((p) => p.is_active);
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
        
        const active = activeOnly.find((p) => p.is_active);
        if (active) {
          setSelectedPeriodId(active.id);
          localStorage.setItem('selectedPeriodId', String(active.id));
        } else if (activeOnly.length > 0) {
          setSelectedPeriodId(activeOnly[0].id);
          localStorage.setItem('selectedPeriodId', String(activeOnly[0].id));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const loadCoursesAndTeachers = () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    Promise.all([
      adminApi.getCourses(selectedPeriodId),
      adminApi.getTeachers(selectedPeriodId)
    ])
      .then(([coursesData, teachersData]) => {
        setCourses(coursesData);
        setTeachers(teachersData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCoursesAndTeachers(); }, [selectedPeriodId]);

  const loadUnits = (courseId: number) => {
    adminApi.getUnits(courseId).then((units) => {
      setCourseUnits(units);
      // Load assignments for each unit
      units.forEach((unit) => {
        adminApi.getAssignments(unit.id).then((assignments) => {
          setUnitAssignments((prev) => ({ ...prev, [unit.id]: assignments }));
        });
      });
    });
  };

  const toggleExpand = (courseId: number) => {
    if (expandedCourseId === courseId) {
      setExpandedCourseId(null);
    } else {
      setExpandedCourseId(courseId);
      loadUnits(courseId);
    }
  };

  // Course CRUD
  const resetCourseForm = () => {
    setCourseCode('');
    setCourseName('');
    setCourseHoursAula('0');
    setCourseHoursWebinar('0');
    setCourseHoursFad('0');
    setCourseHoursPw('0');
    setCourseHoursExtra('0');
    setCourseHoursStage('0');
    setCourseNonContractDeadline('');
    setEditingCourse(null);
    setShowCourseForm(false);
  };

  const handleCourseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const data = {
        code: courseCode,
        name: courseName,
        period_id: selectedPeriodId!,
        total_hours_aula: parseFloat(courseHoursAula) || 0,
        total_hours_webinar: parseFloat(courseHoursWebinar) || 0,
        total_hours_fad: parseFloat(courseHoursFad) || 0,
        total_hours_pw: parseFloat(courseHoursPw) || 0,
        total_hours_extra: parseFloat(courseHoursExtra) || 0,
        total_hours_stage: parseFloat(courseHoursStage) || 0,
        non_contract_deadline: courseNonContractDeadline || null,
      };
      if (editingCourse) {
        await adminApi.updateCourse(editingCourse.id, data);
        setSuccess('Corso aggiornato!');
      } else {
        await adminApi.createCourse(data);
        setSuccess('Corso creato!');
      }
      resetCourseForm();
      loadCoursesAndTeachers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (id: number, name: string) => {
    if (!confirm(`Eliminare il corso "${name}"?`)) return;
    try {
      await adminApi.deleteCourse(id);
      setSuccess('Corso eliminato');
      loadCoursesAndTeachers();
    } catch (err: any) { setError(err.message); }
  };

  // Unit CRUD
  const resetUnitForm = () => {
    setUnitName('');
    setUnitHours('');
    setEditingUnit(null);
    setShowUnitForm(null);
  };

  const handleUnitSubmit = async (e: FormEvent, courseId: number) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = { name: unitName, course_id: courseId, contracted_hours: parseFloat(unitHours) };
      if (editingUnit) {
        await adminApi.updateUnit(editingUnit.id, data);
        setSuccess('Unità aggiornata!');
      } else {
        await adminApi.createUnit(data);
        setSuccess('Unità creata!');
      }
      resetUnitForm();
      loadUnits(courseId);
    } catch (err: any) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteUnit = async (id: number, courseId: number) => {
    if (!confirm('Eliminare questa unità formativa?')) return;
    try {
      await adminApi.deleteUnit(id);
      loadUnits(courseId);
    } catch (err: any) { setError(err.message); }
  };

  // Assignment CRUD
  const handleAssignmentSubmit = async (e: FormEvent, unitId: number, courseId: number) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingAssignment) {
        await adminApi.updateAssignment(editingAssignment.id, {
          unit_id: unitId,
          teacher_id: parseInt(assignmentTeacherId),
          hours: parseFloat(assignmentHours),
        });
        setSuccess('Assegnazione aggiornata!');
      } else {
        await adminApi.createAssignment({
          unit_id: unitId,
          teacher_id: parseInt(assignmentTeacherId),
          hours: parseFloat(assignmentHours),
        });
        setSuccess('Assegnazione creata!');
      }
      setShowAssignmentForm(null);
      setEditingAssignment(null);
      setAssignmentTeacherId('');
      setAssignmentHours('');
      loadUnits(courseId);
    } catch (err: any) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const startEditAssignment = (assignment: Assignment, unitId: number) => {
    setEditingAssignment(assignment);
    setAssignmentTeacherId(assignment.teacher_id.toString());
    setAssignmentHours(assignment.hours.toString());
    setShowAssignmentForm(unitId);
  };

  const cancelAssignmentEdit = () => {
    setEditingAssignment(null);
    setAssignmentTeacherId('');
    setAssignmentHours('');
    setShowAssignmentForm(null);
  };

  const handleDeleteAssignment = async (id: number, courseId: number) => {
    if (!confirm('Eliminare questa assegnazione?')) return;
    try {
      await adminApi.deleteAssignment(id);
      loadUnits(courseId);
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <h2>📚 Gestione Corsi</h2>
        <div className="flex items-center gap-md">
          <select 
            className="input" 
            style={{ width: 'auto', minWidth: 200 }} 
            value={selectedPeriodId || ''} 
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedPeriodId(val);
              localStorage.setItem('selectedPeriodId', String(val));
            }} 
            id="course-period-select"
          >
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { resetCourseForm(); setShowCourseForm(!showCourseForm); }} id="btn-toggle-course-form">
            {showCourseForm ? 'Annulla' : '+ Nuovo Corso'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}
      {success && <div className="alert alert-success mb-md">✅ {success}</div>}

      {/* Course form */}
      {showCourseForm && (
        <div className="glass-card-static" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>{editingCourse ? 'Modifica Corso' : 'Nuovo Corso'}</h4>
          <form onSubmit={handleCourseSubmit} id="course-form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="course-code">Codice</label>
                <input type="text" id="course-code" className="input" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required placeholder="es. IFTS-001" />
              </div>
              <div className="input-group">
                <label htmlFor="course-name">Nome Corso</label>
                <input type="text" id="course-name" className="input" value={courseName} onChange={(e) => setCourseName(e.target.value)} required placeholder="es. Sviluppo Web Full Stack" />
              </div>
            </div>

            {/* Contract Hours */}
            <div style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', background: 'rgba(255, 255, 255, 0.01)', marginBottom: 'var(--space-md)' }}>
              <h5 style={{ color: 'var(--accent-blue)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>📝 Ore da Contratto</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group">
                  <label htmlFor="course-hours-aula">Ore AULA</label>
                  <input type="number" id="course-hours-aula" className="input" min="0" step="0.5" value={courseHoursAula} onChange={(e) => setCourseHoursAula(e.target.value)} />
                </div>
                <div className="input-group">
                  <label htmlFor="course-hours-pw">Ore Project Work (PW)</label>
                  <input type="number" id="course-hours-pw" className="input" min="0" step="0.5" value={courseHoursPw} onChange={(e) => setCourseHoursPw(e.target.value)} />
                </div>
                <div className="input-group">
                  <label htmlFor="course-hours-extra">Ore Extra</label>
                  <input type="number" id="course-hours-extra" className="input" min="0" step="0.5" value={courseHoursExtra} onChange={(e) => setCourseHoursExtra(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Non-Contract Hours */}
            <div style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', background: 'rgba(255, 255, 255, 0.01)', marginBottom: 'var(--space-md)' }}>
              <h5 style={{ color: 'var(--accent-yellow)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>🔔 Ore Non da Contratto (Solo Promemoria)</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div className="input-group">
                  <label htmlFor="course-hours-webinar">Ore WEBINAR</label>
                  <input type="number" id="course-hours-webinar" className="input" min="0" step="0.5" value={courseHoursWebinar} onChange={(e) => setCourseHoursWebinar(e.target.value)} />
                </div>
                <div className="input-group">
                  <label htmlFor="course-hours-fad">Ore FAD</label>
                  <input type="number" id="course-hours-fad" className="input" min="0" step="0.5" value={courseHoursFad} onChange={(e) => setCourseHoursFad(e.target.value)} />
                </div>
                <div className="input-group">
                  <label htmlFor="course-hours-stage">Ore STAGE</label>
                  <input type="number" id="course-hours-stage" className="input" min="0" step="0.5" value={courseHoursStage} onChange={(e) => setCourseHoursStage(e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="course-non-contract-deadline" style={{ color: 'var(--accent-red)' }}>📅 Data di Scadenza Promemoria</label>
                <input type="date" id="course-non-contract-deadline" className="input" value={courseNonContractDeadline} onChange={(e) => setCourseNonContractDeadline(e.target.value)} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Dopo questa data, le ore non da contratto di questo corso non appariranno più come promemoria sulla dashboard.
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: 'var(--space-md)' }} id="btn-save-course">
              {isSubmitting ? <><span className="spinner spinner-sm" /> Salvataggio...</> : editingCourse ? 'Aggiorna' : 'Crea Corso'}
            </button>
          </form>
        </div>
      )}

      {/* Courses list */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <div className="empty-text">Nessun corso per questo periodo. Crea il primo!</div>
        </div>
      ) : (
        <div className="flex-col gap-md">
          {courses.map((course) => (
            <div key={course.id} className="glass-card-static" style={{ overflow: 'hidden' }}>
              {/* Course header */}
              <div
                className="flex items-center justify-between p-lg"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(course.id)}
                id={`course-expand-${course.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                  <span className="badge badge-blue">{course.code}</span>
                  <strong>{course.name}</strong>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginLeft: 'var(--space-md)' }}>
                    (Aula: {course.total_hours_aula || 0}h | PW: {course.total_hours_pw || 0}h | Extra: {course.total_hours_extra || 0}h | Webinar: {course.total_hours_webinar || 0}h | FAD: {course.total_hours_fad || 0}h | Stage: {course.total_hours_stage || 0}h)
                  </span>
                  {course.non_contract_deadline && (
                    <span className="badge badge-red" style={{ fontSize: '10px' }}>
                      ⏳ Scadenza: {new Date(course.non_contract_deadline).toLocaleDateString('it-IT')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-sm">
                  <button className="btn btn-secondary btn-sm" onClick={(e) => {
                    e.stopPropagation();
                    setEditingCourse(course);
                    setCourseCode(course.code || '');
                    setCourseName(course.name);
                    setCourseHoursAula(course.total_hours_aula?.toString() || '0');
                    setCourseHoursWebinar(course.total_hours_webinar?.toString() || '0');
                    setCourseHoursFad(course.total_hours_fad?.toString() || '0');
                    setCourseHoursPw(course.total_hours_pw?.toString() || '0');
                    setCourseHoursExtra(course.total_hours_extra?.toString() || '0');
                    setCourseHoursStage(course.total_hours_stage?.toString() || '0');
                    setCourseNonContractDeadline(course.non_contract_deadline || '');
                    setShowCourseForm(true);
                  }}>
                    ✏️
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id, course.name); }}>
                    🗑️
                  </button>
                  <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: expandedCourseId === course.id ? 'rotate(180deg)' : 'rotate(0)' }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded: Units */}
              {expandedCourseId === course.id && (
                <div style={{ padding: '0 var(--space-lg) var(--space-lg)', borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between" style={{ padding: 'var(--space-md) 0' }}>
                    <h4 style={{ fontSize: 'var(--font-size-sm)' }}>Unità Formative</h4>
                    <button className="btn btn-secondary btn-sm" onClick={() => { resetUnitForm(); setShowUnitForm(showUnitForm === course.id ? null : course.id); }} id={`btn-add-unit-${course.id}`}>
                      + Aggiungi UF
                    </button>
                  </div>

                  {(() => {
                    const courseContractHours = (course.total_hours_aula || 0) + (course.total_hours_pw || 0);
                    const sumOfUfHours = courseUnits.reduce((sum, u) => sum + (u.contracted_hours || 0), 0);
                    const hoursMismatch = sumOfUfHours !== courseContractHours;
                    return hoursMismatch && courseUnits.length > 0 ? (
                      <div className="alert alert-error" style={{ margin: '0 0 var(--space-md) 0', borderLeft: '4px solid var(--accent-red)', padding: 'var(--space-md)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                        <div style={{ fontWeight: '600', color: 'var(--accent-red)' }}>⚠️ Attenzione: Discrepanza Ore da Contratto Corso!</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px', color: 'var(--text-secondary)' }}>
                          La somma delle ore delle Unità Formative (<strong>{sumOfUfHours}h</strong>) non corrisponde alle ore totali da contratto del corso (<strong>{courseContractHours}h</strong>: Aula {course.total_hours_aula || 0}h + PW {course.total_hours_pw || 0}h).
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {showUnitForm === course.id && (
                    <form onSubmit={(e) => handleUnitSubmit(e, course.id)} style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--space-sm)', alignItems: 'end' }}>
                        <div className="input-group">
                          <label>Nome UF</label>
                          <input type="text" className="input" value={unitName} onChange={(e) => setUnitName(e.target.value)} required placeholder="es. Frontend Development" />
                        </div>
                        <div className="input-group">
                          <label>Ore</label>
                          <input type="number" className="input" value={unitHours} onChange={(e) => setUnitHours(e.target.value)} required placeholder="56" min="1" />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
                          {editingUnit ? 'Aggiorna' : 'Aggiungi'}
                        </button>
                      </div>
                    </form>
                  )}

                  {courseUnits.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-md) 0' }}>
                      Nessuna unità formativa. Aggiungine una!
                    </p>
                  ) : (
                    <div className="flex-col gap-sm">
                      {courseUnits.map((unit) => {
                        const assignedSum = unitAssignments[unit.id]?.reduce((sum, a) => sum + a.hours, 0) || 0;
                        return (
                          <div key={unit.id} style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-center justify-between">
                            <div style={{ flex: 1 }}>
                              <strong>{unit.name}</strong>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                                {unit.contracted_hours}h contrattualizzate
                              </span>
                              <div style={{ marginTop: 4, maxWidth: 200 }}>
                                <HoursProgressBar used={unit.used_hours || 0} total={unit.contracted_hours} />
                              </div>
                            </div>
                            <div className="flex gap-xs">
                              <button className="btn btn-secondary btn-sm" onClick={() => { setEditingUnit(unit); setUnitName(unit.name); setUnitHours(unit.contracted_hours.toString()); setShowUnitForm(course.id); }}>✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUnit(unit.id, course.id)}>🗑️</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setShowAssignmentForm(showAssignmentForm === unit.id ? null : unit.id)} title="Gestisci assegnazioni">👨‍🏫</button>
                            </div>
                          </div>

                          {/* Assignments */}
                          {unitAssignments[unit.id] && unitAssignments[unit.id].length > 0 && (
                            <div style={{ marginTop: 'var(--space-sm)', paddingLeft: 'var(--space-md)' }}>
                              {unitAssignments[unit.id].map((a) => (
                                <div key={a.id} className="flex items-center justify-between" style={{ padding: '4px 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                  <span>👨‍🏫 {a.teacher_name} — {a.hours}h</span>
                                  <div className="flex gap-xs">
                                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.65rem' }} onClick={() => startEditAssignment(a, unit.id)}>✏️</button>
                                    <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: '0.65rem' }} onClick={() => handleDeleteAssignment(a.id, course.id)}>✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Hours validation status */}
                          {unitAssignments[unit.id] && (
                            <div style={{
                              marginTop: 'var(--space-sm)',
                              padding: '8px var(--space-md)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-xs)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-sm)',
                              background: assignedSum === unit.contracted_hours 
                                ? 'rgba(46, 204, 113, 0.1)' 
                                : assignedSum === 0 
                                  ? 'rgba(52, 152, 219, 0.1)'
                                  : 'rgba(231, 76, 60, 0.1)',
                              border: assignedSum === unit.contracted_hours 
                                ? '1px solid rgba(46, 204, 113, 0.2)' 
                                : assignedSum === 0
                                  ? '1px solid rgba(52, 152, 219, 0.2)'
                                  : '1px solid rgba(231, 76, 60, 0.2)',
                              color: assignedSum === unit.contracted_hours 
                                ? 'var(--accent-green)' 
                                : assignedSum === 0
                                  ? 'var(--accent-blue)'
                                  : 'var(--accent-red)',
                              fontWeight: 500
                            }}>
                              {assignedSum === unit.contracted_hours ? (
                                <span>✅ Distribuzione ore corretta ({assignedSum}h su {unit.contracted_hours}h)</span>
                              ) : assignedSum === 0 ? (
                                <span>ℹ️ Nessun docente ancora assegnato. Assegna docenti per raggiungere il totale di <strong>{unit.contracted_hours}h</strong>.</span>
                              ) : assignedSum < unit.contracted_hours ? (
                                <span>⚠️ Ore assegnate ({assignedSum}h) inferiori alle ore da contratto ({unit.contracted_hours}h). Mancano ancora <strong>{unit.contracted_hours - assignedSum}h</strong>.</span>
                              ) : (
                                <span>⚠️ Ore assegnate ({assignedSum}h) superiori alle ore da contratto ({unit.contracted_hours}h). Sforamento di <strong>{assignedSum - unit.contracted_hours}h</strong>!</span>
                              )}
                            </div>
                          )}

                          {/* Assignment form */}
                          {showAssignmentForm === unit.id && (
                            <form onSubmit={(e) => handleAssignmentSubmit(e, unit.id, course.id)} style={{ marginTop: 'var(--space-sm)', display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 'var(--space-sm)', alignItems: 'end' }}>
                              <select className="input" value={assignmentTeacherId} onChange={(e) => setAssignmentTeacherId(e.target.value)} required style={{ fontSize: 'var(--font-size-sm)' }}>
                                <option value="">Seleziona docente...</option>
                                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                              <input type="number" className="input" value={assignmentHours} onChange={(e) => setAssignmentHours(e.target.value)} required placeholder="Ore" min="1" style={{ fontSize: 'var(--font-size-sm)' }} />
                              <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
                                {editingAssignment ? 'Salva' : 'Assegna'}
                              </button>
                              {editingAssignment && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={cancelAssignmentEdit}>Annulla</button>
                              )}
                            </form>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
