import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'buyer' ? '/buyer' : '/carrier');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', background: 'var(--bg)', alignItems: 'center', justifyContent: 'center', padding: '40px'
    }}>
      <div style={{ 
        display: 'flex', flexDirection: 'row', width: '100%', maxWidth: '1000px', flexWrap: 'wrap', gap: '60px', alignItems: 'center'
      }}>
        {/* Left Side Text */}
        <div style={{
          flex: '1 1 300px', display: 'flex', flexDirection: 'column'
        }}>
          <h1 style={{ fontWeight: 800, fontSize: '48px', letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: '16px' }}>
            Welcome Back to RFQAuction.
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '18px', lineHeight: '1.6' }}>
            Sign in to continue to the most seamless bidding platform. Connect, bid, and manage your RFQs easily.
          </p>
        </div>

        {/* Right Side Form */}
        <div style={{
          flex: '1 1 400px', display: 'flex', flexDirection: 'column'
        }}>
          <div className="card" style={{ 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1), 0 10px 30px -10px rgba(0,0,0,0.05)', 
            border: 'none', borderRadius: '16px', padding: '40px', background: 'var(--surface)' 
          }}>
            <h2 style={{ fontWeight: 700, fontSize: '24px', marginBottom: '24px' }}>Sign in</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '12px', fontSize: '15px' }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--muted)', fontSize: '14px' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 700 }}>Register</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
