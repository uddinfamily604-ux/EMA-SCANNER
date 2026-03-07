import { useState, useCallback } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";
const BASE_URL = "https://api.polygon.io";
const TIMEFRAMES = ["30s","1m","2m","5m","15m","30m","1h","4h","1D","1W"];
const TF_MAP = {
  "30s":{multiplier:30,timespan:"second"},
  "1m":{multiplier:1,timespan:"minute"},
  "2m":{multiplier:2,timespan:"minute"},
  "5m":{multiplier:5,timespan:"minute"},
  "15m":{multiplier:15,timespan:"minute"},
  "30m":{multiplier:30,timespan:"minute"},
  "1h":{multiplier:1,timespan:"hour"},
  "4h":{multiplier:4,timespan:"hour"},
  "1D":{multiplier:1,timespan:"day"},
  "1W":{multiplier:1,timespan:"week"}
};
const DEFAULT_SYMBOLS = ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","SOFI","PLTR","MARA","COIN","RIVN","BABA","BAC","JPM","GS","IWM"];

function calcEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function calcEMASeries(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcSlope(arr, period = 8) {
  if (arr.length < period) return 0;
  const slice = arr.slice(-period).filter(v => v !== null && !isNaN(v));
  if (slice.length < 3) return 0;
  const n = slice.length;
  const xMean = (n - 1) / 2;
  const yMean = slice.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xMean) * (slice[i] - yMean); den += (i - xMean) ** 2; }
  return den === 0 ? 0 : num / den;
}

function slopeToStrength(slope, price) {
  if (!price || price === 0) return 0;
  const normalized = Math.abs(slope) / price * 10000;
  return Math.min(100, Math.round(normalized * 80));
}

function getSlopeLabel(strength) {
  if (strength >= 80) return "EXTREME";
  if (strength >= 60) return "STRONG";
  if (strength >= 40) return "MODERATE";
  if (strength >= 20) return "WEAK";
  return "FLAT";
}

function getSlopeColor(strength) {
  if (strength >= 80) return "#ff1744";
  if (strength >= 60) return "#ff5722";
  if (strength >= 40) return "#ff9800";
  if (strength >= 20) return "#ffeb3b";
  return "#546e7a";
}

function detectBounce(closes, highs, lows, emaSeries) {
  if (!closes || closes.length < 20 || !emaSeries || emaSeries.length < 10) return { hasBounce: false, bounceStrength: 0 };
  const recentCloses = closes.slice(-20);
  const recentLows = lows ? lows.slice(-20) : recentCloses;
  const currentPrice = closes[closes.length - 1];
  const recentLow = Math.min(...recentLows.slice(-10));
  const lastEMA = emaSeries[emaSeries.length - 1];
  const bounceUp = (currentPrice - recentLow) / recentLow * 100;
  const nearEMA = Math.abs(currentPrice - lastEMA) / lastEMA * 100 < 1.5;
  const hasBounce = bounceUp > 1.0 && bounceUp < 8.0;
  return { hasBounce, bounceUp: bounceUp.toFixed(2), nearEMA };
}

function detectRedRejection(opens, closes, emaSeries) {
  if (!opens || !closes || opens.length < 3 || !emaSeries || emaSeries.length < 3) return false;
  const lastOpen = opens[opens.length - 1];
  const lastClose = closes[closes.length - 1];
  const lastEMA = emaSeries[emaSeries.length - 1];
  const isRedCandle = lastClose < lastOpen;
  const candleSize = Math.abs(lastOpen - lastClose) / lastOpen * 100;
  const touchedEMA = Math.min(lastOpen, lastClose) <= lastEMA && Math.max(lastOpen, lastClose) >= lastEMA * 0.99;
  const aboveEMA = lastOpen > lastEMA * 0.995;
  return isRedCandle && candleSize > 0.2 && (touchedEMA || aboveEMA);
}

async function fetchCandles(symbol, tf) {
  const { multiplier, timespan } = TF_MAP[tf];
  const now = new Date();
  const from = new Date(now);
  const daysBack = timespan==="second"?1:timespan==="minute"?5:timespan==="hour"?30:timespan==="day"?400:800;
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = now.toISOString().split("T")[0];
  const url = `${BASE_URL}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  return {
    closes: data.results.map(r => r.c),
    opens: data.results.map(r => r.o),
    highs: data.results.map(r => r.h),
    lows: data.results.map(r => r.l),
  };
}

async function analyzeSymbol(symbol, ema1, ema2, ema3, tf, minSlopeStrength) {
  try {
    const candles = await fetchCandles(symbol, tf);
    if (!candles || candles.closes.length < ema3 + 10) return null;
    const { closes, opens, highs, lows } = candles;
    const price = closes[closes.length - 1];

    const e1Series = calcEMASeries(closes, ema1);
    const e2Series = calcEMASeries(closes, ema2);
    const e3Series = calcEMASeries(closes, ema3);

    const e1 = e1Series[e1Series.length - 1];
    const e2 = e2Series[e2Series.length - 1];
    const e3 = e3Series[e3Series.length - 1];
    if (!e1 || !e2 || !e3) return null;

    const slope1 = calcSlope(e1Series);
    const slope2 = calcSlope(e2Series);
    const slope3 = calcSlope(e3Series);

    const strength1 = slopeToStrength(slope1, price);
    const strength2 = slopeToStrength(slope2, price);
    const strength3 = slopeToStrength(slope3, price);
    const avgStrength = Math.round((strength1 + strength2 + strength3) / 3);

    if (avgStrength < minSlopeStrength) return null;

    const spread = Math.abs(e3 - e1);
    const spreadPct = (spread / e1) * 100;
    const compressed = spreadPct < 1.5;
    const allSlopingDown = slope1 < 0 && slope2 < 0 && slope3 < 0;
    const allSlopingUp = slope1 > 0 && slope2 > 0 && slope3 > 0;
    const distFromE1 = ((price - e1) / e1) * 100;
    const distFromE2 = ((price - e2) / e2) * 100;
    const distFromE3 = ((price - e3) / e3) * 100;

    const bounceData = detectBounce(closes, highs, lows, e3Series);
    const redRejection = detectRedRejection(opens, closes, e3Series);
    const swingSignal = allSlopingDown && bounceData.hasBounce && redRejection;

    let score = 0;
    if (allSlopingDown || allSlopingUp) score += 35;
    if (compressed) score += 25;
    score += Math.max(0, 20 - spreadPct * 8);
    score += Math.min(20, avgStrength / 5);
    if (swingSignal) score += 10;

    return {
      symbol, price: price.toFixed(2),
      ema1: e1.toFixed(2), ema2: e2.toFixed(2), ema3: e3.toFixed(2),
      spread: spread.toFixed(2), spreadPct: spreadPct.toFixed(3),
      slope1, slope2, slope3,
      strength1, strength2, strength3, avgStrength,
      allSlopingDown, allSlopingUp, compressed,
      distFromE1: distFromE1.toFixed(2), distFromE2: distFromE2.toFixed(2), distFromE3: distFromE3.toFixed(2),
      trend: allSlopingDown ? "BEARISH" : allSlopingUp ? "BULLISH" : "MIXED",
      score: Math.min(100, Math.round(score)),
      bounceDetected: bounceData.hasBounce,
      bounceUp: bounceData.bounceUp,
      nearEMA: bounceData.nearEMA,
      redRejection,
      swingSignal,
    };
  } catch (e) { return null; }
}

function SlopeArrow({ slope }) {
  const deg = slope > 0.15 ? -45 : slope > 0.05 ? -25 : slope > 0 ? -10 : slope > -0.05 ? 10 : slope > -0.15 ? 25 : 45;
  return <span style={{ display: "inline-block", transform: `rotate(${deg}deg)`, color: slope > 0 ? "#00e676" : "#ff1744", fontWeight: 900, fontSize: 14 }}>→</span>;
}

function ScoreBar({ score }) {
  const color = score > 75 ? "#ff1744" : score > 50 ? "#ff9800" : score > 30 ? "#ffeb3b" : "#546e7a";
  return <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ width: 60, height: 6, background: "#1a2332", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
    <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 28 }}>{score}</span>
  </div>;
}

function StrengthBar({ strength }) {
  const color = getSlopeColor(strength);
  return <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
    <div style={{ width: 45, height: 5, background: "#1a2332", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${strength}%`, height: "100%", background: color, borderRadius: 2 }} />
    </div>
    <span style={{ color, fontSize: 10, fontWeight: 700, minWidth: 52 }}>{getSlopeLabel(strength)}</span>
  </div>;
}

function Section({ title, children }) {
  return <div><div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 2, marginBottom: 8, borderBottom: "1px solid #0f1e2e", paddingBottom: 5, fontWeight: 700 }}>{title}</div>{children}</div>;
}

function Stat({ label, value, color = "#c9d8e8" }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1 }}>{label}</span>
    <span style={{ fontSize: 13, color, fontWeight: 700 }}>{value}</span>
  </div>;
}

function DetailRow({ label, val, color }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
    <span style={{ fontSize: 11, color: "#3a6e9a" }}>{label}</span>
    <span style={{ fontSize: 11, color, fontWeight: 700 }}>{val}</span>
  </div>;
}

export default function EMAScanner() {
  const [ema1, setEma1] = useState(50), [ema2, setEma2] = useState(100), [ema3, setEma3] = useState(200);
  const [timeframe, setTimeframe] = useState("1h"), [maxSpread, setMaxSpread] = useState(1.5);
  const [minSlopeStrength, setMinSlopeStrength] = useState(0);
  const [filterMode, setFilterMode] = useState("ALL"), [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false), [customSymbols, setCustomSymbols] = useState(DEFAULT_SYMBOLS.join(","));
  const [sortBy, setSortBy] = useState("score"), [selectedRow, setSelectedRow] = useState(null);
  const [lastScan, setLastScan] = useState(null), [progress, setProgress] = useState({ done: 0, total: 0 }), [errors, setErrors] = useState([]);

  const runScan = useCallback(async () => {
    setScanning(true); setSelectedRow(null); setErrors([]);
    const syms = customSymbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    setProgress({ done: 0, total: syms.length });
    const allResults = [], failedSyms = [];
    for (let i = 0; i < syms.length; i++) {
      const result = await analyzeSymbol(syms[i], ema1, ema2, ema3, timeframe, minSlopeStrength);
      if (result) allResults.push(result); else failedSyms.push(syms[i]);
      setProgress({ done: i + 1, total: syms.length });
    }
    let filtered = [...allResults];
    if (filterMode === "BEARISH") filtered = filtered.filter(d => d.allSlopingDown);
    if (filterMode === "BULLISH") filtered = filtered.filter(d => d.allSlopingUp);
    if (filterMode === "COMPRESSED") filtered = filtered.filter(d => parseFloat(d.spreadPct) <= maxSpread);
    if (filterMode === "SWING SIGNAL") filtered = filtered.filter(d => d.swingSignal);
    filtered.sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "spread" ? parseFloat(a.spreadPct) - parseFloat(b.spreadPct) : sortBy === "strength" ? b.avgStrength - a.avgStrength : a.symbol.localeCompare(b.symbol));
    setResults(filtered); setErrors(failedSyms); setScanning(false); setLastScan(new Date().toLocaleTimeString());
  }, [ema1, ema2, ema3, timeframe, maxSpread, filterMode, customSymbols, sortBy, minSlopeStrength]);

  const selected = selectedRow !== null ? results[selectedRow] : null;

  return (
    <div style={{ fontFamily: "'Courier New',monospace", background: "#080e1a", minHeight: "100vh", color: "#c9d8e8" }}>
      <div style={{ background: "linear-gradient(90deg,#0d1b2e,#0a1520)", borderBottom: "1px solid #1e3a5a", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: scanning ? "#ff9800" : "#00e676", boxShadow: `0 0 8px ${scanning ? "#ff9800" : "#00e676"}` }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: "#e8f4ff", letterSpacing: 2 }}>EMA COMPRESSION SCANNER</span>
          <span style={{ fontSize: 10, color: "#00b4d8", padding: "2px 8px", border: "1px solid #1e3a5a", borderRadius: 3 }}>v3.0</span>
        </div>
        <div style={{ fontSize: 11, color: "#3a6e9a" }}>{scanning ? `SCANNING... ${progress.done}/${progress.total}` : lastScan ? `LAST SCAN: ${lastScan}` : ""}</div>
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 260, minWidth: 260, background: "#0a1520", borderRight: "1px solid #1e3a5a", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 16 }}>

          <Section title="EMA PERIODS">
            {[["EMA 1 (Fast)", ema1, setEma1], ["EMA 2 (Mid)", ema2, setEma2], ["EMA 3 (Slow)", ema3, setEma3]].map(([label, val, setter]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#3a6e9a", marginBottom: 4, letterSpacing: 1 }}>{label}</div>
                <input type="number" min={1} max={500} value={val} onChange={e => setter(Number(e.target.value))} style={{ width: "100%", background: "#0d1b2e", border: "1px solid #1e3a5a", borderRadius: 4, color: "#00b4d8", padding: "6px 10px", fontSize: 14, fontFamily: "inherit", fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </Section>

          <Section title="TIMEFRAME">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {TIMEFRAMES.map(tf => <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: "5px 8px", fontSize: 11, fontFamily: "inherit", background: timeframe === tf ? "#0d3b5e" : "#0d1b2e", border: `1px solid ${timeframe === tf ? "#00b4d8" : "#1e3a5a"}`, color: timeframe === tf ? "#00b4d8" : "#3a6e9a", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}>{tf}</button>)}
            </div>
            <div style={{ fontSize: 9, color: "#2a4a6a", marginTop: 6 }}>30s/2m for scalping | 1h for swing</div>
          </Section>

          <Section title="MIN SLOPE STRENGTH">
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#3a6e9a" }}>Min: <span style={{ color: getSlopeColor(minSlopeStrength), fontWeight: 700 }}>{minSlopeStrength}% — {getSlopeLabel(minSlopeStrength)}</span></span>
              </div>
              <input type="range" min={0} max={90} step={5} value={minSlopeStrength} onChange={e => setMinSlopeStrength(Number(e.target.value))}
                style={{ width: "100%", accentColor: getSlopeColor(minSlopeStrength), cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2a4a6a", marginTop: 3 }}>
                <span>ANY</span><span>WEAK</span><span>MOD</span><span>STRONG</span><span>XTREME</span>
              </div>
            </div>
            <div style={{ fontSize: 9, color: "#2a4a6a" }}>0 = show all | 60+ = strong slopes only</div>
          </Section>

          <Section title="FILTER MODE">
            {["ALL", "BEARISH", "BULLISH", "COMPRESSED", "SWING SIGNAL"].map(m => (
              <button key={m} onClick={() => setFilterMode(m)} style={{ width: "100%", padding: "6px", marginBottom: 5, background: filterMode === m ? (m === "BEARISH" ? "#2a0a0a" : m === "BULLISH" ? "#0a2a0a" : m === "SWING SIGNAL" ? "#1a0a2a" : "#0d2a3a") : "#0d1b2e", border: `1px solid ${filterMode === m ? (m === "BEARISH" ? "#ff1744" : m === "BULLISH" ? "#00e676" : m === "SWING SIGNAL" ? "#e040fb" : "#00b4d8") : "#1e3a5a"}`, color: filterMode === m ? (m === "BEARISH" ? "#ff1744" : m === "BULLISH" ? "#00e676" : m === "SWING SIGNAL" ? "#e040fb" : "#00b4d8") : "#3a6e9a", borderRadius: 4, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1 }}>{m}</button>
            ))}
            {filterMode === "COMPRESSED" && <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#3a6e9a", marginBottom: 4 }}>MAX SPREAD %</div>
              <input type="number" step={0.1} min={0.1} max={10} value={maxSpread} onChange={e => setMaxSpread(Number(e.target.value))} style={{ width: "100%", background: "#0d1b2e", border: "1px solid #1e3a5a", borderRadius: 4, color: "#00b4d8", padding: "6px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>}
          </Section>

          <Section title="SORT BY">
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["score", "spread", "strength", "symbol"].map(s => <button key={s} onClick={() => setSortBy(s)} style={{ flex: 1, padding: "5px 4px", fontSize: 10, fontFamily: "inherit", background: sortBy === s ? "#0d3b5e" : "#0d1b2e", border: `1px solid ${sortBy === s ? "#00b4d8" : "#1e3a5a"}`, color: sortBy === s ? "#00b4d8" : "#3a6e9a", borderRadius: 4, cursor: "pointer", fontWeight: 700, minWidth: 48 }}>{s.toUpperCase()}</button>)}
            </div>
          </Section>

          <Section title="WATCHLIST">
            <textarea value={customSymbols} onChange={e => setCustomSymbols(e.target.value)} rows={5} style={{ width: "100%", background: "#0d1b2e", border: "1px solid #1e3a5a", borderRadius: 4, color: "#8ab4cc", padding: "8px", fontSize: 11, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }} />
            <div style={{ fontSize: 10, color: "#2a4a6a", marginTop: 4 }}>Comma separated symbols</div>
          </Section>

          <button onClick={runScan} disabled={scanning} style={{ width: "100%", padding: "10px", background: scanning ? "#0d1b2e" : "linear-gradient(135deg,#0d3b5e,#0a5577)", border: `1px solid ${scanning ? "#1e3a5a" : "#00b4d8"}`, color: scanning ? "#3a6e9a" : "#00e5ff", borderRadius: 6, cursor: scanning ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700, letterSpacing: 2 }}>
            {scanning ? `SCANNING ${progress.done}/${progress.total}...` : "▶ RUN SCAN"}
          </button>
          {errors.length > 0 && <div style={{ fontSize: 10, color: "#ff5722" }}>Failed: {errors.join(", ")}</div>}

          <Section title="SLOPE STRENGTH LEGEND">
            {[["EXTREME", 85], ["STRONG", 65], ["MODERATE", 45], ["WEAK", 25], ["FLAT", 5]].map(([label, val]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ width: 28, height: 4, background: getSlopeColor(val), borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: getSlopeColor(val), fontWeight: 700 }}>{label}</span>
              </div>
            ))}
          </Section>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#0a1520", borderBottom: "1px solid #1e3a5a", padding: "8px 16px", display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Stat label="TOTAL" value={results.length} />
            <Stat label="BEARISH" value={results.filter(r => r.allSlopingDown).length} color="#ff1744" />
            <Stat label="BULLISH" value={results.filter(r => r.allSlopingUp).length} color="#00e676" />
            <Stat label="COMPRESSED" value={results.filter(r => r.compressed).length} color="#ff9800" />
            <Stat label="SWING SIGNALS" value={results.filter(r => r.swingSignal).length} color="#e040fb" />
            <Stat label="TF" value={timeframe} color="#00b4d8" />
            {minSlopeStrength > 0 && <Stat label="MIN SLOPE" value={`${minSlopeStrength}% (${getSlopeLabel(minSlopeStrength)})`} color={getSlopeColor(minSlopeStrength)} />}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {results.length === 0 && !scanning && (
              <div style={{ padding: 40, textAlign: "center", color: "#2a5a7a", fontSize: 13 }}>
                {lastScan ? "No results matched your filter." : "Press ▶ RUN SCAN to fetch live data"}
              </div>
            )}
            {results.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#0a1520", borderBottom: "2px solid #1e3a5a" }}>
                  {["SYMBOL", "PRICE", `EMA${ema1}`, `EMA${ema2}`, `EMA${ema3}`, "SPREAD%", "SLOPE DIR", "SLOPE STRENGTH", "BOUNCE", "REJECTION", "SWING ★", "TREND", "SIGNAL"].map(h =>
                    <th key={h} style={{ padding: "8px 8px", textAlign: "left", color: "#2a6e9a", fontSize: 10, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {results.map((r, i) => {
                    const isSelected = selectedRow === i;
                    const rowBg = isSelected ? "#0d2a3e" : r.swingSignal ? "#1a0a1a" : r.allSlopingDown && r.compressed ? "#1a0a0a" : r.allSlopingUp && r.compressed ? "#0a1a0a" : i % 2 === 0 ? "#080e1a" : "#0a1218";
                    return <tr key={r.symbol} onClick={() => setSelectedRow(isSelected ? null : i)} style={{ background: rowBg, borderBottom: "1px solid #0f1e2e", cursor: "pointer" }}>
                      <td style={{ padding: "7px 8px", fontWeight: 700, color: "#e8f4ff", fontSize: 13 }}>{r.symbol}</td>
                      <td style={{ padding: "7px 8px", color: "#c9d8e8" }}>{r.price}</td>
                      <td style={{ padding: "7px 8px", color: "#00b4d8" }}>{r.ema1}</td>
                      <td style={{ padding: "7px 8px", color: "#00b4d8" }}>{r.ema2}</td>
                      <td style={{ padding: "7px 8px", color: "#00b4d8" }}>{r.ema3}</td>
                      <td style={{ padding: "7px 8px" }}><span style={{ color: parseFloat(r.spreadPct) < 0.5 ? "#ff9800" : "#c9d8e8", fontWeight: parseFloat(r.spreadPct) < 0.5 ? 700 : 400 }}>{r.spreadPct}%</span></td>
                      <td style={{ padding: "7px 8px" }}><div style={{ display: "flex", gap: 3 }}><SlopeArrow slope={r.slope1} /><SlopeArrow slope={r.slope2} /><SlopeArrow slope={r.slope3} /></div></td>
                      <td style={{ padding: "7px 8px", minWidth: 120 }}><StrengthBar strength={r.avgStrength} /></td>
                      <td style={{ padding: "7px 8px" }}>
                        {r.bounceDetected ? <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#1a1400", color: "#ffeb3b", border: "1px solid #ffeb3b" }}>↑ {r.bounceUp}%</span> : <span style={{ color: "#2a4a6a", fontSize: 10 }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 8px" }}>
                        {r.redRejection ? <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#2a0a0a", color: "#ff1744", border: "1px solid #ff1744" }}>RED ✖</span> : <span style={{ color: "#2a4a6a", fontSize: 10 }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 8px" }}>
                        {r.swingSignal ? <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#1a0028", color: "#e040fb", border: "1px solid #e040fb" }}>★ SELL</span> : <span style={{ color: "#2a4a6a", fontSize: 10 }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 8px" }}><span style={{ padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: 1, background: r.trend === "BEARISH" ? "#2a0a0a" : r.trend === "BULLISH" ? "#0a2a0a" : "#1a1a0a", color: r.trend === "BEARISH" ? "#ff1744" : r.trend === "BULLISH" ? "#00e676" : "#ffeb3b", border: `1px solid ${r.trend === "BEARISH" ? "#ff1744" : r.trend === "BULLISH" ? "#00e676" : "#ffeb3b"}` }}>{r.trend}</span></td>
                      <td style={{ padding: "7px 8px" }}><ScoreBar score={r.score} /></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selected && (
            <div style={{ background: "#0a1520", borderTop: "2px solid #1e3a5a", padding: "14px 20px" }}>
              <div style={{ fontSize: 11, color: "#3a6e9a", marginBottom: 10, letterSpacing: 2 }}>▼ DETAIL: {selected.symbol} — {timeframe}</div>
              <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>EMA LEVELS</div>
                  <DetailRow label={`EMA${ema1}`} val={selected.ema1} color="#00b4d8" />
                  <DetailRow label={`EMA${ema2}`} val={selected.ema2} color="#00b4d8" />
                  <DetailRow label={`EMA${ema3}`} val={selected.ema3} color="#00b4d8" />
                  <DetailRow label="Price" val={selected.price} color="#e8f4ff" />
                </div>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>COMPRESSION</div>
                  <DetailRow label="Pts Apart" val={selected.spread} color="#ffeb3b" />
                  <DetailRow label="% Spread" val={`${selected.spreadPct}%`} color={parseFloat(selected.spreadPct) < 0.5 ? "#ff9800" : "#ffeb3b"} />
                  <DetailRow label="Compressed?" val={selected.compressed ? "YES ●" : "NO"} color={selected.compressed ? "#ff9800" : "#3a6e9a"} />
                </div>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>SLOPE STRENGTH</div>
                  {[[`EMA${ema1}`, selected.strength1], [`EMA${ema2}`, selected.strength2], [`EMA${ema3}`, selected.strength3]].map(([l, s]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: "#3a6e9a", minWidth: 50 }}>{l}</span>
                      <StrengthBar strength={s} />
                    </div>
                  ))}
                  <div style={{ marginTop: 4, fontSize: 10, color: "#3a6e9a" }}>AVG: <span style={{ color: getSlopeColor(selected.avgStrength), fontWeight: 700 }}>{selected.avgStrength}% — {getSlopeLabel(selected.avgStrength)}</span></div>
                </div>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>PRICE vs EMA</div>
                  <DetailRow label={`vs EMA${ema1}`} val={`${selected.distFromE1}%`} color={parseFloat(selected.distFromE1) > 0 ? "#00e676" : "#ff1744"} />
                  <DetailRow label={`vs EMA${ema2}`} val={`${selected.distFromE2}%`} color={parseFloat(selected.distFromE2) > 0 ? "#00e676" : "#ff1744"} />
                  <DetailRow label={`vs EMA${ema3}`} val={`${selected.distFromE3}%`} color={parseFloat(selected.distFromE3) > 0 ? "#00e676" : "#ff1744"} />
                </div>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>SIGNALS</div>
                  <DetailRow label="Bounce Up?" val={selected.bounceDetected ? `YES +${selected.bounceUp}%` : "No"} color={selected.bounceDetected ? "#ffeb3b" : "#3a6e9a"} />
                  <DetailRow label="Near EMA?" val={selected.nearEMA ? "YES" : "No"} color={selected.nearEMA ? "#ff9800" : "#3a6e9a"} />
                  <DetailRow label="Red Rejection?" val={selected.redRejection ? "YES ✖" : "No"} color={selected.redRejection ? "#ff1744" : "#3a6e9a"} />
                  <DetailRow label="★ Swing Signal?" val={selected.swingSignal ? "SELL SIGNAL!" : "No"} color={selected.swingSignal ? "#e040fb" : "#3a6e9a"} />
                </div>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 9, color: "#2a5a7a", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>SIGNAL SCORE</div>
                  <ScoreBar score={selected.score} />
                  <div style={{ marginTop: 6, fontSize: 10, color: "#3a6e9a" }}>{selected.score > 75 ? "★ STRONG — All conditions aligned" : selected.score > 50 ? "◆ MODERATE — Most conditions met" : "◇ WEAK — Few conditions triggered"}</div>
                  {selected.swingSignal && <div style={{ marginTop: 8, padding: "6px 10px", background: "#1a0028", border: "1px solid #e040fb", borderRadius: 4, fontSize: 11, color: "#e040fb", fontWeight: 700 }}>★ SWING SELL SETUP DETECTED</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`tbody tr:hover{background:#0d2233 !important;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:#080e1a;}::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:3px;}input[type=range]{height:4px;}`}</style>
    </div>
  );
}
