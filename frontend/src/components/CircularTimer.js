import React from 'react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { fmtDateTime } from '../utils/format';

export default function CircularTimer({ auction }) {
  const countdown = useCountdown(auction.status === 'active' ? auction.current_end_time : null);
  
  const isUrgent = countdown && !countdown.expired && countdown.total < 5 * 60 * 1000;
  
  if (auction.status !== 'active') {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, height: '100%', minHeight: 300 }}>
        <span style={{ fontSize: '3rem', opacity: 0.3, marginBottom: 16 }}>⏸</span>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text2)', marginBottom: 8 }}>
          {auction.status === 'draft' ? 'Not Started Yet' : 'Auction Ended'}
        </div>
        <span className={`badge badge-${auction.status}`}>{auction.status.replace('_', ' ')}</span>
      </div>
    );
  }

  // Calculate SVG progress visually by using the difference between start_time and current_end_time
  // Fallback to 1 hour if start_time is missing
  const start = auction.start_time ? new Date(auction.start_time).getTime() : new Date(auction.current_end_time).getTime() - 60*60*1000;
  const end = new Date(auction.current_end_time).getTime();
  const totalDuration = end - start;
  const currentRemaining = countdown && !countdown.expired ? countdown.total : 0;
  
  const fraction = Math.max(0, Math.min(1, currentRemaining / totalDuration));
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - fraction * circumference;

  let color = 'var(--green)';
  if (currentRemaining < 15 * 60 * 1000) color = 'var(--yellow)';
  if (currentRemaining < 5 * 60 * 1000) color = 'var(--red)';

  return (
    <div className={`card ${isUrgent ? 'urgent-pulse' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, height: '100%', minHeight: 350, borderColor: isUrgent ? 'rgba(255,69,58,0.3)' : 'var(--border)' }}>
      <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="240" height="240" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="120" cy="120" r={radius} fill="none" stroke="var(--bg3)" strokeWidth="10" />
          <circle cx="120" cy="120" r={radius} fill="none" stroke={color} strokeWidth="10" 
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }} 
          />
        </svg>
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div className="timer-label" style={{ marginBottom: 4 }}>Remaining</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '2.5rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>
            {countdown ? (countdown.expired ? '00:00:00' : formatCountdown(countdown)) : '--:--:--'}
          </div>
        </div>
      </div>
      {isUrgent && <div className="badge badge-force_closed" style={{ marginTop: 24, padding: '6px 14px' }}>⚡ Closing Soon</div>}
    </div>
  );
}
