import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '60px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <Link to="/" style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em' }}>
        RFQ<span style={{ color: 'var(--accent)' }}>Auction</span>
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{user.role}</div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '6px 14px', fontSize: '13px' }}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
