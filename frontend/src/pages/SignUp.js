import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SignUp() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'carrier' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.signup(form);
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'buyer' ? '/buyer' : '/carrier');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900, width: '100%', alignItems: 'center' }}>
        {/* Left side text info */}
        <div>
          <h1 style={{ fontSize: '2.5rem', color: 'var(--text)', marginBottom: 8 }}>RFQ Auction</h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text2)' }}>Create your account</p>
        </div>

        {/* Right side form */}
        <div className="card" style={{ padding: 40, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" type="text" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" name="email" placeholder="you@company.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" name="password" placeholder="Min 6 characters" value={form.password} onChange={handleChange} required minLength={6} />
            </div>
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label">Role</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {['buyer', 'carrier'].map(r => (
                  <label key={r} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{
                      padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${form.role === r ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.role === r ? 'var(--accent-glow)' : 'var(--bg2)',
                      color: form.role === r ? 'var(--accent2)' : 'var(--text)',
                      textAlign: 'center', fontWeight: 600, fontSize: '0.9rem',
                      transition: 'all 0.15s', textTransform: 'capitalize'
                    }}>
                      <input type="radio" name="role" value={r} checked={form.role === r} onChange={handleChange} style={{ display: 'none' }} />
                      {r === 'buyer' ? 'Buy' : 'Sell'}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={loading}>
              {loading ? <><div className="spinner" /> Processing...</> : 'Create Account'}
            </button>
          </form>

          <hr className="divider" style={{ margin: '32px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text3)' }}>
            Already have an account?{' '}
            <Link to="/signin" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
