import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      // Force navigate even on error
      navigate('/login');
    }
  };

  const initials = user?.display_name
    ? user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <header className="header" id="admin-header">
      <div className="header-left">
        <button
          className="btn btn-ghost btn-icon mobile-menu-btn"
          onClick={onMenuToggle}
          id="btn-menu-toggle"
          aria-label="Toggle menu"
          style={{ display: 'none' }}
        >
          ☰
        </button>
        <h2 className="header-title" style={{ fontSize: 'var(--font-size-base)' }}>
          Pannello di Amministrazione
        </h2>
      </div>

      <div className="header-right">
        <div className="header-user" id="header-user-info">
          <div className="header-user-avatar">{initials}</div>
          <span>{user?.display_name || 'Admin'}</span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          id="btn-logout"
        >
          🚪 Esci
        </button>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-menu-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </header>
  );
}
