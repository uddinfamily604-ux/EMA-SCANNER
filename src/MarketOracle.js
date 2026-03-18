// MarketOracle.jsx — ATM Machine v6.0
// Alo's Financial Astrology + Moon System → SPY daily bias
import React, { useState, useEffect } from 'react';

// ─── Engines (copy from MoonCalendar or import from shared utils) ─────────────
const ZODIAC = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function getMoonPhase(year, month, day) {
  const diff = (new Date(year, month, day) - new Date(2000, 0, 6)) / 86400000;
  const pos = ((diff % 29.53058867) + 29.53058867) % 29.53058867;
  if (pos < 1.85)  return { phase: 'New Moon',        sym: '🌑', tradeBias: 'neutral',  market: 'Low energy — reversals possible' };
  if (pos < 7.38)  return { phase: 'Waxing Crescent', sym: '🌒', tradeBias: 'bullish',  market: 'Building momentum' };
  if (pos < 9.22)  return { phase: 'First Quarter',   sym: '🌓', tradeBias: 'neutral',  market: 'Decision point — momentum shift' };
  if (pos < 14.77) return { phase: 'Waxing Gibbous',  sym: '🌔', tradeBias: 'bullish',  market: 'Increasing volatility' };
  if (pos < 16.61) return { phase: 'Full Moon',        sym: '🌕', tradeBias: 'reversal', market: 'Peak energy — high vol, reversal zone' };
  if (pos < 22.15) return { phase: 'Waning Gibbous',  sym: '🌖', tradeBias: 'bearish',  market: 'Distribution phase' };
  if (pos < 23.99) return { phase: 'Last Quarter',    sym: '🌗', tradeBias: 'bearish',  market: 'Correction risk elevated' };
  return             { phase: 'Waning Crescent', sym: '🌘', tradeBias: 'bearish',  market: 'Consolidation / low energy' };
}

function getMoonSign(year, month, day) {
  const days = (new Date(year, month, day) - new Date(2000, 0, 1)) / 86400000;
  return ZODIAC[((Math.floor((days * 13.1763) % 360 / 30) % 12) + 12) % 12];
}

const MOON_SIGN_DATA = {
  Aries:       { element: '🔥 Fire',  effect: 'Aggressive moves, momentum bursts',          bias: 0.60 },
  Taurus:      { element: '🌍 Earth', effect: 'Slow trend days, institutions active',        bias: 0.55 },
  Gemini:      { element: '💨 Air',   effect: 'Choppy, news-driven, gap fills',              bias: 0.50 },
  Cancer:      { element: '💧 Water', effect: 'Emotional, reversal-prone, Alo edge zone',   bias: 0.45 },
  Leo:         { element: '🔥 Fire',  effect: 'Strong directional, momentum follow-through', bias: 0.65 },
  Virgo:       { element: '🌍 Earth', effect: 'Precise, technical levels respected',         bias: 0.55 },
  Libra:       { element: '💨 Air',   effect: 'Indecisive, balanced buyers/sellers',         bias: 0.50 },
  Scorpio:     { element: '💧 Water', effect: 'Intense deep moves, Alo edge zone ⭐',        bias: 0.70 },
  Sagittarius: { element: '🔥 Fire',  effect: 'Gap and go energy, news catalysts amplified', bias: 0.60 },
  Capricorn:   { element: '🌍 Earth', effect: 'Institutional steady grind, EMA respect',    bias: 0.55 },
  Aquarius:    { element: '💨 Air',   effect: 'Unusual moves, surprises, tech sector',       bias: 0.50 },
  Pisces:      { element: '💧 Water', effect: 'Neptunian drift, dream-like, Alo edge zone', bias: 0.48 },
};

function getPlanetaryData(year, month, day) {
  const dayMs = new Date(year, month, day).getTime() / 86400000;
  const toSign = lon => ZODIAC[Math.floor(((lon % 360) + 360) % 360 / 30)];
  const sunSign    = toSign(dayMs * 0.9856 + 280.46);
  const mercSign   = toSign(dayMs * 4.0923 + 252.25);
  const venSign    = toSign(dayMs * 1.6021 + 181.98);
  const marsSign   = toSign(dayMs * 0.524  + 355.45);
  const jupSign    = toSign(dayMs * 0.0831 + 34.4);
  const satSign    = toSign(dayMs * 0.0334 + 50.1);
  const nepSign    = toSign(dayMs * 0.0061 + 284.0);
  const mercRetro  = Math.sin(dayMs * 0.0172) > 0.7;
  const satNepConj = Math.abs(((dayMs * 0.0334 + 50.1) % 360) - ((dayMs * 0.0061 + 284.0) % 360)) < 12;
  const eclipseZone = (Math.abs(dayMs % 173.3) < 10) || (Math.abs((dayMs % 173.3) - 86.65) < 10);

  return {
    mercRetro, satNepConj, eclipseZone,
    planets: [
      { icon: '☀', name: 'Sun',     sign: sunSign,                                   note: 'Overall market direction',              impact: 'neut' },
      { icon: '☿', name: 'Mercury', sign: mercSign + (mercRetro ? ' ℞' : ''),        note: mercRetro ? 'Retrograde — fakeouts, data errors' : 'Direct — clear execution', impact: mercRetro ? 'bear' : 'neut' },
      { icon: '♀', name: 'Venus',   sign: venSign,                                   note: 'Risk appetite, sector rotation',        impact: ['Taurus','Libra','Pisces'].includes(venSign) ? 'bull' : 'neut' },
      { icon: '♂', name: 'Mars',    sign: marsSign,                                  note: 'Momentum, aggression, volume',          impact: ['Aries','Leo','Scorpio'].includes(marsSign) ? 'bull' : 'neut' },
      { icon: '♃', name: 'Jupiter', sign: jupSign,                                   note: 'Expansion, bull trend amplifier',       impact: 'bull' },
      { icon: '♄', name: 'Saturn',  sign: satSign,                                   note: 'Resistance, discipline, contraction',   impact: ['Capricorn','Aquarius'].includes(satSign) ? 'neut' : 'bear' },
      { icon: '♆', name: 'Neptune', sign: nepSign,                                   note: 'Illusion, liquidity fog',               impact: satNepConj ? 'bear' : 'neut' },
    ]
  };
}

function calcBullBearScore(moon, moonSign, pData) {
  let score = 50;
  // Moon phase
  if (moon.tradeBias === 'bullish')  score += 8;
  if (moon.tradeBias === 'bearish')  score -= 6;
  if (moon.tradeBias === 'reversal') score += 3; // reversal = uncertain, slight edge to calls
  if (moon.phase === 'New Moon')     score -= 3;
  // Moon sign
  const sd = MOON_SIGN_DATA[moonSign] || { bias: 0.5 };
  score += (sd.bias - 0.5) * 28;
  // Planets
  if (pData.mercRetro)   score -= 8;
  if (pData.satNepConj)  score -= 6;
  if (pData.eclipseZone) score -= 4;
  return Math.max(18, Math.min(84, Math.round(score)));
}

// ─── Component ───────────────────────────────────────────────────────────────
const impactStyle = {
  bull: { background: '#eaf3de', color: '#3b6d11' },
  bear: { background: '#fcebeb', color: '#a32d2d' },
  neut: { background: '#f1efe8', color: '#5f5e5a' },
};
const impactLabel = { bull: 'Bullish', bear: 'Bearish', neut: 'Neutral' };

export default function MarketOracle({ initialDate = null }) {
  const today = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [dateStr, setDateStr] = useState(initialDate || fmt(today));
  const [notes, setNotes] = useState('');

  // Load saved notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`oracle-notes-${dateStr}`);
    setNotes(saved || '');
  }, [dateStr]);

  const saveNotes = (val) => {
    setNotes(val);
    localStorage.setItem(`oracle-notes-${dateStr}`, val);
  };

  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m-1, d).toLocaleDateString('en-US', { weekday: 'long' });
  const moon = getMoonPhase(y, m-1, d);
  const moonSign = getMoonSign(y, m-1, d);
  const signData = MOON_SIGN_DATA[moonSign] || { element: '?', effect: 'Unknown', bias: 0.5 };
  const pData = getPlanetaryData(y, m-1, d);
  const bullScore = calcBullBearScore(moon, moonSign, pData);
  const bearScore = 100 - bullScore;
  const verdict = bullScore >= 58 ? 'bullish' : bullScore <= 44 ? 'bearish' : 'neutral';
  const verdictConfig = {
    bullish: { icon: '📈', label: 'Bullish Lean', sub: 'Moon energy supports upside. Look for momentum entries on the long side.', bg: '#eaf3de', border: '#97c459', color: '#3b6d11' },
    bearish: { icon: '📉', label: 'Bearish Lean', sub: 'Caution — lunar energy favors sellers. Wait for confirmed breakdown.', bg: '#fcebeb', border: '#e24b4a', color: '#a32d2d' },
    neutral: { icon: '↔️', label: 'Neutral / Choppy', sub: 'Mixed signals. Trade small, respect S/R levels, wait for SHA+HalfTrend confluence.', bg: '#faeeda', border: '#ef9f27', color: '#854f0b' },
  }[verdict];

  const card = (label, val, sub) => (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Date picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>🔮 Market Oracle</span>
        <input
          type="date"
          value={dateStr}
          onChange={e => setDateStr(e.target.value)}
          style={{ padding: '6px 10px', border: '0.5px solid rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 13, background: 'white' }}
        />
      </div>

      {/* Top cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {card('Date', dow, new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))}
        {card('Moon Phase', `${moon.sym} ${moon.phase}`, moon.market)}
        {card('Moon Sign', `${moonSign}`, `${signData.element} — ${signData.effect}`)}
        {card('Mercury', pData.mercRetro ? '℞ Retrograde' : '→ Direct', pData.mercRetro ? 'Expect fakeouts — confirm before entry' : 'Clean execution expected')}
      </div>

      {/* Verdict */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: verdictConfig.bg, border: `0.5px solid ${verdictConfig.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{verdictConfig.icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: verdictConfig.color }}>{verdictConfig.label}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{verdictConfig.sub}</div>
        </div>
      </div>

      {/* Bull/Bear bars */}
      {[['Bull', bullScore, '#639922', '#eaf3de'], ['Bear', bearScore, '#e24b4a', '#fcebeb']].map(([lbl, pct, clr, bg]) => (
        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 14px', marginBottom: 6, border: '0.5px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 72, color: clr }}>{lbl} {pct}%</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: clr, borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}

      {/* Special alerts */}
      {(pData.satNepConj || pData.eclipseZone || pData.mercRetro) && (
        <div style={{ background: '#faeeda', border: '0.5px solid #ef9f27', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#633806', lineHeight: 1.6 }}>
          ⚠️ <strong>Active Alerts:</strong>
          {pData.satNepConj && ' Saturn-Neptune conjunction — market fog, regime change risk.'}
          {pData.eclipseZone && ' Eclipse window — heightened volatility, trend acceleration possible.'}
          {pData.mercRetro && ' Mercury Rx — false signals, confirm every entry.'}
        </div>
      )}

      {/* Planet table */}
      <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>Planetary Positions</div>
      <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
        {pData.planets.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < pData.planets.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, minWidth: 22 }}>{p.icon}</span>
            <span style={{ minWidth: 88, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
            <span style={{ minWidth: 90, fontSize: 13, color: '#555' }}>{p.sign}</span>
            <span style={{ flex: 1, fontSize: 11, color: '#777' }}>{p.note}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 500, ...impactStyle[p.impact] }}>{impactLabel[p.impact]}</span>
          </div>
        ))}
      </div>

      {/* Alo's Trading Rules */}
      <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>Alo's Rules For This Day</div>
      <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 14px', border: '0.5px solid rgba(0,0,0,0.08)', fontSize: 12, color: '#555', lineHeight: 1.7 }}>
        ⏰ Window: 9:45 AM – 1:30 PM EST only<br/>
        🎯 Max 2 trades today<br/>
        {(moonSign === 'Scorpio' || moonSign === 'Cancer' || moonSign === 'Pisces') && <>💧 Water moon ({moonSign}) — your edge is amplified today<br/></>}
        {moon.phase === 'Full Moon' && <>🌕 Full Moon — watch for reversals at key EMAs after the initial push<br/></>}
        {moon.phase === 'New Moon' && <>🌑 New Moon — low energy, smaller size or sit out<br/></>}
        {pData.mercRetro && <>☿ Mercury Rx — wait for confirmation candle before entry<br/></>}
        💛 20% of profits → Bondo Charity
      </div>

      {/* Personal notes */}
      <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>My Notes For This Day</div>
      <textarea
        value={notes}
        onChange={e => saveNotes(e.target.value)}
        placeholder="Add your pre-market thesis, key levels, trade log..."
        style={{ width: '100%', minHeight: 80, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, fontSize: 13, color: '#333', background: 'white', resize: 'vertical', lineHeight: 1.6 }}
      />
    </div>
  );
}
