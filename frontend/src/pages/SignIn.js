import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SignIn() {
  const [form, setForm] = useState({ email: '', password: '' });
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
      const res = await authAPI.signin(form);
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'buyer' ? '/buyer' : '/carrier');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign in failed');
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
          <p style={{ fontSize: '1.2rem', color: 'var(--text2)' }}>Welcome back</p>
        </div>

        {/* Right side form */}
        <div className="card" style={{ padding: 40, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" name="email" placeholder="you@company.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label">Password</label>
              <input className="form-input" type="password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} required />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={loading}>
              {loading ? <><div className="spinner" /> Authenticating...</> : 'Sign In'}
            </button>
          </form>

          <hr className="divider" style={{ margin: '32px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text3)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: 600 }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
