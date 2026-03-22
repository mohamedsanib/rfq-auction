import { useState, useEffect } from 'react';
import { format } from 'date-fns';

function pad(n) { return String(n).padStart(2, '0'); }

export default function Countdown({ startTime, endTime, label = 'Closes in', onEnd }) {
  const [diff, setDiff] = useState(0);
  const [isPreStart, setIsPreStart] = useState(false);

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      if (startTime && now < new Date(startTime)) {
        setIsPreStart(true);
        setDiff(0);
        return;
      }
      setIsPreStart(false);
      const d = new Date(endTime) - now;
      setDiff(Math.max(0, d));
      if (d <= 0 && onEnd) onEnd();
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endTime, startTime, onEnd]);

  if (isPreStart) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)' }}>
          Bid Starts On
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '0.04em'
        }}>
          {format(new Date(startTime), 'MMM d, h:mm a')}
        </div>
      </div>
    );
  }

  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const isUrgent = diff < 5 * 60 * 1000 && diff > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)' }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: '28px',
        fontWeight: 700,
        color: diff === 0 ? 'var(--muted)' : isUrgent ? 'var(--danger)' : 'var(--text)',
        animation: isUrgent ? 'pulse 1s infinite' : 'none',
        letterSpacing: '0.04em'
      }}>
        {diff === 0 ? 'ENDED' : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`}
      </div>
    </div>
  );
}
