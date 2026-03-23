import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auctionAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { fmtDateTime, fmtDate, fmtCurrency, getRankClass } from '../utils/format';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import CircularTimer from '../components/CircularTimer';

export default function AuctionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await auctionAPI.getDetails(id);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    socket.emit('join_auction', id);

    socket.on('bid_update', (update) => {
      setData(prev => prev ? {
        ...prev,
        auction: update.auction,
        ranked_bids: update.ranked_bids,
        logs: update.logs,
      } : prev);
    });

    socket.on('auction_closed', ({ auction }) => {
      setData(prev => prev ? { ...prev, auction } : prev);
    });

    socket.on('auction_activated', ({ auction }) => {
      setData(prev => prev ? { ...prev, auction } : prev);
    });

    return () => {
      socket.emit('leave_auction', id);
      socket.off('bid_update');
      socket.off('auction_closed');
      socket.off('auction_activated');
    };
  }, [id, fetchData]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div style={{ padding: 40, color: 'var(--text3)' }}>Auction not found.</div>;

  const { auction, ranked_bids, logs } = data;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '0 24px' }}>
      <div className="page-header" style={{ margin: 0, padding: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/buyer')}>← Back</button>
          <div>
            <h1 className="page-title">{auction.rfq_name}</h1>
            <div className="page-subtitle">#{auction.id} · {auction.buyer_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={`badge badge-${auction.status}`}>{auction.status.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="page-body" style={{ padding: '24px 0' }}>
        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 32, marginBottom: 24 }}>
          {/* Left: auction info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.95rem', marginBottom: 14 }}>Auction Info</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Pickup Date', val: fmtDate(auction.pickup_date) },
                  { label: 'Current End', val: fmtDateTime(auction.current_end_time), color: 'var(--accent2)' },
                  { label: 'Forced Close', val: fmtDateTime(auction.forced_end_time), color: 'var(--red)' },
                  { label: 'Lowest Bid', val: auction.lowest_bid ? fmtCurrency(auction.lowest_bid) : 'No bids', color: auction.lowest_bid ? 'var(--green)' : undefined },
                  { label: 'Trigger Window', val: `${auction.trigger_window} min` },
                  { label: 'Ext. Duration', val: `${auction.extension_duration} min` },
                ].map(({ label, val, color }) => (
                  <div key={label} className="detail-item">
                    <div className="detail-label">{label}</div>
                    <div className="detail-val" style={color ? { color } : {}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text3)', lineHeight: 1.5 }}>
                A bid in the last <strong style={{ color: 'var(--yellow)' }}>{auction.trigger_window} min</strong> that changes the L1 rank will extend the auction by <strong style={{ color: 'var(--yellow)' }}>{auction.extension_duration} min</strong>.
              </div>
            </div>
          </div>

          {/* Right: timer + rankings + logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <CircularTimer auction={auction} />

            <div>
              <div className="section-title">Supplier Rankings</div>
              <div className="card" style={{ padding: 0 }}>
                {ranked_bids.length === 0 ? (
                  <div className="empty-state" style={{ padding: '28px 24px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '1.8rem' }}>📊</div>
                    <div className="empty-state-title">No bids yet</div>
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
                          <th>Destination</th>
                          <th>Total</th>
                          <th>Transit</th>
                          <th>Valid Till</th>
                          <th>Bid Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked_bids.map(bid => (
                          <tr key={bid.id} style={bid.rank === 1 ? { background: 'rgba(34,211,160,0.04)' } : {}}>
                            <td><div className={`rank-badge ${getRankClass(bid.rank)}`}>{bid.rank_label}</div></td>
                            <td><div className="td-main">{bid.carrier_name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'DM Mono' }}>{bid.carrier_email}</div></td>
                            <td className="td-mono">{fmtCurrency(bid.freight_charges)}</td>
                            <td className="td-mono">{fmtCurrency(bid.origin_charges)}</td>
                            <td className="td-mono">{fmtCurrency(bid.destination_charges)}</td>
                            <td><span className={bid.rank === 1 ? 'price-main' : 'td-mono'}>{fmtCurrency(bid.total_amount)}</span></td>
                            <td className="td-mono">{bid.transit_time}</td>
                            <td className="td-mono">{fmtDate(bid.quote_validity)}</td>
                            <td className="td-mono" style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{fmtDateTime(bid.created_at)}</td>
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
                  <div style={{ color: 'var(--text3)', fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>No activity yet</div>
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
    </div>
  );
}
