import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  {
    section: 'Principale',
    links: [
      { to: '/admin', icon: '📊', label: 'Dashboard', end: true },
      { to: '/admin/calendar', icon: '📅', label: 'Calendario' },
      { to: '/admin/calendar?anomalies=true', icon: '⚠️', label: 'Anomalie' },
    ],
  },
  {
    section: 'Gestione',
    links: [
      { to: '/admin/courses', icon: '📚', label: 'Corsi' },
      { to: '/admin/teachers', icon: '👨‍🏫', label: 'Docenti' },
      { to: '/admin/periods', icon: '📆', label: 'Periodi' },
    ],
  },
  {
    section: 'Sistema',
    links: [
      { to: '/admin/users', icon: '👥', label: 'Utenti' },
      { to: '/admin/audit', icon: '📋', label: 'Registro Attività' },
      { to: '/admin/change-password', icon: '🔑', label: 'Cambia Password' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
            display: 'none',
          }}
        />
      )}
      <aside className={`sidebar${isOpen ? ' open' : ''}`} id="sidebar-nav">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">GC</div>
          <div className="sidebar-brand-text">
            Gestione Calendario
            <span>Pannello Admin</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? ' active' : ''}`
                  }
                  onClick={onClose}
                  id={`sidebar-link-${link.to.replace(/\//g, '-')}`}
                >
                  <span className="sidebar-link-icon">{link.icon}</span>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/"
            className="sidebar-link"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}
          >
            <span className="sidebar-link-icon">🌐</span>
            Vai al Calendario Pubblico
          </NavLink>
        </div>
      </aside>

      <style>{`
        @media (max-width: 1024px) {
          .sidebar-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
