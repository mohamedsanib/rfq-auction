import { useState } from 'react';

export default function BidModal({ rfqId, existingBid, onClose, onSuccess }) {
  const [form, setForm] = useState({
    freight_charges: existingBid?.freight_charges || '',
    origin_charges: existingBid?.origin_charges || '',
    destination_charges: existingBid?.destination_charges || '',
    transit_time: existingBid?.transit_time || '',
    validity_of_quote: existingBid?.validity_of_quote?.split('T')[0] || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const total = (parseFloat(form.freight_charges) || 0) +
    (parseFloat(form.origin_charges) || 0) +
    (parseFloat(form.destination_charges) || 0);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/bids/${rfqId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess(data.bid);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'freight_charges', label: 'Freight Charges (₹)' },
    { key: 'origin_charges', label: 'Origin Charges (₹)' },
    { key: 'destination_charges', label: 'Destination Charges (₹)' },
    { key: 'transit_time', label: 'Transit Time (days)', type: 'number' },
    { key: 'validity_of_quote', label: 'Quote Validity', type: 'date' }
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card animate-in" style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontWeight: 800, fontSize: '20px' }}>
            {existingBid ? 'Update Bid' : 'Place Bid'}
          </h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 12px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {fields.map(f => (
            <div key={f.key} className="form-group">
              <label>{f.label}</label>
              <input
                type={f.type || 'number'}
                min="0"
                step={f.type === 'date' ? undefined : '0.01'}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          {total > 0 && (
            <div style={{
              background: 'var(--surface2)', borderRadius: '8px', padding: '12px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Total Cost</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '18px' }}>
                ₹{total.toFixed(2)}
              </span>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
            {loading ? 'Submitting...' : existingBid ? 'Update Bid' : 'Submit Bid'}
          </button>
        </div>
      </div>
    </div>
  );
}
