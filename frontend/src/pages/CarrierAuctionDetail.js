import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auctionAPI, bidAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime, fmtDate, fmtCurrency, getRankClass } from '../utils/format';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import CircularTimer from '../components/CircularTimer';

export default function CarrierAuctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await auctionAPI.getDetails(id);
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    socket.emit('join_auction', id);
    socket.on('bid_update', (update) => {
      setData(prev => prev ? { ...prev, auction: update.auction, ranked_bids: update.ranked_bids, logs: update.logs } : prev);
    });
    socket.on('auction_closed', ({ auction }) => setData(prev => prev ? { ...prev, auction } : prev));
    return () => { socket.emit('leave_auction', id); socket.off('bid_update'); socket.off('auction_closed'); };
  }, [id, fetchData]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div style={{ padding: 40 }}>Not found.</div>;

  const { auction, ranked_bids, logs } = data;
  const myBestBid = ranked_bids.find(b => b.carrier_id === user.id);
  const canBid = auction.status === 'active';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '0 24px' }}>
      <div className="page-header" style={{ margin: 0, padding: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/carrier')}>← Back</button>
          <div>
            <h1 className="page-title">{auction.rfq_name}</h1>
            <div className="page-subtitle">#{auction.id}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={`badge badge-${auction.status}`}>{auction.status.replace('_', ' ')}</span>
          {canBid && (
            <button className="btn btn-primary" onClick={() => setShowBidModal(true)}>
              {myBestBid ? '↓ Bid Again' : '+ Place Bid'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ padding: '24px 0' }}>
        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 32, marginBottom: 24 }}>

          {/* Left: auction info + config + best bid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.95rem', marginBottom: 14 }}>Auction Info</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Pickup Date', val: fmtDate(auction.pickup_date) },
                  { label: 'Current End', val: fmtDateTime(auction.current_end_time), color: 'var(--accent2)' },
                  { label: 'Forced Close', val: fmtDateTime(auction.forced_end_time), color: 'var(--red)' },
                  { label: 'Lowest Bid', val: auction.lowest_bid ? fmtCurrency(auction.lowest_bid) : 'No bids', color: auction.lowest_bid ? 'var(--green)' : undefined },
                ].map(({ label, val, color }) => (
                  <div key={label} className="detail-item">
                    <div className="detail-label">{label}</div>
                    <div className="detail-val" style={color ? { color } : {}}>{val}</div>
                  </div>
                ))}
                {myBestBid && (
                  <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div className="detail-item">
                      <div className="detail-label" style={{ color: 'var(--green)' }}>Your Best Bid</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'DM Mono', color: 'var(--green)', fontWeight: 600 }}>{fmtCurrency(myBestBid.total_amount)}</span>
                        <span className={`rank-badge ${getRankClass(myBestBid.rank)}`} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>{myBestBid.rank_label}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg3)' }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.95rem', marginBottom: 14 }}>Configuration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="detail-item">
                  <div className="detail-label">Trigger Window</div>
                  <div className="detail-val">{auction.trigger_window} minutes</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Extension Duration</div>
                  <div className="detail-val">{auction.extension_duration} minutes</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text3)', lineHeight: 1.5 }}>
                A bid in the last <strong style={{ color: 'var(--yellow)' }}>{auction.trigger_window} min</strong> that changes the L1 rank will extend the auction by <strong style={{ color: 'var(--yellow)' }}>{auction.extension_duration} min</strong>.
              </div>
            </div>
          </div>

          {/* Right: timer + rankings + logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <CircularTimer auction={auction} />

            <div>
              <div className="section-title">Live Rankings</div>
              <div className="card" style={{ padding: 0 }}>
                {ranked_bids.length === 0 ? (
                  <div className="empty-state" style={{ padding: '28px 24px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '1.8rem' }}>📊</div>
                    <div className="empty-state-title">No bids yet</div>
                    {canBid && <div className="empty-state-sub">Be the first to bid!</div>}
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Carrier</th>
                          <th>Freight</th>
                          <th>Origin</th>
                          <th>Dest.</th>
                          <th>Total</th>
                          <th>Transit</th>
                          <th>Valid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked_bids.map(bid => (
                          <tr key={bid.id}
                            style={{
                              background: bid.carrier_id === user.id
                                ? 'rgba(108,99,255,0.06)'
                                : bid.rank === 1 ? 'rgba(34,211,160,0.04)' : undefined
                            }}
                          >
                            <td><div className={`rank-badge ${getRankClass(bid.rank)}`}>{bid.rank_label}</div></td>
                            <td>
                              <div className="td-main" style={bid.carrier_id === user.id ? { color: 'var(--accent2)' } : {}}>
                                {bid.carrier_name} {bid.carrier_id === user.id ? '(you)' : ''}
                              </div>
                            </td>
                            <td className="td-mono">{fmtCurrency(bid.freight_charges)}</td>
                            <td className="td-mono">{fmtCurrency(bid.origin_charges)}</td>
                            <td className="td-mono">{fmtCurrency(bid.destination_charges)}</td>
                            <td><span className={bid.rank === 1 ? 'price-main' : 'td-mono'}>{fmtCurrency(bid.total_amount)}</span></td>
                            <td className="td-mono">{bid.transit_time}</td>
                            <td className="td-mono">{fmtDate(bid.quote_validity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div className="section-title">Activity Log</div>
              <div className="card" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: '0.875rem', textAlign: 'center' }}>No activity yet</div>
                ) : logs.map(log => (
                  <div key={log.id} className="log-item">
                    <span className={`log-action log-${log.action}`}>{log.action.replace(/_/g, ' ')}</span>
                    <span className="log-desc">{log.description}</span>
                    <span className="log-time">{fmtDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBidModal && (
        <BidModal
          auction={auction}
          myBestBid={myBestBid}
          onClose={() => setShowBidModal(false)}
          onBidSubmitted={(res) => {
            setData(prev => prev ? { ...prev, auction: res.auction, ranked_bids: res.ranked_bids } : prev);
            setShowBidModal(false);
          }}
        />
      )}
    </div>
  );
}

function BidModal({ auction, myBestBid, onClose, onBidSubmitted }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    carrier_name: user.name,
    freight_charges: myBestBid ? myBestBid.freight_charges : '',
    origin_charges: myBestBid ? myBestBid.origin_charges : '',
    destination_charges: myBestBid ? myBestBid.destination_charges : '',
    transit_time: myBestBid ? myBestBid.transit_time : '',
    quote_validity: myBestBid && myBestBid.quote_validity ? myBestBid.quote_validity.slice(0, 10) : '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const freight = parseFloat(form.freight_charges) || 0;
  const origin = parseFloat(form.origin_charges) || 0;
  const dest = parseFloat(form.destination_charges) || 0;
  const total = freight + origin + dest;

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (total <= 0) return setError('Total bid must be greater than 0');
    if (myBestBid && total >= parseFloat(myBestBid.total_amount)) {
      return setError(`Your bid must be less than your current best: ${fmtCurrency(myBestBid.total_amount)}`);
    }
    setLoading(true);
    try {
      const res = await bidAPI.submit(auction.id, form);
      onBidSubmitted(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{myBestBid ? 'Submit New Bid' : 'Place Bid'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {myBestBid && (
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            Your current best bid: <strong>{fmtCurrency(myBestBid.total_amount)}</strong> ({myBestBid.rank_label}). New bid must be lower.
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Carrier Name</label>
            <input className="form-input" name="carrier_name" value={form.carrier_name} onChange={handleChange} required />
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Freight Charges (₹)</label>
              <input className="form-input" type="number" name="freight_charges" min="0" step="0.01" placeholder="0.00" value={form.freight_charges} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Origin Charges (₹)</label>
              <input className="form-input" type="number" name="origin_charges" min="0" step="0.01" placeholder="0.00" value={form.origin_charges} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Destination Charges (₹)</label>
              <input className="form-input" type="number" name="destination_charges" min="0" step="0.01" placeholder="0.00" value={form.destination_charges} onChange={handleChange} />
            </div>
          </div>

          {/* Live total */}
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'DM Mono' }}>Total Bid</span>
            <span style={{ fontFamily: 'DM Mono', fontSize: '1.3rem', color: total > 0 ? 'var(--green)' : 'var(--text3)', fontWeight: 600 }}>
              {total > 0 ? fmtCurrency(total) : '₹0.00'}
            </span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Transit Time</label>
              <input className="form-input" name="transit_time" placeholder="e.g. 3-5 days" value={form.transit_time} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Quote Validity</label>
              <input className="form-input" type="date" name="quote_validity" value={form.quote_validity} onChange={handleChange} required />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || total <= 0}>
              {loading ? <><div className="spinner" /> Submitting...</> : `Submit Bid — ${fmtCurrency(total)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
