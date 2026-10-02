import { useState, useEffect, FormEvent } from 'react';
import { adminApi, Period } from '../../api/client';

export default function PeriodManager() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsActive, setFormIsActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPeriods = () => {
    setLoading(true);
    adminApi.getPeriods()
      .then(setPeriods)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPeriods(); }, []);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormStartDate('');
    setFormEndDate('');
    setFormIsActive(false);
    setEditingPeriod(null);
    setShowForm(false);
  };

  const startEdit = (period: Period) => {
    setEditingPeriod(period);
    setFormName(period.name);
    setFormDescription(period.description || '');
    setFormStartDate(period.start_date);
    setFormEndDate(period.end_date);
    setFormIsActive(period.is_active);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const data = {
      name: formName,
      description: formDescription,
      start_date: formStartDate,
      end_date: formEndDate,
      is_active: formIsActive,
    };

    try {
      if (editingPeriod) {
        await adminApi.updatePeriod(editingPeriod.id, data);
        setSuccess('Periodo aggiornato con successo!');
      } else {
        await adminApi.createPeriod(data);
        setSuccess('Periodo creato con successo!');
      }
      resetForm();
      loadPeriods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il periodo "${name}"?`)) return;
    try {
      await adminApi.deletePeriod(id);
      setSuccess(`Periodo "${name}" eliminato`);
      loadPeriods();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <h2>📆 Gestione Periodi</h2>
        <button
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          id="btn-toggle-period-form"
        >
          {showForm ? 'Annulla' : '+ Nuovo Periodo'}
        </button>
      </div>

      {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}
      {success && <div className="alert alert-success mb-md">✅ {success}</div>}

      {showForm && (
        <div className="glass-card-static" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>
            {editingPeriod ? 'Modifica Periodo' : 'Nuovo Periodo'}
          </h4>
          <form onSubmit={handleSubmit} id="period-form">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="period-name">Nome</label>
                <input type="text" id="period-name" className="input" value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="es. Biennio 2025-2027" />
              </div>
              <div className="input-group">
                <label htmlFor="period-start">Data Inizio</label>
                <input type="date" id="period-start" className="input" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} required />
              </div>
              <div className="input-group">
                <label htmlFor="period-end">Data Fine</label>
                <input type="date" id="period-end" className="input" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
              <label htmlFor="period-description">Descrizione</label>
              <textarea id="period-description" className="input" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrizione opzionale..." rows={2} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} id="period-active" />
              Periodo Attivo
            </label>
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-period">
                {isSubmitting ? <><span className="spinner spinner-sm" /> Salvataggio...</> : editingPeriod ? 'Aggiorna' : 'Crea Periodo'}
              </button>
              {editingPeriod && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Annulla Modifica</button>
              )}
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table id="periods-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Inizio</th>
                <th>Fine</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td>
                    <strong>{period.name}</strong>
                    {period.description && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {period.description}
                      </div>
                    )}
                  </td>
                  <td>{new Date(period.start_date).toLocaleDateString('it-IT')}</td>
                  <td>{new Date(period.end_date).toLocaleDateString('it-IT')}</td>
                  <td>
                    <span className={`badge ${period.is_active ? 'badge-green' : 'badge-red'}`}>
                      {period.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(period)} id={`btn-edit-period-${period.id}`}>
                        ✏️ Modifica
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(period.id, period.name)} id={`btn-delete-period-${period.id}`}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {periods.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-xl)' }}>Nessun periodo trovato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
