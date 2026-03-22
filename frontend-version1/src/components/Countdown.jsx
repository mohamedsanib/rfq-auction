import { useState, useEffect } from 'react';

function pad(n) { return String(n).padStart(2, '0'); }

export default function Countdown({ endTime, label = 'Closes in', onEnd }) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const calc = () => {
      const d = new Date(endTime) - new Date();
      setDiff(Math.max(0, d));
      if (d <= 0 && onEnd) onEnd();
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endTime]);

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
        color: diff === 0 ? 'var(--muted)' : isUrgent ? 'var(--danger)' : 'var(--accent)',
        animation: isUrgent ? 'pulse 1s infinite' : 'none',
        letterSpacing: '0.04em'
      }}>
        {diff === 0 ? 'ENDED' : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`}
      </div>
    </div>
  );
}
