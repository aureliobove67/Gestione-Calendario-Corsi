import { useState, useEffect } from 'react';
import { adminApi, AuditEntry } from '../../api/client';

export default function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [entityType, setEntityType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadEntries = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (entityType) params.entity_type = entityType;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;

    adminApi.getAuditLog(params)
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEntries(); }, []);

  const handleSearch = () => { loadEntries(); };

  const getActionBadge = (action: string) => {
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

    // Helper to translate field names to Italian
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

  return (
    <div className="page-enter">
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>📋 Registro Attività</h2>

      {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}

      {/* Filters */}
      <div className="glass-card-static" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="input-group">
            <label htmlFor="audit-entity-type">Tipo Entità</label>
            <select id="audit-entity-type" className="input" value={entityType} onChange={(e) => setEntityType(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Tutti</option>
              <option value="lesson">Lezioni</option>
              <option value="course">Corsi</option>
              <option value="unit">Unità Formative</option>
              <option value="teacher">Docenti</option>
              <option value="assignment">Assegnazioni</option>
              <option value="period">Periodi</option>
              <option value="user">Utenti</option>
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="audit-from">Da</label>
            <input type="date" id="audit-from" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="audit-to">A</label>
            <input type="date" id="audit-to" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleSearch} id="btn-audit-search">
            🔍 Cerca
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table id="audit-table">
            <thead>
              <tr>
                <th>Data/Ora</th>
                <th>Utente</th>
                <th>Azione</th>
                <th>Tipo</th>
                <th>ID Entità</th>
                <th>Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)' }}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString('it-IT') : '-'}
                  </td>
                  <td>{entry.user_username || entry.user_name || `User #${entry.user_id}`}</td>
                  <td>
                    <span className={`badge ${getActionBadge(entry.action)}`}>
                      {getActionLabel(entry.action)}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{getEntityIcon(entry.entity_type)}</span>
                      <span>{getEntityLabel(entry.entity_type)}</span>
                    </span>
                  </td>
                  <td>{entry.entity_id}</td>
                  <td 
                    title={formatAuditDetails(entry)}
                    style={{ 
                      maxWidth: 400, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--text-secondary)' 
                    }}
                  >
                    {formatAuditDetails(entry)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-xl)' }}>Nessuna attività trovata</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
