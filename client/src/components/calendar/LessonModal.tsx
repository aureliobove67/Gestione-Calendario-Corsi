import { useState, useEffect, FormEvent } from 'react';
import {
  adminApi,
  publicApi,
  Course,
  Unit,
  Assignment,
  Lesson,
  HoursStatus,
} from '../../api/client';
import HoursProgressBar from '../dashboard/HoursProgressBar';
import { getItalianHoliday } from '../../utils/holidays';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editLesson?: Lesson | null;
  prefillDate?: string;
  prefillHour?: number;
  periodId?: number;
}

export default function LessonModal({
  isOpen,
  onClose,
  onSaved,
  editLesson,
  prefillDate,
  prefillHour,
  periodId,
}: LessonModalProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [hoursStatus, setHoursStatus] = useState<HoursStatus | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [date, setDate] = useState(prefillDate || '');
  const [startTime, setStartTime] = useState(prefillHour ? `${prefillHour.toString().padStart(2, '0')}:00` : '09:00');
  const [endTime, setEndTime] = useState(prefillHour ? `${(prefillHour + 1).toString().padStart(2, '0')}:00` : '10:00');
  const [locationType, setLocationType] = useState<string>('AULA');
  const [notes, setNotes] = useState('');

  const [showWarning, setShowWarning] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideConfirm, setOverrideConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);

  // Load current period
  useEffect(() => {
    if (!isOpen || !periodId) return;
    publicApi.getPeriods().then((data) => {
      const active = data.find(p => p.id === periodId);
      if (active) setCurrentPeriod(active);
    }).catch(() => {});
  }, [isOpen, periodId]);

  // Load courses
  useEffect(() => {
    if (!isOpen) return;
    publicApi.getCourses(periodId).then(setCourses).catch(() => {});
  }, [isOpen, periodId]);

  // Load units when course changes (skip when loading edit data)
  useEffect(() => {
    if (!selectedCourseId) {
      setUnits([]);
      setSelectedUnitId('');
      return;
    }
    if (isLoadingEdit) return; // skip cascade reset during edit load
    adminApi.getUnits(parseInt(selectedCourseId)).then(setUnits).catch(() => {});
  }, [selectedCourseId]);

  // Load assignments when unit changes (skip when loading edit data)
  useEffect(() => {
    if (!selectedUnitId) {
      setAssignments([]);
      setSelectedAssignmentId('');
      setHoursStatus(null);
      return;
    }
    if (isLoadingEdit) return; // skip cascade reset during edit load
    adminApi.getAssignments(parseInt(selectedUnitId)).then((data) => {
      setAssignments(data);
      if (data.length === 1) {
        setSelectedAssignmentId(data[0].id.toString());
      }
    }).catch(() => {});
  }, [selectedUnitId]);

  // Load hours status when assignment changes
  useEffect(() => {
    if (!selectedAssignmentId) {
      setHoursStatus(null);
      setShowWarning(false);
      return;
    }
    adminApi.getAssignmentHoursStatus(parseInt(selectedAssignmentId)).then((status) => {
      setHoursStatus(status);
      // Check if adding this lesson would exceed
      const lessonHours = calculateHours();
      if (status.remainingHours < lessonHours) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }).catch(() => {});
  }, [selectedAssignmentId, startTime, endTime]);

  // Load edit data: fetch full lesson details and pre-populate all fields
  useEffect(() => {
    if (editLesson && isOpen) {
      setIsLoadingEdit(true);
      setDate(editLesson.date);
      setStartTime(editLesson.start_time);
      setEndTime(editLesson.end_time);
      setLocationType(editLesson.location_type);
      setNotes(editLesson.notes || '');

      // EXTRA lessons: just set course_id, skip unit/assignment loading
      if (editLesson.location_type === 'EXTRA') {
        adminApi.getLesson(editLesson.id).then((detail) => {
          if (detail.course_id) {
            setSelectedCourseId(detail.course_id.toString());
          }
          setIsLoadingEdit(false);
        }).catch((err) => {
          console.error('Errore getLesson:', err);
          setIsLoadingEdit(false);
          setError('Errore nel caricamento dei dettagli della lezione');
        });
        return; // Skip regular edit loading below
      }

      // Fetch full lesson details to get course_id, unit_id, assignment_id
      adminApi.getLesson(editLesson.id).then(async (detail) => {
        // Set course and load units
        setSelectedCourseId(detail.course_id.toString());
        const unitsData = await adminApi.getUnits(detail.course_id);
        setUnits(unitsData);

        // Set unit and load assignments
        if (detail.unit_id) {
          setSelectedUnitId(detail.unit_id.toString());
          const assignmentsData = await adminApi.getAssignments(detail.unit_id);
          setAssignments(assignmentsData);
        }

        // Set assignment
        if (detail.assignment_id) {
          setSelectedAssignmentId(detail.assignment_id.toString());
        }

        setIsLoadingEdit(false);
      }).catch((err) => {
        console.error('Errore getLesson:', err);
        setIsLoadingEdit(false);
        setError('Errore nel caricamento dei dettagli della lezione');
      });
    } else if (isOpen) {
      // Reset form for new lesson
      setDate(prefillDate || '');
      setStartTime(prefillHour ? `${prefillHour.toString().padStart(2, '0')}:00` : '09:00');
      setEndTime(prefillHour ? `${(prefillHour + 1).toString().padStart(2, '0')}:00` : '10:00');
      setLocationType('AULA');
      setNotes('');
      setSelectedCourseId('');
      setSelectedUnitId('');
      setSelectedAssignmentId('');
      setOverrideReason('');
      setOverrideConfirm(false);
      setShowWarning(false);
      setError('');
      setIsLoadingEdit(false);
    }
  }, [editLesson, isOpen, prefillDate, prefillHour]);

  const calculateHours = () => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 1. Sunday and Italian Holiday block
      // Parse date correctly to avoid timezone issues (YYYY-MM-DD)
      const [yr, mo, dy] = date.split('-').map(Number);
      const parsedDate = new Date(yr, mo - 1, dy);
      const dayOfWeek = parsedDate.getDay(); // 0 = Sunday, 6 = Saturday
      const holiday = getItalianHoliday(parsedDate);

      if (dayOfWeek === 0 || dayOfWeek === 6 || holiday.isHoliday) {
        const reason = dayOfWeek === 0 ? 'Domenica' : dayOfWeek === 6 ? 'Sabato' : (holiday.name || 'Festività');
        setError(`Impossibile programmare lezioni: ${reason} — inserimento bloccato!`);
        setIsSubmitting(false);
        return;
      }

      // 3. Period boundaries validation
      if (currentPeriod) {
        if (date < currentPeriod.start_date || date > currentPeriod.end_date) {
          setError(`La data deve essere compresa nel periodo di gestione attivo: da ${new Date(currentPeriod.start_date + 'T00:00:00').toLocaleDateString('it-IT')} a ${new Date(currentPeriod.end_date + 'T00:00:00').toLocaleDateString('it-IT')}!`);
          setIsSubmitting(false);
          return;
        }
      }

      // === EXTRA lesson submit path ===
      if (locationType === 'EXTRA') {
        const extraPayload = {
          course_id: parseInt(selectedCourseId),
          date,
          start_time: startTime,
          end_time: endTime,
          hours: calculateHours(),
          location_type: 'EXTRA' as const,
          notes: notes,
        };
        if (editLesson) {
          await adminApi.updateLesson(editLesson.id, extraPayload);
        } else {
          await adminApi.createLesson(extraPayload);
        }
        onSaved();
        onClose();
        return;
      }

      // === Regular lesson submit ===
      const payload = {
        assignment_id: parseInt(selectedAssignmentId),
        date,
        start_time: startTime,
        end_time: endTime,
        hours: calculateHours(),
        location_type: locationType as 'AULA' | 'WEBINAR' | 'FAD' | 'PW' | 'STAGE',
        notes: notes || undefined,
        override_reason: showWarning && overrideConfirm ? overrideReason : undefined,
        force: showWarning && overrideConfirm ? true : undefined,
      };

      if (editLesson) {
        await adminApi.updateLesson(editLesson.id, payload);
      } else {
        await adminApi.createLesson(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      // 409 with warning field = hours overflow (allow override)
      if (err.status === 409 && err.data?.warning) {
        setShowWarning(true);
        setError('');
      } else {
        // All other errors (409 overlap, 400 bad request, 500 server error)
        setError(err.message || 'Errore nel salvataggio');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const lessonHours = calculateHours();

  const selectedCourse = courses.find((c) => c.id.toString() === selectedCourseId);

  const courseTotalContracted = selectedCourse
    ? (selectedCourse.total_hours_aula || 0) +
      (selectedCourse.total_hours_pw || 0)
    : 0;

  const courseTotalUsed = selectedCourse
    ? (selectedCourse.used_hours_aula || 0) +
      (selectedCourse.used_hours_pw || 0)
    : 0;

  const courseTotalRemaining = courseTotalContracted - courseTotalUsed;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>{editLesson ? '✏️ Modifica Lezione' : '📝 Nuova Lezione'}</h3>
          <button className="modal-close-btn" onClick={onClose} id="btn-modal-close">✕</button>
        </div>

        {isLoadingEdit ? (
          <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div className="spinner spinner-lg" />
            <p style={{ marginLeft: 'var(--space-md)' }}>Caricamento dati lezione...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} id="lesson-form">
          <div className="modal-body">
            {error && (
              <div className="alert alert-error">⚠️ {error}</div>
            )}

            {/* Course selector */}
            <div className="input-group">
              <label htmlFor="lesson-course">Corso</label>
              <select
                id="lesson-course"
                className="input"
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSelectedUnitId('');
                  setSelectedAssignmentId('');
                  setUnits([]);
                  setAssignments([]);
                  setHoursStatus(null);
                  if (e.target.value) {
                    adminApi.getUnits(parseInt(e.target.value)).then(setUnits).catch(() => {});
                  }
                }}
                required
              >
                <option value="">Seleziona un corso...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCourse && (
              <div className="course-hours-summary glass-card" style={{ padding: 'var(--space-md)', marginTop: 'var(--space-sm)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📚 Stato Ore Corso: {selectedCourse.name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)', textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{courseTotalContracted}h</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Contratto Corso</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{courseTotalUsed}h</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Programmate</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: courseTotalRemaining <= 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{courseTotalRemaining}h</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Residuo Corso</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', fontSize: '10px' }}>
                  <span className="badge badge-blue" style={{ padding: '2px 6px' }}>Aula: {selectedCourse.used_hours_aula || 0}/{selectedCourse.total_hours_aula || 0}h</span>
                  <span className="badge badge-orange" style={{ padding: '2px 6px' }}>PW: {selectedCourse.used_hours_pw || 0}/{selectedCourse.total_hours_pw || 0}h</span>
                  {(selectedCourse.total_hours_extra || 0) > 0 && (
                    <span className="badge badge-extra" style={{ padding: '2px 6px' }}>Extra: {selectedCourse.used_hours_extra || 0}/{selectedCourse.total_hours_extra || 0}h</span>
                  )}
                </div>
              </div>
            )}

            {/* Location type - placed after course for EXTRA logic */}
            <div className="input-group">
              <label htmlFor="lesson-location">Modalità</label>
              <select
                id="lesson-location"
                className="input"
                value={locationType}
                onChange={(e) => {
                  setLocationType(e.target.value);
                  if (e.target.value === 'EXTRA') {
                    setSelectedUnitId('');
                    setSelectedAssignmentId('');
                    setHoursStatus(null);
                  }
                }}
              >
                <option value="AULA">Aula</option>
                <option value="PW">Project Work</option>
                <option value="EXTRA">Ore Extra</option>
              </select>
            </div>

            {/* Extra hours info panel */}
            {locationType === 'EXTRA' && selectedCourse && (() => {
              const totalExtra = selectedCourse.total_hours_extra || 0;
              const usedExtra = selectedCourse.used_hours_extra || 0;
              const remainingExtra = totalExtra - usedExtra;
              const hasExtraHours = totalExtra > 0;

              return (
                <div style={{ 
                  padding: 'var(--space-md)', 
                  borderRadius: 'var(--radius-md)', 
                  border: `1px solid ${hasExtraHours ? 'rgba(168, 85, 247, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                  background: hasExtraHours ? 'rgba(168, 85, 247, 0.05)' : 'rgba(248, 113, 113, 0.05)',
                  marginTop: 'var(--space-sm)'
                }}>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)', color: hasExtraHours ? '#a855f7' : 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {hasExtraHours ? '⭐ Ore Extra Disponibili' : '⚠️ Nessuna Ora Extra Configurata'}
                  </h4>
                  {hasExtraHours ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: '#a855f7' }}>{totalExtra}h</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Totali Extra</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{usedExtra}h</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Utilizzate</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: remainingExtra <= 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{remainingExtra}h</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Residuo</div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                      Questo corso non ha Ore Extra configurate. Vai in Gestione Corsi per aggiungere le Ore Extra.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Unit selector - hidden for EXTRA */}
            {locationType !== 'EXTRA' && (
            <>
            <div className="input-group">
              <label htmlFor="lesson-unit">Unità Formativa</label>
              <select
                id="lesson-unit"
                className="input"
                value={selectedUnitId}
                onChange={(e) => {
                  setSelectedUnitId(e.target.value);
                  setSelectedAssignmentId('');
                  setAssignments([]);
                  setHoursStatus(null);
                  if (e.target.value) {
                    adminApi.getAssignments(parseInt(e.target.value)).then((data) => {
                      setAssignments(data);
                      if (data.length === 1) {
                        setSelectedAssignmentId(data[0].id.toString());
                      }
                    }).catch(() => {});
                  }
                }}
                required
                disabled={!selectedCourseId}
              >
                <option value="">Seleziona un'unità...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.contracted_hours}h)
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment / Teacher selector */}
            <div className="input-group">
              <label htmlFor="lesson-assignment">Docente (Assegnazione)</label>
              <select
                id="lesson-assignment"
                className="input"
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                required
                disabled={!selectedUnitId}
              >
                <option value="">Seleziona docente...</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.teacher_name} ({a.hours}h assegnate)
                  </option>
                ))}
              </select>
            </div>

            {/* Hours status display */}
            {hoursStatus && (
              <div className="hours-display" id="hours-status-display">
                <div className="hours-display-item">
                  <div className="hours-display-value" style={{ color: 'var(--accent-blue)' }}>
                    {(units.find(u => u.id.toString() === selectedUnitId)?.contracted_hours || 0)}h
                  </div>
                  <div className="hours-display-label">Contratto UF</div>
                </div>
                <div className="hours-display-divider" />
                <div className="hours-display-item">
                  <div className="hours-display-value" style={{ color: 'var(--text-primary)' }}>
                    {hoursStatus.totalHours}h
                  </div>
                  <div className="hours-display-label">Assegnate Docente</div>
                </div>
                <div className="hours-display-divider" />
                <div className="hours-display-item">
                  <div className="hours-display-value" style={{ color: 'var(--accent-yellow)' }}>
                    {hoursStatus.usedHours}h
                  </div>
                  <div className="hours-display-label">Programmate</div>
                </div>
                <div className="hours-display-divider" />
                <div className="hours-display-item">
                  <div className="hours-display-value" style={{
                    color: hoursStatus.remainingHours <= 0 ? 'var(--accent-red)' : 'var(--accent-green)',
                  }}>
                    {hoursStatus.remainingHours}h
                  </div>
                  <div className="hours-display-label">Disponibili</div>
                </div>

                <div style={{ width: '100%', marginTop: 'var(--space-sm)' }}>
                  <HoursProgressBar used={hoursStatus.usedHours} total={hoursStatus.totalHours} />
                </div>
              </div>
            )}
            </>
            )}

            {/* Date and Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="lesson-date">Data</label>
                <input
                  type="date"
                  id="lesson-date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={currentPeriod?.start_date || undefined}
                  max={currentPeriod?.end_date || undefined}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="lesson-start">Inizio</label>
                <input
                  type="time"
                  id="lesson-start"
                  className="input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="lesson-end">Fine</label>
                <input
                  type="time"
                  id="lesson-end"
                  className="input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Durata: <strong>{lessonHours}</strong> ore
            </div>

            {/* Notes */}
            <div className="input-group">
              <label htmlFor="lesson-notes">{locationType === 'EXTRA' ? 'Note (obbligatorie - inserisci la motivazione)' : 'Note (opzionale)'}</label>
              <textarea
                id="lesson-notes"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={locationType === 'EXTRA' ? 'Motivazione obbligatoria per le Ore Extra...' : 'Note aggiuntive...'}
                rows={2}
                required={locationType === 'EXTRA'}
              />
            </div>

            {/* Warning when hours overflow */}
            {showWarning && (
              <div className="hours-warning" id="hours-overflow-warning">
                <div className="hours-warning-title">
                  ⚠️ Attenzione: Superamento Ore
                </div>
                <div className="hours-warning-text">
                  Questa lezione supera il monte ore disponibile per questa assegnazione.
                  Per procedere, inserisci una motivazione e conferma.
                </div>
                <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
                  <label htmlFor="override-reason">Motivazione del superamento</label>
                  <textarea
                    id="override-reason"
                    className="input"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Inserisci la motivazione..."
                    rows={2}
                    required={showWarning}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    marginTop: 'var(--space-sm)',
                    fontSize: 'var(--font-size-sm)',
                    cursor: 'pointer',
                    color: 'var(--accent-red)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={overrideConfirm}
                    onChange={(e) => setOverrideConfirm(e.target.checked)}
                    id="override-confirm-checkbox"
                  />
                  Confermo il superamento ore
                </label>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annulla
            </button>
            <button
              type="submit"
              className={`btn ${showWarning ? 'btn-danger' : 'btn-primary'}`}
              disabled={
                isSubmitting ||
                (locationType === 'EXTRA'
                  ? (!selectedCourseId || !date || !startTime || !endTime || !notes || (selectedCourse?.total_hours_extra || 0) <= 0)
                  : (!selectedAssignmentId || !date || !startTime || !endTime || (showWarning && (!overrideConfirm || !overrideReason)))
                )
              }
              id="btn-save-lesson"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner spinner-sm" /> Salvataggio...
                </>
              ) : showWarning ? (
                'Salva con Superamento'
              ) : editLesson ? (
                'Aggiorna Lezione'
              ) : (
                'Crea Lezione'
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
