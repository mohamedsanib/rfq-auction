import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const isListingPage = location.pathname === '/buyer' || location.pathname === '/carrier';

  return (
    <div className="app-shell">
      <main className="main-content">{children}</main>

      {user && isListingPage && (
        <div className="bottom-left-user">
          <div className="user-info">
            <div className="user-name" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{user?.name}</div>
            <div className="user-role" style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user?.role}</div>
          </div>
          <button className="logout-btn" style={{ padding: '6px 12px', background: 'var(--red)', border: 'none', borderRadius: '50px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }} onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}
