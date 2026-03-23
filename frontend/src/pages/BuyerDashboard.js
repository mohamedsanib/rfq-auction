import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auctionAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { fmtDateTime, fmtCurrency } from '../utils/format';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';

function AuctionRow({ auction, onClick }) {
  const countdown = useCountdown(auction.status === 'active' ? auction.current_end_time : null);
  return (
    <tr onClick={onClick}>
      <td>
        <div className="td-main">{auction.rfq_name}</div>
        <div className="td-mono" style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>#{auction.id}</div>
      </td>
      <td><span className={`badge badge-${auction.status}`}>{auction.status.replace('_', ' ')}</span></td>
      <td className="td-mono">{auction.lowest_bid ? fmtCurrency(auction.lowest_bid) : <span style={{ color: 'var(--text3)' }}>No bids</span>}</td>
      <td className="td-mono">{auction.total_bids || 0}</td>
      <td>
        {auction.status === 'active' && countdown && !countdown.expired
          ? <span className={`mono ${countdown.total < 300000 ? 'text-urgent' : ''}`} style={{ color: countdown.total < 300000 ? 'var(--red)' : 'var(--accent2)', fontSize: '0.85rem' }}>{formatCountdown(countdown)}</span>
          : <span className="td-mono">{fmtDateTime(auction.current_end_time)}</span>}
      </td>
      <td className="td-mono" style={{ fontSize: '0.75rem' }}>{fmtDateTime(auction.forced_end_time)}</td>
    </tr>
  );
}

export default function BuyerDashboard() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const fetchAuctions = useCallback(async () => {
    try {
      const res = await auctionAPI.getMyAuctions();
      setAuctions(res.data.auctions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    const socket = getSocket();
    socket.on('auction_list_update', ({ auction }) => {
      setAuctions(prev => {
        const idx = prev.findIndex(a => a.id === auction.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...auction }; return n; }
        return [auction, ...prev];
      });
    });
    socket.on('auction_activated', ({ auction }) => {
      setAuctions(prev => {
        const idx = prev.findIndex(a => a.id === auction.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...auction }; return n; }
        return prev;
      });
    });
    return () => { socket.off('auction_list_update'); socket.off('auction_activated'); };
  }, [fetchAuctions]);

  const stats = {
    total: auctions.length,
    active: auctions.filter(a => a.status === 'active').length,
    draft: auctions.filter(a => a.status === 'draft').length,
    closed: auctions.filter(a => ['closed', 'force_closed'].includes(a.status)).length,
  };

  const filtered = filter === 'all' ? auctions : auctions.filter(a => a.status === filter);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Auctions</h1>
          <div className="page-subtitle">Manage your RFQ British Auctions</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'active', 'closed', 'force_closed'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Auction
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : auctions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⌘</div>
              <div className="empty-state-title">No auctions yet</div>
              <div className="empty-state-sub">Create your first RFQ auction to get started</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Auction</th>
                    <th>Status</th>
                    <th>Lowest Bid</th>
                    <th>Bids</th>
                    <th>Ends</th>
                    <th>Forced Close</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <AuctionRow key={a.id} auction={a} onClick={() => navigate(`/buyer/auction/${a.id}`)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && <CreateAuctionModal onClose={() => setShowModal(false)} onCreated={(a) => { setAuctions(prev => [a, ...prev]); setShowModal(false); }} />}
    </>
  );
}

function CreateAuctionModal({ onClose, onCreated }) {
  const pad = (d) => d.toISOString().slice(0, 16);
  const padDate = (d) => d.toISOString().slice(0, 10);
  const minDateTime = pad(new Date());
  const minDate = padDate(new Date());
  
  const [form, setForm] = useState({
    rfq_name: '',
    start_time: '',
    end_time: '',
    forced_end_time: '',
    pickup_date: '',
    trigger_window: 5,
    extension_duration: 5,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await auctionAPI.create(form);
      onCreated(res.data.auction);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Create New Auction</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">RFQ Auction Name</label>
            <input className="form-input" name="rfq_name" placeholder="e.g. Kerala to Mumbai — Oct 2024" value={form.rfq_name} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date & Time</label>
              <input className="form-input" type="datetime-local" name="start_time" min={minDateTime} value={form.start_time} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date & Time</label>
              <input className="form-input" type="datetime-local" name="end_time" min={form.start_time || minDateTime} value={form.end_time} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Forced End Date & Time</label>
              <input className="form-input" type="datetime-local" name="forced_end_time" min={form.end_time || minDateTime} value={form.forced_end_time} onChange={handleChange} required />
              <div className="form-hint">Must be after end time. Auction will never exceed this.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Pickup / Service Date</label>
              <input className="form-input" type="date" name="pickup_date" min={minDate} value={form.pickup_date} onChange={handleChange} required />
            </div>
          </div>

          <hr className="divider" />
          <div style={{ marginBottom: 8 }}>
            <div className="section-title">British Auction Configuration</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Trigger Window (minutes)</label>
              <input className="form-input" type="number" name="trigger_window" min="1" max="60" value={form.trigger_window} onChange={handleChange} required />
              <div className="form-hint">Monitor bids in last X minutes before close</div>
            </div>
            <div className="form-group">
              <label className="form-label">Extension Duration (minutes)</label>
              <input className="form-input" type="number" name="extension_duration" min="1" max="60" value={form.extension_duration} onChange={handleChange} required />
              <div className="form-hint">Extend auction by Y minutes when triggered</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /> Creating...</> : 'Create Auction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
