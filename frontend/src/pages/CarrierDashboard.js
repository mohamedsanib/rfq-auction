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
        <div className="td-mono" style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>#{auction.id} · by {auction.buyer_name}</div>
      </td>
      <td><span className={`badge badge-${auction.status}`}>{auction.status.replace('_', ' ')}</span></td>
      <td className="td-mono">{auction.lowest_bid ? fmtCurrency(auction.lowest_bid) : <span style={{ color: 'var(--text3)' }}>No bids</span>}</td>
      <td>
        {auction.status === 'active' && countdown && !countdown.expired
          ? <span style={{ fontFamily: 'DM Mono', fontSize: '0.85rem', color: countdown.total < 300000 ? 'var(--red)' : 'var(--accent2)' }}>{formatCountdown(countdown)}</span>
          : <span className="td-mono">{fmtDateTime(auction.current_end_time)}</span>}
      </td>
      <td className="td-mono">{fmtDateTime(auction.forced_end_time)}</td>
    </tr>
  );
}

export default function CarrierDashboard() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const fetchAuctions = useCallback(async () => {
    try {
      const res = await auctionAPI.getAllAuctions();
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
      if (['active','closed','force_closed'].includes(auction.status)) {
        setAuctions(prev => {
          const idx = prev.findIndex(a => a.id === auction.id);
          if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...auction }; return n; }
          return [auction, ...prev];
        });
      }
    });
    socket.on('auction_activated', ({ auction }) => {
      setAuctions(prev => {
        const idx = prev.findIndex(a => a.id === auction.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...auction }; return n; }
        return [auction, ...prev];
      });
    });
    return () => { socket.off('auction_list_update'); socket.off('auction_activated'); };
  }, [fetchAuctions]);

  const filtered = filter === 'all' ? auctions : auctions.filter(a => a.status === filter);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Available Auctions</h1>
          <div className="page-subtitle">Browse and bid on RFQ auctions</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'active', 'closed', 'force_closed'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">No auctions found</div>
              <div className="empty-state-sub">{filter !== 'all' ? 'Try changing the filter' : 'Check back later for new auctions'}</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Auction</th>
                    <th>Status</th>
                    <th>Lowest Bid</th>
                    <th>Ends / Ended</th>
                    <th>Forced Close</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <AuctionRow key={a.id} auction={a} onClick={() => navigate(`/carrier/auction/${a.id}`)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
