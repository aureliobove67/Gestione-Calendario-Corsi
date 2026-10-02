import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, publicApi, Course, Period, Teacher, AuditEntry, CourseDetail, PeriodProgress } from '../../api/client';
import CourseCard from './CourseCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [anomaliesCount, setAnomaliesCount] = useState<{ total: number; critical: number; warnings: number } | null>(null);
  const [periodProgress, setPeriodProgress] = useState<PeriodProgress | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Expand state for courses chart
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [courseDetails, setCourseDetails] = useState<Record<number, CourseDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<number, boolean>>({});

  // Load periods
  useEffect(() => {
    adminApi.getPeriods()
      .then((data) => {
        const activeOnly = data.filter((p) => p.is_active);
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

  // Load data when period changes
  useEffect(() => {
    if (!selectedPeriodId) return;
    setLoading(true);
    setLogsLoading(true);
    
    Promise.all([
      publicApi.getCourses(selectedPeriodId),
      publicApi.getTeachers(selectedPeriodId),
      adminApi.getAuditLog({ limit: '5' }),
      adminApi.getAnomalies(selectedPeriodId).catch(() => null),
      publicApi.getProgress(selectedPeriodId).catch(() => null)
    ])
      .then(([coursesData, teachersData, logsData, anomaliesData, progressData]) => {
        setCourses(coursesData);
        setTeachers(teachersData);
        setAuditLogs(logsData);
        if (anomaliesData) {
          setAnomaliesCount({
            total: anomaliesData.total,
            critical: anomaliesData.critical,
            warnings: anomaliesData.warnings
          });
        } else {
          setAnomaliesCount(null);
        }
        setPeriodProgress(progressData || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setLogsLoading(false);
      });
  }, [selectedPeriodId]);

  const activeReminders = useMemo(() => {
    return courses.filter((course) => {
      const hasNonContractHours = (course.total_hours_webinar || 0) > 0 ||
                                 (course.total_hours_fad || 0) > 0 ||
                                 (course.total_hours_stage || 0) > 0;
      if (!hasNonContractHours || !course.non_contract_deadline) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const deadlineDate = new Date(course.non_contract_deadline);
      deadlineDate.setHours(0, 0, 0, 0);

      return today <= deadlineDate;
    });
  }, [courses]);

  // Compute period global progress from server data
  const globalStats = useMemo(() => {
    if (periodProgress) {
      return {
        totalHours: periodProgress.total_hours,
        scheduledHours: periodProgress.scheduled_hours,
        remainingHours: periodProgress.remaining_hours,
        globalPercent: periodProgress.progress_percent,
        today: periodProgress.today,
      };
    }
    // Fallback if progress endpoint not available
    return {
      totalHours: 0,
      scheduledHours: 0,
      remainingHours: 0,
      globalPercent: 0,
      today: new Date().toISOString().split('T')[0],
    };
  }, [periodProgress]);

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE': return 'badge-green';
      case 'UPDATE': return 'badge-yellow';
      case 'DELETE': return 'badge-red';
      default: return 'badge-blue';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE': return 'Creazione';
      case 'UPDATE': return 'Modifica';
      case 'DELETE': return 'Eliminazione';
      default: return action;
    }
  };

  const getEntityLabel = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'lesson': return 'Lezione';
      case 'course': return 'Corso';
      case 'unit': return 'Unità Formativa';
      case 'teacher': return 'Docente';
      case 'assignment': return 'Assegnazione';
      case 'period': return 'Periodo';
      case 'user': return 'Utente';
      default: return type;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'lesson': return '📅';
      case 'course': return '📚';
      case 'unit': return '📖';
      case 'teacher': return '👨‍🏫';
      case 'assignment': return '🔗';
      case 'period': return '📆';
      case 'user': return '👥';
      default: return '📝';
    }
  };

  const formatAuditDetails = (entry: AuditEntry): string => {
    const action = entry.action;
    const type = entry.entity_type;
    const oldVal = entry.old_values;
    const newVal = entry.new_values;

    if (!oldVal && !newVal) return '-';

    const formatLocation = (loc: string) => {
      switch (loc) {
        case 'AULA': return 'Aula';
        case 'PW': return 'Project Work';
        case 'WEBINAR': return 'Webinar';
        case 'FAD': return 'FAD';
        case 'STAGE': return 'Stage';
        default: return loc;
      }
    };

    const formatDateStr = (dStr: string) => {
      if (!dStr) return '';
      try {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return new Date(dStr).toLocaleDateString('it-IT');
      } catch {
        return dStr;
      }
    };

    const translateField = (field: string): string => {
      switch (field) {
        case 'code': return 'Codice';
        case 'name': return 'Nome';
        case 'description': return 'Descrizione';
        case 'total_hours_aula': return 'Ore Aula';
        case 'total_hours_pw': return 'Ore Project Work';
        case 'total_hours_webinar': return 'Ore Webinar';
        case 'total_hours_fad': return 'Ore FAD';
        case 'total_hours_stage': return 'Ore Stage';
        case 'non_contract_deadline': return 'Scadenza non contrattuale';
        case 'contracted_hours': return 'Ore contrattualizzate';
        case 'total_hours': return 'Ore totali';
        case 'organization': return 'Organizzazione';
        case 'email': return 'Email';
        case 'phone': return 'Telefono';
        case 'date': return 'Data';
        case 'start_time': return 'Ora inizio';
        case 'end_time': return 'Ora fine';
        case 'hours': return 'Ore';
        case 'location_type': return 'Tipo di lezione';
        case 'notes': return 'Note';
        case 'username': return 'Nome utente';
        case 'display_name': return 'Nome visualizzato';
        case 'role': return 'Ruolo';
        case 'is_active': return 'Stato attivo';
        case 'start_date': return 'Data inizio';
        case 'end_date': return 'Data fine';
        default: return field;
      }
    };

    const getChangedFields = () => {
      if (!oldVal || !newVal) return '';
      const changes: string[] = [];
      const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
      
      const ignoredKeys = ['password_hash', 'created_at', 'created_by', 'updated_at', 'updated_by', 'id', 'period_id', 'course_id', 'unit_id', 'teacher_id', 'assignment_id'];
      
      allKeys.forEach(k => {
        if (ignoredKeys.includes(k)) return;
        const oldRaw = oldVal[k];
        const newRaw = newVal[k];
        
        if (JSON.stringify(oldRaw) !== JSON.stringify(newRaw)) {
          let oldStr = oldRaw === null || oldRaw === undefined ? 'vuoto' : String(oldRaw);
          let newStr = newRaw === null || newRaw === undefined ? 'vuoto' : String(newRaw);
          
          if (k === 'location_type') {
            oldStr = formatLocation(oldStr);
            newStr = formatLocation(newStr);
          }
          if (k === 'date' || k === 'start_date' || k === 'end_date' || k === 'non_contract_deadline') {
            if (oldRaw) oldStr = formatDateStr(oldRaw);
            if (newRaw) newStr = formatDateStr(newRaw);
          }
          if (k === 'is_active') {
            oldStr = oldRaw ? 'Attivo' : 'Inattivo';
            newStr = newRaw ? 'Attivo' : 'Inattivo';
          }
          
          changes.push(`${translateField(k)}: da "${oldStr}" a "${newStr}"`);
        }
      });
      return changes.join(', ');
    };

    switch (type.toLowerCase()) {
      case 'lesson': {
        if (action === 'CREATE') {
          return `Lezione inserita: il ${formatDateStr(newVal.date)} dalle ${newVal.start_time || ''} alle ${newVal.end_time || ''} (${newVal.hours || 0}h) in ${formatLocation(newVal.location_type)}`;
        }
        if (action === 'DELETE') {
          return `Lezione rimossa: del ${formatDateStr(oldVal.date)} (${oldVal.hours || 0}h) in ${formatLocation(oldVal.location_type)}`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `Lezione modificata (ID: ${entry.entity_id})${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
      case 'course': {
        if (action === 'CREATE') {
          return `Nuovo corso creato: [${newVal.code || ''}] ${newVal.name || ''}`;
        }
        if (action === 'DELETE') {
          return `Corso eliminato: [${oldVal.code || ''}] ${oldVal.name || ''}`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `Corso ${newVal.code || oldVal.code || ''} modificato${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
      case 'unit': {
        if (action === 'CREATE') {
          return `Nuova UF creata: "${newVal.name || ''}" (${newVal.contracted_hours || 0}h)`;
        }
        if (action === 'DELETE') {
          return `UF eliminata: "${oldVal.name || ''}"`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `UF "${newVal.name || oldVal.name || ''}" modificata${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
      case 'teacher': {
        if (action === 'CREATE') {
          return `Nuovo docente registrato: ${newVal.name || ''} ${newVal.organization ? `(${newVal.organization})` : ''}`;
        }
        if (action === 'DELETE') {
          return `Docente eliminato: ${oldVal.name || ''}`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `Docente "${newVal.name || oldVal.name || ''}" modificato${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
      case 'assignment': {
        if (action === 'CREATE') {
          return `Assegnata UF a Docente: ${newVal.total_hours || 0}h contrattualizzate`;
        }
        if (action === 'DELETE') {
          return `Assegnazione rimossa: erano ${oldVal.total_hours || 0}h`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `Assegnazione modificata${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
      case 'period': {
        if (action === 'CREATE') {
          return `Nuovo periodo accademico creato: ${newVal.name || ''}`;
        }
        if (action === 'DELETE') {
          return `Periodo accademico eliminato: ${oldVal.name || ''}`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `Periodo "${newVal.name || oldVal.name || ''}" modificato${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
      case 'user': {
        if (action === 'CREATE') {
          return `Nuovo utente admin creato: ${newVal.username || ''}`;
        }
        if (action === 'DELETE') {
          return `Utente admin eliminato: ${oldVal.username || ''}`;
        }
        if (action === 'UPDATE') {
          const changes = getChangedFields();
          return `Utente "${newVal.username || oldVal.username || ''}" modificato${changes ? `: [${changes}]` : ''}`;
        }
        break;
      }
    }

    if (action === 'CREATE') return `Creazione entità ${type} (ID: ${entry.entity_id})`;
    if (action === 'DELETE') return `Cancellazione entità ${type} (ID: ${entry.entity_id})`;
    if (action === 'UPDATE') {
      const changes = getChangedFields();
      return `Modifica entità ${type} (ID: ${entry.entity_id})${changes ? `: [${changes}]` : ''}`;
    }

    return '-';
  };

  const handleToggleExpand = (courseId: number) => {
    const isExpanding = expandedCourseId !== courseId;
    setExpandedCourseId(isExpanding ? courseId : null);

    if (isExpanding && !courseDetails[courseId]) {
      setDetailsLoading(prev => ({ ...prev, [courseId]: true }));
      publicApi.getCourseDetail(courseId)
        .then(detail => {
          setCourseDetails(prev => ({ ...prev, [courseId]: detail }));
        })
        .catch(err => {
          console.error("Errore nel caricamento del dettaglio corso:", err);
        })
        .finally(() => {
          setDetailsLoading(prev => ({ ...prev, [courseId]: false }));
        });
    }
  };

  if (loading && periods.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg" />
        <p>Caricamento dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* CSS in-component styles to avoid breaking layout and deliver rich aesthetics */}
      <style>{`
        .db-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-xl);
          flex-wrap: wrap;
          gap: var(--space-md);
        }
        
        .db-main-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: var(--space-lg);
          margin-bottom: var(--space-xl);
        }
        
        @media (max-width: 1024px) {
          .db-main-grid {
            grid-template-columns: 1fr;
          }
        }
        
        /* Stats Panel */
        .premium-stat-card {
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }
        
        .stat-flex-container {
          display: flex;
          align-items: center;
          gap: var(--space-lg);
          flex-wrap: wrap;
          margin-top: var(--space-md);
        }
        
        .progress-circle-wrapper {
          position: relative;
          width: 140px;
          height: 140px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .progress-circle-svg circle {
          transition: stroke-dashoffset 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .progress-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          min-width: 200px;
        }
        
        .electric-bar-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }
        
        .electric-bar-header {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-xs);
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .electric-bar-track {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-full);
          overflow: hidden;
          position: relative;
        }
        
        .electric-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 1.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
        }
        
        .electric-bar-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          animation: shimmer 1.5s infinite;
        }
        
        .electric-blue {
          background: linear-gradient(90deg, #1d4ed8, var(--accent-blue));
          box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
        }
        
        .electric-orange {
          background: linear-gradient(90deg, #ea580c, var(--accent-orange));
          box-shadow: 0 0 10px rgba(251, 146, 60, 0.3);
        }
        
        /* Quick Actions Panel */
        .actions-card {
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          height: 100%;
        }
        
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-sm);
          flex: 1;
        }
        
        .action-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
          padding: var(--space-md) var(--space-xs);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          transition: all var(--transition-spring);
          cursor: pointer;
          text-align: center;
        }
        
        .action-tile:hover {
          background: var(--bg-glass-hover);
          border-color: var(--accent-blue-dim);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 0 8px rgba(74, 158, 255, 0.1);
        }
        
        .action-tile:active {
          transform: translateY(-1px) scale(0.98);
        }
        
        .action-tile-icon {
          font-size: 1.5rem;
          margin-bottom: 2px;
          transition: transform var(--transition-fast);
        }
        
        .action-tile:hover .action-tile-icon {
          transform: scale(1.15) rotate(5deg);
        }
        
        .action-tile-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
        }
        
        .action-tile.action-anomaly {
          border-color: rgba(251, 191, 36, 0.2);
        }
        .action-tile.action-anomaly:hover {
          border-color: var(--accent-yellow);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 0 8px rgba(251, 191, 36, 0.15);
        }
        
        .action-tile.action-anomaly-critical {
          border-color: rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.02);
        }
        .action-tile.action-anomaly-critical:hover {
          border-color: var(--accent-red);
          background: rgba(248, 113, 113, 0.05);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 0 10px rgba(248, 113, 113, 0.2);
        }
        
        /* Activity Feed Timeline */
        .timeline-card {
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }
        
        .timeline-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          position: relative;
          padding-left: var(--space-md);
        }
        
        .timeline-container::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: var(--border-subtle);
        }
        
        .timeline-item {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-bottom: 2px;
        }
        
        .timeline-dot {
          position: absolute;
          left: -17px;
          top: 6px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }
        
        .dot-green { background-color: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
        .dot-yellow { background-color: var(--accent-yellow); box-shadow: 0 0 8px var(--accent-yellow); }
        .dot-red { background-color: var(--accent-red); box-shadow: 0 0 8px var(--accent-red); }
        .dot-blue { background-color: var(--accent-blue); box-shadow: 0 0 8px var(--accent-blue); }
        
        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-sm);
        }
        
        .timeline-user {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .timeline-time {
          font-size: 10px;
          color: var(--text-tertiary);
        }
        
        .timeline-desc {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          margin-top: 2px;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        /* Horizontal Progress Chart */
        .chart-card {
          padding: var(--space-lg);
          margin-bottom: var(--space-xl);
        }
        
        .chart-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }
        
        .chart-row {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: all var(--transition-base);
        }
        
        .chart-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--border-medium);
        }
        
        .chart-row-header {
          padding: var(--space-md);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-lg);
          cursor: pointer;
          flex-wrap: wrap;
        }
        
        .chart-course-info {
          flex: 1;
          min-width: 250px;
        }
        
        .chart-course-code {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--accent-blue);
          letter-spacing: 0.03em;
        }
        
        .chart-course-name {
          font-size: var(--font-size-base);
          font-weight: 600;
          margin-top: 1px;
          color: var(--text-primary);
        }
        
        .chart-progress-container {
          width: 320px;
          display: flex;
          align-items: center;
          gap: var(--space-md);
          min-width: 200px;
        }
        
        .chart-bar-outer {
          flex: 1;
          height: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-full);
          overflow: hidden;
          position: relative;
        }
        
        .chart-bar-inner {
          height: 100%;
          border-radius: var(--radius-full);
          position: relative;
          transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes chartFill {
          from { width: 0%; }
        }
        
        .chart-bar-fill-anim {
          animation: chartFill 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        .chart-bar-inner::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          animation: shimmer 2s infinite;
        }
        
        .chart-bar-red {
          background: linear-gradient(90deg, #dc2626, var(--accent-red));
          box-shadow: 0 0 6px rgba(248, 113, 113, 0.25);
        }
        .chart-bar-orange {
          background: linear-gradient(90deg, #ea580c, var(--accent-orange));
          box-shadow: 0 0 6px rgba(251, 146, 60, 0.25);
        }
        .chart-bar-green {
          background: linear-gradient(90deg, #059669, var(--accent-green));
          box-shadow: 0 0 6px rgba(52, 211, 153, 0.25);
        }
        .chart-bar-blue {
          background: linear-gradient(90deg, #1d4ed8, var(--accent-blue));
          box-shadow: 0 0 6px rgba(74, 158, 255, 0.25);
        }
        
        .chart-percent-text {
          font-size: var(--font-size-sm);
          font-weight: 700;
          width: 45px;
          text-align: right;
        }
        
        .chart-hours-label {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          white-space: nowrap;
          min-width: 110px;
          text-align: right;
        }
        
        .chart-row-expander {
          font-size: 0.8rem;
          color: var(--text-secondary);
          transition: transform var(--transition-base);
          padding: var(--space-xs);
        }
        
        .chart-row-expander.expanded {
          transform: rotate(180deg);
        }
        
        .chart-row-details {
          border-top: 1px solid var(--border-subtle);
          background: rgba(0, 0, 0, 0.1);
          padding: var(--space-md);
          animation: slideDown 250ms ease;
        }
        
        .unit-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-md);
        }
        
        .unit-detail-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: var(--space-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }
        
        .unit-detail-name {
          font-weight: 600;
          font-size: var(--font-size-sm);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      {/* Header */}
      <div className="db-header">
        <div>
          <h2>📊 Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Panoramica sull'avanzamento dei corsi, pianificazione ore e attività di sistema.
          </p>
        </div>
        <select
          className="input"
          style={{ width: 'auto', minWidth: 220 }}
          value={selectedPeriodId || ''}
          onChange={(e) => {
            const val = Number(e.target.value);
            setSelectedPeriodId(val);
            localStorage.setItem('selectedPeriodId', String(val));
          }}
          id="dashboard-period-select"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.is_active ? '(Attivo)' : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Premium Dashboard Upper Grid */}
      <div className="db-main-grid">
        
        {/* Card 1: Global Period Progress */}
        <div className="glass-card premium-stat-card">
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ Avanzamento Globale Periodo
          </h3>
          
          <div className="stat-flex-container">
            <div className="progress-circle-wrapper">
              <svg width="140" height="140" viewBox="0 0 160 160" className="progress-circle-svg">
                <circle
                  cx="80"
                  cy="80"
                  r="65"
                  fill="transparent"
                  stroke="var(--bg-tertiary)"
                  strokeWidth="8"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="65"
                  fill="transparent"
                  stroke="url(#db-progress-gradient)"
                  strokeWidth="10"
                  strokeDasharray="408.4"
                  strokeDashoffset={408.4 - (408.4 * globalStats.globalPercent) / 100}
                  strokeLinecap="round"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                  }}
                />
                <defs>
                  <linearGradient id="db-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-blue)" />
                    <stop offset="100%" stopColor="var(--accent-purple)" />
                  </linearGradient>
                </defs>
                <text
                  x="50%"
                  y="46%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="24"
                  fontWeight="700"
                >
                  {globalStats.globalPercent}%
                </text>
                <text
                  x="50%"
                  y="63%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="9"
                  fontWeight="600"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Pianificato
                </text>
              </svg>
            </div>
            
            <div className="progress-details">
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Ore Totali Periodo (al {new Date(globalStats.today + 'T00:00:00').toLocaleDateString('it-IT')})
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {globalStats.scheduledHours}h <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', fontWeight: '400' }}>su {globalStats.totalHours}h previste</span>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Aula + Webinar + FAD + PW + Stage (escluse scadenze superate)
                </div>
              </div>
              
              {/* Single unified bar */}
              <div className="electric-bar-group">
                <div className="electric-bar-header">
                  <span>Avanzamento ad oggi</span>
                  <span>{globalStats.scheduledHours}/{globalStats.totalHours}h ({globalStats.globalPercent}%)</span>
                </div>
                <div className="electric-bar-track" style={{ height: '10px' }}>
                  <div className="electric-bar-fill electric-blue" style={{ width: `${globalStats.globalPercent}%` }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <span>✅ Erogate: <strong style={{ color: 'var(--accent-green)' }}>{globalStats.scheduledHours}h</strong></span>
                <span>⏳ Rimanenti: <strong style={{ color: 'var(--accent-yellow)' }}>{globalStats.remainingHours}h</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Quick Actions & Live Activity side-by-side inside right main slot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          
          {/* Quick Actions Panel */}
          <div className="glass-card actions-card">
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)' }}>
              ⚡ Azioni Rapide
            </h3>
            <div className="actions-grid">
              <div className="action-tile" onClick={() => navigate('/admin/calendar?newLesson=true')}>
                <span className="action-tile-icon">➕</span>
                <span className="action-tile-label">Nuova Lezione</span>
              </div>
              
              <div 
                className={`action-tile ${anomaliesCount && anomaliesCount.total > 0 ? 'action-anomaly-critical' : 'action-anomaly'}`} 
                onClick={() => navigate('/admin/calendar?anomalies=true')}
              >
                <span className="action-tile-icon">⚠️</span>
                <span className="action-tile-label">
                  {anomaliesCount && anomaliesCount.total > 0 
                    ? `Anomalie (${anomaliesCount.total})` 
                    : 'Nessuna Anomalia'}
                </span>
                {anomaliesCount && anomaliesCount.total > 0 && (
                  <span style={{ fontSize: '9px', color: 'var(--accent-red)', fontWeight: '600' }}>
                    {anomaliesCount.critical} Critiche | {anomaliesCount.warnings} Warning
                  </span>
                )}
              </div>
              
              <div className="action-tile" onClick={() => navigate('/admin/courses')}>
                <span className="action-tile-icon">📚</span>
                <span className="action-tile-label">Gestisci Corsi</span>
              </div>
              
              <div className="action-tile" onClick={() => navigate('/admin/audit')}>
                <span className="action-tile-icon">📋</span>
                <span className="action-tile-label">Attività</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Middle Panel: Live Activity Feed (Full width timeline) */}
      <div className="glass-card timeline-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⏳ Attività di Sistema Recenti
        </h3>
        
        {logsLoading ? (
          <div className="loading-container" style={{ padding: 'var(--space-lg)' }}><div className="spinner" /></div>
        ) : auditLogs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-lg)', fontSize: 'var(--font-size-sm)' }}>
            Nessuna attività registrata di recente.
          </div>
        ) : (
          <div className="timeline-container" style={{ margin: 'var(--space-xs) 0' }}>
            {auditLogs.map((log) => {
              let dotColor = 'dot-blue';
              if (log.action === 'CREATE') dotColor = 'dot-green';
              if (log.action === 'UPDATE') dotColor = 'dot-yellow';
              if (log.action === 'DELETE') dotColor = 'dot-red';
              
              return (
                <div key={log.id} className="timeline-item">
                  <div className={`timeline-dot ${dotColor}`} />
                  <div className="timeline-header">
                    <span className="timeline-user">
                      👤 {log.user_username || log.user_name || `Utente #${log.user_id}`}
                    </span>
                    <span className="timeline-time">
                      ⏱️ {log.timestamp ? new Date(log.timestamp).toLocaleString('it-IT') : '-'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span className={`badge ${getActionBadgeClass(log.action)}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                      {getActionLabel(log.action)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {getEntityIcon(log.entity_type)} <span>{getEntityLabel(log.entity_type)}</span> (ID: {log.entity_id})
                    </span>
                  </div>
                  <div className="timeline-desc" title={formatAuditDetails(log)}>
                    {formatAuditDetails(log)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Non-Contract Hours Reminders */}
      {activeReminders.length > 0 && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔔 Promemoria Ore Non da Contratto
          </h3>
          <div className="flex-col gap-sm">
            {activeReminders.map((course) => {
              const deadline = new Date(course.non_contract_deadline!);
              const formattedDeadline = deadline.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
              
              // Calculate remaining days
              const diffTime = deadline.getTime() - new Date().setHours(0,0,0,0);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const daysText = diffDays === 0 ? "scade OGGI" : diffDays === 1 ? "scade domani" : `scade tra ${diffDays} giorni`;

              return (
                <div key={course.id} className="alert alert-warning" style={{ borderLeft: '4px solid var(--accent-yellow)', display: 'flex', flexDirection: 'column', gap: '4px', padding: 'var(--space-md)', background: 'var(--accent-yellow-dim)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      📚 {course.code} - {course.name}
                    </span>
                    <span className="badge badge-red" style={{ fontSize: '10px' }}>
                      ⏳ Scadenza: {formattedDeadline} ({daysText})
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0 0' }}>
                    Questo corso prevede ore promemoria non contrattualizzate:
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: '4px', flexWrap: 'wrap' }}>
                    {course.total_hours_webinar ? (
                      <span className="badge badge-purple" style={{ padding: '4px 8px' }}>
                        💻 Webinar: {course.used_hours_webinar || 0} / {course.total_hours_webinar}h
                      </span>
                    ) : null}
                    {course.total_hours_fad ? (
                      <span className="badge badge-teal" style={{ padding: '4px 8px' }}>
                        🌐 FAD: {course.used_hours_fad || 0} / {course.total_hours_fad}h
                      </span>
                    ) : null}
                    {course.total_hours_stage ? (
                      <span className="badge badge-green" style={{ padding: '4px 8px' }}>
                        🏢 Stage: {course.used_hours_stage || 0} / {course.total_hours_stage}h
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Courses Dynamic Section */}
      <div className="glass-card chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)' }}>
            📊 Stato Avanzamento Corsi (Aula + PW)
          </h3>
          <span className="badge badge-blue">
            {courses.length} Corsi
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <div className="empty-text">Nessun corso per questo periodo</div>
          </div>
        ) : (
          <div className="chart-list">
            {courses
              .slice()
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((course) => {
                const cContracted = (course.total_hours_aula || 0) + (course.total_hours_pw || 0);
                const cScheduled = (course.used_hours_aula || 0) + (course.used_hours_pw || 0);
                const pct = cContracted > 0 ? Math.min(100, Math.round((cScheduled / cContracted) * 100)) : 0;
                
                // Color based on safety thresholds
                let barColorClass = 'chart-bar-green';
                if (pct < 30) barColorClass = 'chart-bar-red';
                else if (pct < 75) barColorClass = 'chart-bar-orange';
                else if (pct > 100) barColorClass = 'chart-bar-blue'; // Overflow
                
                const isExpanded = expandedCourseId === course.id;

                return (
                  <div key={course.id} className="chart-row">
                    <div className="chart-row-header" onClick={() => handleToggleExpand(course.id)}>
                      <div className="chart-course-info">
                        <div className="chart-course-code">{course.code}</div>
                        <div className="chart-course-name">{course.name}</div>
                      </div>

                      <div className="chart-progress-container">
                        <div className="chart-bar-outer">
                          <div 
                            className={`chart-bar-inner chart-bar-fill-anim ${barColorClass}`} 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                        <span className="chart-percent-text">{pct}%</span>
                      </div>

                      <div className="chart-hours-label">
                        {cScheduled} / {cContracted} ore
                      </div>

                      <div className={`chart-row-expander ${isExpanded ? 'expanded' : ''}`}>
                        ▼
                      </div>
                    </div>

                    {/* Collapsible Details Panel (Accordion) */}
                    {isExpanded && (
                      <div className="chart-row-details">
                        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-md)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-sm)' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            🏛️ Ore Aula: <strong>{course.used_hours_aula || 0} / {course.total_hours_aula || 0}h</strong>
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            💼 Ore Project Work (PW): <strong>{course.used_hours_pw || 0} / {course.total_hours_pw || 0}h</strong>
                          </span>
                          {(course.total_hours_webinar || 0) > 0 && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                              💻 Webinar: <strong>{course.used_hours_webinar || 0} / {course.total_hours_webinar}h</strong>
                            </span>
                          )}
                          {(course.total_hours_fad || 0) > 0 && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                              🌐 FAD: <strong>{course.used_hours_fad || 0} / {course.total_hours_fad}h</strong>
                            </span>
                          )}
                          {(course.total_hours_stage || 0) > 0 && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                              🏢 Stage: <strong>{course.used_hours_stage || 0} / {course.total_hours_stage}h</strong>
                            </span>
                          )}
                        </div>

                        {detailsLoading[course.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: 'var(--space-xl)', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            <div className="spinner spinner-sm" />
                            <span>Caricamento docenti e lezioni calendarizzate...</span>
                          </div>
                        ) : courseDetails[course.id] ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                              📖 Articolazione UF, Docenti e Calendario:
                            </div>
                            
                            {courseDetails[course.id].units && courseDetails[course.id].units.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                {courseDetails[course.id].units.map((unit) => (
                                  <div 
                                    key={unit.unit_id} 
                                    style={{ 
                                      background: 'rgba(255, 255, 255, 0.01)', 
                                      border: '1px solid rgba(255, 255, 255, 0.04)', 
                                      borderRadius: 'var(--radius-md)', 
                                      padding: 'var(--space-md)' 
                                    }}
                                  >
                                    {/* Unit Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--space-sm)' }}>
                                      <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--accent-blue)' }}>
                                        📖 UF: {unit.unit_name}
                                      </span>
                                      <span className="badge badge-blue" style={{ fontSize: '10px' }}>
                                        Contratto: {unit.contracted_hours}h
                                      </span>
                                    </div>
                                    
                                    {/* Assigned Teachers list */}
                                    {unit.teachers && unit.teachers.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingLeft: 'var(--space-sm)' }}>
                                        {unit.teachers.map((teacher) => {
                                          const tPct = teacher.assigned_hours > 0 ? Math.min(100, Math.round((teacher.scheduled_hours / teacher.assigned_hours) * 100)) : 0;
                                          let tBarColor = 'progress-green';
                                          if (tPct < 30) tBarColor = 'progress-red';
                                          else if (tPct < 75) tBarColor = 'progress-yellow';
                                          
                                          return (
                                            <div key={teacher.teacher_id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                              
                                              {/* Teacher details & hours */}
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
                                                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                                  👨‍🏫 Docente: <strong>{teacher.teacher_name}</strong>
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                  Assegnate: <strong>{teacher.assigned_hours}h</strong> | Calendarizzate: <strong>{teacher.scheduled_hours}h</strong> | Residuo: <strong style={{ color: teacher.remaining_hours > 0 ? 'var(--accent-yellow)' : teacher.remaining_hours < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{teacher.remaining_hours}h</strong>
                                                </span>
                                              </div>
                                              
                                              {/* Teacher Progress Bar */}
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className={`progress-bar ${tBarColor}`} style={{ height: '5px', flex: 1 }}>
                                                  <div className="progress-bar-fill" style={{ width: `${tPct}%` }} />
                                                </div>
                                                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', width: '30px', textAlign: 'right' }}>{tPct}%</span>
                                              </div>
                                              
                                              {/* Cascaded Scheduled Days & Hours (Lessons) */}
                                              <div style={{ marginTop: 'var(--space-xs)', paddingLeft: 'var(--space-md)', borderLeft: '1.5px dashed rgba(255, 255, 255, 0.08)' }}>
                                                <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                                  📅 Lezioni Calendarizzate a cascata:
                                                </div>
                                                
                                                {teacher.lessons && teacher.lessons.length > 0 ? (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {teacher.lessons
                                                      .slice()
                                                      .sort((a, b) => a.date.localeCompare(b.date))
                                                      .map((lesson) => {
                                                        const lDate = new Date(lesson.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
                                                        const formattedDate = lDate.charAt(0).toUpperCase() + lDate.slice(1);
                                                        
                                                        let locationBadgeClass = 'badge-blue';
                                                        if (lesson.location_type === 'PW') locationBadgeClass = 'badge-orange';
                                                        else if (lesson.location_type === 'WEBINAR') locationBadgeClass = 'badge-purple';
                                                        else if (lesson.location_type === 'FAD') locationBadgeClass = 'badge-teal';
                                                        else if (lesson.location_type === 'STAGE') locationBadgeClass = 'badge-green';

                                                        return (
                                                          <div 
                                                            key={lesson.id} 
                                                            style={{ 
                                                              display: 'flex', 
                                                              alignItems: 'center', 
                                                              justifyContent: 'space-between', 
                                                              padding: '4px 8px', 
                                                              background: 'rgba(255, 255, 255, 0.015)', 
                                                              border: '1px solid rgba(255, 255, 255, 0.03)', 
                                                              borderRadius: 'var(--radius-sm)', 
                                                              fontSize: '11px' 
                                                            }}
                                                          >
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                              <span style={{ color: 'var(--text-primary)' }}>📅 {formattedDate}</span>
                                                              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                                                              <span style={{ color: 'var(--text-secondary)' }}>⏱️ {lesson.start_time} - {lesson.end_time} <strong>({lesson.hours}h)</strong></span>
                                                            </span>
                                                            <span className={`badge ${locationBadgeClass}`} style={{ fontSize: '8.5px', padding: '1px 5px', fontWeight: '700' }}>
                                                              {lesson.location_type}
                                                            </span>
                                                          </div>
                                                        );
                                                      })}
                                                  </div>
                                                ) : (
                                                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '2px 0' }}>
                                                    Nessuna lezione calendarizzata per questo docente in questa UF.
                                                  </div>
                                                )}
                                              </div>
                                              
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '11px', color: 'var(--accent-red)', fontWeight: '600', paddingLeft: 'var(--space-sm)' }}>
                                        ⚠️ Nessun docente assegnato a questa Unità Formativa.
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: 'var(--space-md)' }}>
                                Nessuna Unità Formativa configurata per questo corso.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--accent-red)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-md)' }}>
                            ⚠️ Impossibile caricare il dettaglio del corso. Riprova più tardi.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
