import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Credenziali non valide');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto var(--space-md)',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'white',
              boxShadow: 'var(--shadow-glow-strong)',
            }}
          >
            GC
          </div>
        </div>
        <h2>Accesso Admin</h2>
        <p className="login-subtitle">Gestione Calendario Corsi</p>

        {error && (
          <div className="alert alert-error" id="login-error">
            ⚠️ {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} id="login-form">
          <div className="input-group">
            <label htmlFor="login-username">Nome utente</label>
            <input
              type="text"
              id="login-username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Inserisci il nome utente"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Inserisci la password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={isSubmitting || !username || !password}
            id="btn-login-submit"
          >
            {isSubmitting ? (
              <>
                <span className="spinner spinner-sm" /> Accesso in corso...
              </>
            ) : (
              'Accedi'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          <Link
            to="/"
            style={{
              color: 'var(--text-tertiary)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            ← Torna al Calendario Pubblico
          </Link>
        </div>
      </div>
    </div>
  );
}
