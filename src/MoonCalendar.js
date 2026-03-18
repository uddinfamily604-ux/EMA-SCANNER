// MoonCalendar.jsx — ATM Machine v6.0
// Drop into your tab list alongside existing tabs
import React, { useState } from 'react';

// ─── Moon Phase Engine ───────────────────────────────────────────────────────
function getMoonPhase(year, month, day) {
  const date = new Date(year, month, day);
  const known = new Date(2000, 0, 6); // Known new moon
  const diff = (date - known) / (1000 * 60 * 60 * 24);
  const cycle = 29.53058867;
  const pos = ((diff % cycle) + cycle) % cycle;
  const illum = pos / cycle;
  if (pos < 1.85)  return { phase: 'New Moon',        sym: '🌑', illum: 0,     market: 'Low energy — reversals possible',      tradeBias: 'neutral' };
  if (pos < 7.38)  return { phase: 'Waxing Crescent', sym: '🌒', illum,        market: 'Building momentum',                    tradeBias: 'bullish' };
  if (pos < 9.22)  return { phase: 'First Quarter',   sym: '🌓', illum: 0.5,   market: 'Decision point — momentum shift',      tradeBias: 'neutral' };
  if (pos < 14.77) return { phase: 'Waxing Gibbous',  sym: '🌔', illum,        market: 'Increasing volatility',                tradeBias: 'bullish' };
  if (pos < 16.61) return { phase: 'Full Moon',        sym: '🌕', illum: 1.0,   market: 'Peak energy — high vol, reversal zone', tradeBias: 'reversal' };
  if (pos < 22.15) return { phase: 'Waning Gibbous',  sym: '🌖', illum,        market: 'Distribution phase',                   tradeBias: 'bearish' };
  if (pos < 23.99) return { phase: 'Last Quarter',    sym: '🌗', illum: 0.5,   market: 'Correction risk elevated',             tradeBias: 'bearish' };
  return             { phase: 'Waning Crescent', sym: '🌘', illum,        market: 'Consolidation / low energy',           tradeBias: 'bearish' };
}

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function getMoonSign(year, month, day) {
  const date = new Date(year, month, day);
  const base = new Date(2000, 0, 1);
  const days = (date - base) / (1000 * 60 * 60 * 24);
  const idx = ((Math.floor((days * 13.1763) % 360 / 30) % 12) + 12) % 12;
  return ZODIAC_SIGNS[idx];
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MoonCalendar({ onDateSelect }) {
  const today = new Date();
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOWS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const changeMonth = (delta) => {
    let m = curMonth + delta, y = curYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurMonth(m); setCurYear(y);
  };

  const firstDow = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const prevMonthDays = new Date(curYear, curMonth, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    let d, m, y;
    if (i < firstDow) { d = prevMonthDays - firstDow + i + 1; m = curMonth - 1; y = curYear; }
    else if (i >= firstDow + daysInMonth) { d = i - firstDow - daysInMonth + 1; m = curMonth + 1; y = curYear; }
    else { d = i - firstDow + 1; m = curMonth; y = curYear; }
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { d, m, y, current: m === curMonth };
  });

  const handleDayClick = (cell) => {
    const key = `${cell.y}-${cell.m}-${cell.d}`;
    setSelected(key);
    if (onDateSelect) onDateSelect(cell.y, cell.m, cell.d);
  };

  const biasColor = (bias) => ({ bullish: '#639922', bearish: '#e24b4a', reversal: '#ef9f27', neutral: '#888' }[bias] || '#888');

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 17, fontWeight: 500 }}>{MONTHS[curMonth]} {curYear}</span>
        <button onClick={() => changeMonth(1)} style={{ background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 16 }}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DOWS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: '#888', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((cell, i) => {
          const moon = getMoonPhase(cell.y, cell.m, cell.d);
          const sign = getMoonSign(cell.y, cell.m, cell.d);
          const isToday = cell.d === today.getDate() && cell.m === today.getMonth() && cell.y === today.getFullYear();
          const key = `${cell.y}-${cell.m}-${cell.d}`;
          const isSelected = selected === key;
          return (
            <div
              key={i}
              onClick={() => handleDayClick(cell)}
              title={`${moon.phase} in ${sign}\n${moon.market}`}
              style={{
                borderRadius: 8,
                padding: '5px 2px',
                textAlign: 'center',
                cursor: 'pointer',
                minHeight: 62,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                opacity: cell.current ? 1 : 0.3,
                background: isSelected ? '#d0e8ff' : isToday ? '#e6f1fb' : 'transparent',
                border: isSelected ? '1px solid #3a80c9' : isToday ? '1px solid #4a90d9' : '0.5px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500 }}>{cell.d}</span>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{moon.sym}</span>
              <span style={{ fontSize: 9, color: '#666', lineHeight: 1.2 }}>{sign.slice(0,3)}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: biasColor(moon.tradeBias), marginTop: 1 }} />
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        {[['🌑','New Moon'],['🌓','1st Quarter'],['🌕','Full Moon'],['🌗','Last Quarter'],['🌒','Waxing'],['🌘','Waning']].map(([s,l]) => (
          <span key={l} style={{ fontSize: 11, color: '#777', display: 'flex', alignItems: 'center', gap: 3 }}>{s} {l}</span>
        ))}
        <span style={{ fontSize: 11, color: '#777', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#639922', display: 'inline-block' }} /> Bull
        </span>
        <span style={{ fontSize: 11, color: '#777', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e24b4a', display: 'inline-block' }} /> Bear
        </span>
        <span style={{ fontSize: 11, color: '#777', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef9f27', display: 'inline-block' }} /> Reversal
        </span>
      </div>

      {/* Click hint */}
      <p style={{ fontSize: 11, color: '#aaa', marginTop: 8, textAlign: 'center' }}>Click any day to open Market Oracle for that date</p>
    </div>
  );
}
