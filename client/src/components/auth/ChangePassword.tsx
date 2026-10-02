import { useState, FormEvent } from 'react';
import { authApi } from '../../api/client';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nuova password deve essere di almeno 6 caratteri');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess('Password cambiata con successo!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Errore nel cambio password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-enter">
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>🔑 Cambia Password</h2>

      <div
        className="glass-card-static"
        style={{ maxWidth: 480, padding: 'var(--space-xl)' }}
      >
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--space-md)' }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} id="change-password-form">
          <div className="flex-col gap-md">
            <div className="input-group">
              <label htmlFor="current-password">Password Attuale</label>
              <input
                type="password"
                id="current-password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Inserisci la password attuale"
              />
            </div>

            <div className="input-group">
              <label htmlFor="new-password">Nuova Password</label>
              <input
                type="password"
                id="new-password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Inserisci la nuova password"
                minLength={6}
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirm-password">Conferma Nuova Password</label>
              <input
                type="password"
                id="confirm-password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Ripeti la nuova password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              id="btn-change-password"
              style={{ marginTop: 'var(--space-sm)' }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner spinner-sm" /> Cambio in corso...
                </>
              ) : (
                'Cambia Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
