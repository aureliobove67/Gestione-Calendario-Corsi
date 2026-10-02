import { useState, useEffect, FormEvent } from 'react';
import { adminApi, AdminUser } from '../../api/client';

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    adminApi.getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await adminApi.createUser({
        username: newUsername,
        password: newPassword,
        display_name: newDisplayName,
      });
      setSuccess('Utente creato con successo!');
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Errore nella creazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${username}"?`)) return;
    setError('');
    try {
      await adminApi.deleteUser(id);
      setSuccess(`Utente "${username}" eliminato`);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <h2>👥 Gestione Utenti</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          id="btn-toggle-user-form"
        >
          {showForm ? 'Annulla' : '+ Nuovo Utente'}
        </button>
      </div>

      {error && <div className="alert alert-error mb-md">⚠️ {error}</div>}
      {success && <div className="alert alert-success mb-md">✅ {success}</div>}

      {/* Create form */}
      {showForm && (
        <div className="glass-card-static" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Nuovo Utente Admin</h4>
          <form onSubmit={handleCreate} id="create-user-form">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="new-user-display-name">Nome Visualizzato</label>
                <input
                  type="text"
                  id="new-user-display-name"
                  className="input"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                  placeholder="es. Mario Rossi"
                />
              </div>
              <div className="input-group">
                <label htmlFor="new-user-username">Nome Utente</label>
                <input
                  type="text"
                  id="new-user-username"
                  className="input"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  placeholder="es. mario.rossi"
                />
              </div>
              <div className="input-group">
                <label htmlFor="new-user-password">Password</label>
                <input
                  type="password"
                  id="new-user-password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Min. 6 caratteri"
                  minLength={6}
                />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-md)' }}>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-create-user">
                {isSubmitting ? <><span className="spinner spinner-sm" /> Creazione...</> : 'Crea Utente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table id="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome Visualizzato</th>
                <th>Nome Utente</th>
                <th>Creato il</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>
                    <div className="flex items-center gap-sm">
                      <div className="header-user-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                        {user.display_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      {user.display_name}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{user.username}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(user.id, user.username)}
                      id={`btn-delete-user-${user.id}`}
                    >
                      🗑️ Elimina
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-xl)' }}>
                    Nessun utente trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
