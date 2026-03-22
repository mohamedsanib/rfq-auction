import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Countdown from '../components/Countdown';

function StatusTag({ status }) {
  return <span className={`tag tag-${status}`}>{status.replace('_', ' ')}</span>;
}

function RFQCard({ rfq }) {
  const navigate = useNavigate();

  return (
    <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      onClick={() => navigate(`/rfq/${rfq.id}`)}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>{rfq.name}</h3>
          <StatusTag status={rfq.status} />
        </div>
        {rfq.lowest_bid ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Lowest Bid</div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--success)', fontSize: '20px' }}>
              ₹{parseFloat(rfq.lowest_bid).toFixed(2)}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>No bids yet</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Bid Close</div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{format(new Date(rfq.end_date), 'MMM d, h:mm a')}</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Forced Close</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warn)' }}>{format(new Date(rfq.forced_end_date), 'MMM d, h:mm a')}</div>
        </div>
      </div>

      {(rfq.status === 'active' || rfq.status === 'draft') && (
        <Countdown startTime={rfq.status === 'draft' ? rfq.start_date : null} endTime={rfq.end_date} label="Time Remaining" />
      )}
    </div>
  );
}

export default function CarrierDashboard() {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/rfqs', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setRfqs(data.rfqs || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' 
    ? rfqs 
    : filter === 'closed' 
      ? rfqs.filter(r => r.status === 'closed' || r.status === 'force_closed')
      : rfqs.filter(r => r.status === filter);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'closed', label: 'Closed / Forced Closed' },
    { key: 'draft', label: 'Draft' },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontWeight: 800, fontSize: '28px', letterSpacing: '-0.02em' }}>Auctions</h1>
        <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '14px' }}>Browse and bid on active RFQs</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {filters.map(f => (
          <button key={f.key}
            className={`btn ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setFilter(f.key)}>
            {f.label}
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>
              {f.key === 'all' 
                ? rfqs.length 
                : f.key === 'closed'
                  ? rfqs.filter(r => r.status === 'closed' || r.status === 'force_closed').length
                  : rfqs.filter(r => r.status === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '48px' }}>Loading...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>No auctions found</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {filtered.map(rfq => <RFQCard key={rfq.id} rfq={rfq} />)}
      </div>
    </div>
  );
}
