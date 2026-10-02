import { useState, useEffect } from 'react';
import { adminApi, Anomaly, AnomaliesResponse } from '../../api/client';

interface AnomalyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: number;
}

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
};

const TYPE_LABELS: Record<string, string> = {
  CORSO_SENZA_UF: 'Corso senza UF',
  UF_SENZA_DOCENTE: 'UF senza Docente',
  ORE_DOCENTE_INFERIORI: 'Ore Docente Inferiori',
  ORE_DOCENTE_SUPERIORI: 'Ore Docente Superiori',
  SFORAMENTO_ORE_DOCENTE: 'Sforamento Ore Docente',
  SFORAMENTO_ORE_CORSO: 'Sforamento Ore Corso',
  ORE_UF_MISMATCH: 'Ore UF ≠ Contratto',
};

export default function AnomalyPanel({ isOpen, onClose, periodId }: AnomalyPanelProps) {
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !periodId) return;
    setLoading(true);
    setError('');
    adminApi.getAnomalies(periodId)
      .then(setData)
      .catch((err) => setError(err.message || 'Errore nel caricamento anomalie'))
      .finally(() => setLoading(false));
  }, [isOpen, periodId]);

  if (!isOpen) return null;

  // Group anomalies by course
  const groupedByCourse: Record<string, Anomaly[]> = {};
  if (data) {
    for (const a of data.anomalies) {
      const key = `${a.course_code || 'N/A'} — ${a.course_name}`;
      if (!groupedByCourse[key]) groupedByCourse[key] = [];
      groupedByCourse[key].push(a);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 700, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>⚠️ Anomalie del Periodo</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <div className="spinner spinner-lg" />
              <p style={{ marginLeft: 'var(--space-md)' }}>Analisi anomalie in corso...</p>
            </div>
          )}

          {error && (
            <div className="alert alert-error">⚠️ {error}</div>
          )}

          {data && !loading && (
            <>
              {/* Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
              }}>
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-md)',
                  background: data.total === 0 ? 'var(--accent-green-dim)' : 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: data.total === 0 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    {data.total}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Totale</div>
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-md)',
                  background: data.critical > 0 ? 'var(--accent-red-dim)' : 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${data.critical > 0 ? 'var(--border-error)' : 'var(--border-subtle)'}`,
                }}>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: data.critical > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {data.critical}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>🔴 Critiche</div>
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-md)',
                  background: data.warnings > 0 ? 'var(--accent-yellow-dim)' : 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: data.warnings > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                    {data.warnings}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>🟡 Avvisi</div>
                </div>
              </div>

              {data.total === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-2xl)',
                  color: 'var(--accent-green)',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>✅</div>
                  <h3 style={{ color: 'var(--accent-green)' }}>Nessuna anomalia rilevata!</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                    Tutti i corsi, le UF, le assegnazioni e le ore sono consistenti.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {Object.entries(groupedByCourse).map(([courseLabel, anomalies]) => (
                    <div key={courseLabel} style={{
                      background: 'var(--bg-glass)',
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
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)',
                      }}>
                        📚 {courseLabel}
                        <span className="badge" style={{
                          background: anomalies.some(a => a.severity === 'critical')
                            ? 'var(--accent-red-dim)'
                            : 'var(--accent-yellow-dim)',
                          color: anomalies.some(a => a.severity === 'critical')
                            ? 'var(--accent-red)'
                            : 'var(--accent-yellow)',
                          fontSize: '10px',
                          padding: '2px 6px',
                        }}>
                          {anomalies.length} {anomalies.length === 1 ? 'anomalia' : 'anomalie'}
                        </span>
                      </div>
                      <div style={{ padding: 'var(--space-sm)' }}>
                        {anomalies.map((a, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 'var(--space-sm)',
                              padding: 'var(--space-xs) var(--space-sm)',
                              borderBottom: idx < anomalies.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                              fontSize: 'var(--font-size-sm)',
                            }}
                          >
                            <span style={{ flexShrink: 0, fontSize: '14px' }}>{SEVERITY_ICONS[a.severity]}</span>
                            <div>
                              <div style={{
                                fontWeight: 600,
                                fontSize: '11px',
                                color: a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                marginBottom: '2px',
                              }}>
                                {TYPE_LABELS[a.type] || a.type}
                              </div>
                              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {a.detail}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}
