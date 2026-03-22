import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useRfqSocket } from '../hooks/useSocket';
import Countdown from '../components/Countdown';
import BidModal from '../components/BidModal';

function StatusTag({ status }) {
  return <span className={`tag tag-${status}`}>{status.replace('_', ' ')}</span>;
}

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
  return <span className={`rank-badge ${cls}`}>L{rank}</span>;
}

function BidsTable({ bids, myUserId, role }) {
  if (!bids.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', background: 'var(--surface2)', borderRadius: '8px' }}>
        No bids yet. Be the first!
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Rank', 'Carrier', 'Freight', 'Origin', 'Destination', 'Total', 'Transit', 'Valid Till'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, i) => {
            const isMe = bid.user_id === myUserId;
            return (
              <tr key={bid.id} className="animate-in"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: isMe ? 'rgba(232,255,71,0.04)' : 'transparent',
                  transition: 'background 0.2s'
                }}>
                <td style={{ padding: '12px 12px' }}><RankBadge rank={bid.rank} /></td>
                <td style={{ padding: '12px 12px', fontWeight: 600, fontSize: '14px' }}>
                  {role === 'buyer' ? bid.carrier_name : (isMe ? <span style={{ color: 'var(--accent)' }}>{bid.carrier_name} (you)</span> : `Carrier ${i + 1}`)}
                </td>
                <td style={{ padding: '12px 12px', fontFamily: 'var(--mono)', fontSize: '13px' }}>₹{parseFloat(bid.freight_charges).toFixed(2)}</td>
                <td style={{ padding: '12px 12px', fontFamily: 'var(--mono)', fontSize: '13px' }}>₹{parseFloat(bid.origin_charges).toFixed(2)}</td>
                <td style={{ padding: '12px 12px', fontFamily: 'var(--mono)', fontSize: '13px' }}>₹{parseFloat(bid.destination_charges).toFixed(2)}</td>
                <td style={{ padding: '12px 12px', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '15px', color: bid.rank === 1 ? 'var(--accent)' : 'var(--text)' }}>
                  ₹{parseFloat(bid.total_cost).toFixed(2)}
                </td>
                <td style={{ padding: '12px 12px', fontSize: '13px' }}>{bid.transit_time}d</td>
                <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--muted)' }}>
                  {format(new Date(bid.validity_of_quote), 'MMM d, yyyy')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LogEntry({ log }) {
  const isExtension = log.action === 'bid_extension';
  const isBid = log.action === 'bid';

  return (
    <div className="animate-in" style={{
      display: 'flex', gap: '12px', padding: '12px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
        background: isExtension ? 'var(--warn)' : isBid ? 'var(--accent2)' : 'var(--muted)'
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'var(--text)' }}>{log.description}</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
          {format(new Date(log.created_at), 'MMM d, h:mm:ss a')}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '2px 8px', borderRadius: '10px',
          background: isExtension ? 'rgba(255,179,71,0.1)' : 'rgba(71,200,255,0.1)',
          color: isExtension ? 'var(--warn)' : 'var(--accent2)'
        }}>
          {log.action.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

export default function RFQDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState(null);
  const [bids, setBids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [myBid, setMyBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);
  const [activeTab, setActiveTab] = useState('bids');

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/rfqs/${id}`, { credentials: 'include' });
    if (!res.ok) { navigate(-1); return; }
    const data = await res.json();
    setRfq(data.rfq);
    setBids(data.bids);
    setLogs(data.logs);
    setMyBid(data.myBid || null);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancelBid = async () => {
    const res = await fetch(`/api/bids/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setMyBid(null);
  };

  // Live socket updates
  useRfqSocket(id, {
    onBidsUpdated: ({ bids: newBids, logs: newLogs, newBid }) => {
      setBids(newBids);
      setLogs(newLogs);
      if (newBid && user?.role === 'carrier' && newBid.user_id === user.id) setMyBid(newBid);
    },
    onRfqUpdated: ({ rfq: updatedRfq }) => setRfq(updatedRfq),
    onAuctionEnded: () => fetchData()
  });

  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--muted)' }}>Loading...</div>;
  if (!rfq) return null;

  const canBid = user?.role === 'carrier' && rfq.status === 'active';
  const lowestBid = bids[0];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '14px', cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ← Back
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 style={{ fontWeight: 800, fontSize: '26px', letterSpacing: '-0.02em' }}>{rfq.name}</h1>
              <StatusTag status={rfq.status} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Pickup: {format(new Date(rfq.pickup_date), 'MMMM d, yyyy')} &nbsp;·&nbsp;
              Trigger: {rfq.trigger_window}min &nbsp;·&nbsp; Extension: {rfq.extension_time}min
            </div>
          </div>
          {canBid && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => setShowBidModal(true)}>
                {myBid ? '↺ Update Bid' : '+ Place Bid'}
              </button>
              {myBid && (
                <button className="btn btn-danger" onClick={handleCancelBid}>
                  Cancel Bid
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        <StatCard label="Lowest Bid" value={lowestBid ? `₹${parseFloat(lowestBid.total_cost).toFixed(2)}` : '—'} color="var(--success)" />
        <StatCard label="Total Bids" value={bids.length} />
        <div className="card" style={{ padding: '16px 20px' }}>
          <Countdown startTime={rfq.status === 'draft' ? rfq.start_date : null} endTime={rfq.end_date} label="Bid Close" />
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', fontFamily: 'var(--mono)' }}>Forced Close</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warn)' }}>
            {format(new Date(rfq.forced_end_date), 'MMM d, h:mm a')}
          </div>
        </div>
        {myBid && user?.role === 'carrier' && (
          <StatCard label="My Bid" value={`₹${parseFloat(myBid.total_cost).toFixed(2)}`} color="var(--accent)" />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {['bids', 'logs'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: 'none', border: 'none', color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 700, fontSize: '14px', padding: '10px 20px', cursor: 'pointer',
            borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
            marginBottom: '-1px', textTransform: 'capitalize', letterSpacing: '0.04em',
            transition: 'color 0.2s', fontFamily: 'var(--font)'
          }}>
            {tab === 'bids' ? `Rankings (${bids.length})` : `Activity Log (${logs.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {activeTab === 'bids' && (
          <div style={{ padding: '20px' }}>
            <BidsTable bids={bids} myUserId={user?.id} role={user?.role} />
          </div>
        )}
        {activeTab === 'logs' && (
          <div style={{ padding: '20px' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No activity yet</div>
            ) : (
              logs.map(log => <LogEntry key={log.id} log={log} />)
            )}
          </div>
        )}
      </div>

      {showBidModal && (
        <BidModal
          rfqId={id}
          existingBid={myBid}
          onClose={() => setShowBidModal(false)}
          onSuccess={(bid) => setMyBid(bid)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', fontFamily: 'var(--mono)' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: color || 'var(--text)', fontFamily: 'var(--mono)' }}>{value}</div>
    </div>
  );
}
