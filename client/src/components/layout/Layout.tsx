import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="admin-content page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
