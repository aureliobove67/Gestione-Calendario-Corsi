import { useState, useEffect, FormEvent } from 'react';
import { adminApi, Teacher, Period } from '../../api/client';

export default function TeacherEditor() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formName, setFormName] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load periods on mount
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

  const loadTeachers = () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    adminApi.getTeachers(selectedPeriodId)
      .then(setTeachers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // Load teachers when selected period changes
  useEffect(() => {
    loadTeachers();
  }, [selectedPeriodId]);

  const resetForm = () => {
    setFormName('');
    setFormOrg('');
    setEditingTeacher(null);
    setShowForm(false);
  };

  const startEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormName(teacher.name);
    setFormOrg(teacher.organization || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const data = { 
        name: formName, 
        organization: formOrg || undefined,
        period_id: selectedPeriodId!
      };
      if (editingTeacher) {
        await adminApi.updateTeacher(editingTeacher.id, data);
        setSuccess('Docente aggiornato!');
      } else {
        await adminApi.createTeacher(data);
        setSuccess('Docente creato!');
      }
      resetForm();
      loadTeachers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Eliminare il docente "${name}"?`)) return;
    try {
      await adminApi.deleteTeacher(id);
      setSuccess(`Docente "${name}" eliminato`);
      loadTeachers();
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="page-enter">
      {/* Header with Period Select */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h2>👨‍🏫 Gestione Docenti</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Aggiungi e gestisci i docenti associati al periodo selezionato.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <select
            className="input"
            style={{ width: 'auto', minWidth: 200 }}
            value={selectedPeriodId || ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedPeriodId(val);
              localStorage.setItem('selectedPeriodId', String(val));
            }}
            id="teacher-period-select"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button 
            className="btn btn-primary" 
            onClick={() => { resetForm(); setShowForm(!showForm); }} 
            id="btn-toggle-teacher-form"
            disabled={!selectedPeriodId}
          >
            {showForm ? 'Annulla' : '+ Nuovo Docente'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}
      {success && <div className="alert alert-success mb-md">✅ {success}</div>}

      {showForm && selectedPeriodId && (
        <div className="glass-card-static" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>
            {editingTeacher ? 'Modifica Docente' : 'Nuovo Docente'}
          </h4>
          <form onSubmit={handleSubmit} id="teacher-form">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="teacher-name">Nome e Cognome</label>
                <input type="text" id="teacher-name" className="input" value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="es. Prof. Marco Bianchi" />
              </div>
              <div className="input-group">
                <label htmlFor="teacher-org">Organizzazione</label>
                <input type="text" id="teacher-org" className="input" value={formOrg} onChange={(e) => setFormOrg(e.target.value)} placeholder="es. Università di Milano (opzionale)" />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-teacher">
                {isSubmitting ? <><span className="spinner spinner-sm" /> Salvataggio...</> : editingTeacher ? 'Aggiorna' : 'Crea Docente'}
              </button>
              {editingTeacher && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Annulla</button>
              )}
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : !selectedPeriodId ? (
        <div className="empty-state">
          <div className="empty-icon">📆</div>
          <div className="empty-text">Seleziona o crea prima un periodo accademico attivo.</div>
        </div>
      ) : (
        <div className="table-container">
          <table id="teachers-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Organizzazione</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.id}</td>
                  <td><strong>{teacher.name}</strong></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{teacher.organization || '-'}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(teacher)} id={`btn-edit-teacher-${teacher.id}`}>✏️ Modifica</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(teacher.id, teacher.name)} id={`btn-delete-teacher-${teacher.id}`}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-xl)' }}>Nessun docente trovato per questo periodo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
