import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';

function StatusTag({ status }) {
  return <span className={`tag tag-${status}`}>{status.replace('_', ' ')}</span>;
}

function CreateRFQForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', start_date: '', end_date: '', forced_end_date: '',
    pickup_date: '', trigger_window: 10, extension_time: 5
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data.rfq);
      setOpen(false);
      setForm({ name: '', start_date: '', end_date: '', forced_end_date: '', pickup_date: '', trigger_window: 10, extension_time: 5 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return (
    <button className="btn btn-primary" onClick={() => setOpen(true)}>
      + New RFQ
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="card animate-in" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontWeight: 800, fontSize: '20px' }}>Create RFQ</h2>
          <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: '4px 12px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label>RFQ Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Shipment Delhi → Mumbai" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Bid Start</label>
              <input type="datetime-local" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Bid Close</label>
              <input type="datetime-local" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Forced Close</label>
              <input type="datetime-local" value={form.forced_end_date} onChange={e => setForm(p => ({ ...p, forced_end_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Pickup / Service Date</label>
              <input type="date" value={form.pickup_date} onChange={e => setForm(p => ({ ...p, pickup_date: e.target.value }))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Trigger Window (min)</label>
              <input type="number" min="1" value={form.trigger_window} onChange={e => setForm(p => ({ ...p, trigger_window: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Extension Time (min)</label>
              <input type="number" min="1" value={form.extension_time} onChange={e => setForm(p => ({ ...p, extension_time: e.target.value }))} />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Creating...' : 'Create RFQ'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RFQRow({ rfq, onActivate }) {
  const navigate = useNavigate();

  return (
    <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', marginBottom: '12px' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      onClick={() => navigate(`/rfq/${rfq.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '16px' }}>{rfq.name}</h3>
            <StatusTag status={rfq.status} />
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Stat label="Close" value={format(new Date(rfq.end_date), 'MMM d, h:mm a')} />
            <Stat label="Forced Close" value={format(new Date(rfq.forced_end_date), 'MMM d, h:mm a')} />
            <Stat label="Pickup" value={format(new Date(rfq.pickup_date), 'MMM d, yyyy')} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {rfq.lowest_bid && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lowest Bid</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--success)', fontSize: '18px' }}>
                ₹{parseFloat(rfq.lowest_bid).toFixed(2)}
              </div>
            </div>
          )}
          {rfq.status === 'draft' && (
            <button className="btn btn-primary" style={{ fontSize: '13px', padding: '7px 14px' }}
              onClick={e => { e.stopPropagation(); onActivate(rfq.id); }}>
              Activate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function BuyerDashboard() {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rfqs', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setRfqs(data.rfqs || []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (rfq) => setRfqs(p => [rfq, ...p]);

  const handleActivate = async (id) => {
    const res = await fetch(`/api/rfqs/${id}/activate`, { method: 'PATCH', credentials: 'include' });
    const data = await res.json();
    if (res.ok) setRfqs(p => p.map(r => r.id === id ? data.rfq : r));
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '28px', letterSpacing: '-0.02em' }}>My RFQs</h1>
          <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '14px' }}>{rfqs.length} auctions</p>
        </div>
        <CreateRFQForm onCreated={handleCreated} />
      </div>

      {loading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '48px' }}>Loading...</div>}

      {!loading && rfqs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>No RFQs yet</div>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>Create your first auction to get started</div>
        </div>
      )}

      {rfqs.map(rfq => (
        <RFQRow key={rfq.id} rfq={rfq} onActivate={handleActivate} />
      ))}
    </div>
  );
}
