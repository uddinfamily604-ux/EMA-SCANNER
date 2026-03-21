import { useState, useEffect, useRef, useCallback } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";

const TIMEFRAMES = [
  { label: "5 MIN", seconds: 300, multiplier: 5, timespan: "minute", required: true },
  { label: "2 MIN", seconds: 120, multiplier: 2, timespan: "minute", required: true },
  { label: "30 SEC", seconds: 30, multiplier: 30, timespan: "second", required: false },
  { label: "15 SEC", seconds: 15, multiplier: 15, timespan: "second", required: false },
];

// === SHA (Smoothed Heikin Ashi) ===
function calcSHA(candles, smooth = 3) {
  if (candles.length < 2) return [];
  // Step 1: Heikin Ashi
  let ha = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.o + c.h + c.l + c.c) / 4;
    const haOpen = i === 0 ? (c.o + c.c) / 2 : (ha[i - 1].o + ha[i - 1].c) / 2;
    const haHigh = Math.max(c.h, haOpen, haClose);
    const haLow = Math.min(c.l, haOpen, haClose);
    ha.push({ o: haOpen, h: haHigh, l: haLow, c: haClose });
  }
  // Step 2: EMA smooth
  function ema(arr, period) {
    const k = 2 / (period + 1);
    let result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      result.push(arr[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }
  const sClose = ema(ha.map(x => x.c), smooth);
  const sOpen = ema(ha.map(x => x.o), smooth);
  return sClose.map((c, i) => ({ bullish: c >= sOpen[i], c, o: sOpen[i] }));
}

// === HalfTrend ===
function calcHalfTrend(candles, atrLen = 14, amplitude = 2) {
  if (candles.length < atrLen + 2) return [];
  // ATR
  function atr(data, len) {
    let trs = [];
    for (let i = 1; i < data.length; i++) {
      const tr = Math.max(
        data[i].h - data[i].l,
        Math.abs(data[i].h - data[i - 1].c),
        Math.abs(data[i].l - data[i - 1].c)
      );
      trs.push(tr);
    }
    let atrArr = [trs.slice(0, len).reduce((a, b) => a + b, 0) / len];
    for (let i = len; i < trs.length; i++) {
      atrArr.push((atrArr[atrArr.length - 1] * (len - 1) + trs[i]) / len);
    }
    return atrArr;
  }
  const atrVals = atr(candles, atrLen);
  const offset = candles.length - atrVals.length;
  let trend = 0, nextTrend = 0, maxLow = candles[0].l, minHigh = candles[0].h;
  let up = candles[0].l, dn = candles[0].h;
  let results = new Array(candles.length).fill(null);

  for (let i = offset; i < candles.length; i++) {
    const ai = i - offset;
    const highPrice = candles[i].h;
    const lowPrice = candles[i].l;
    const dev = amplitude * atrVals[ai];

    const highma = (candles[i].h + candles[i].l) / 2 + dev;
    const lowma = (candles[i].h + candles[i].l) / 2 - dev;

    if (nextTrend === 1) {
      maxLow = Math.max(lowPrice, maxLow);
      if (highPrice < maxLow && trend !== 1) {
        trend = 1; nextTrend = 0; dn = highPrice;
      }
    } else {
      minHigh = Math.min(highPrice, minHigh);
      if (lowPrice > minHigh && trend !== 0) {
        trend = 0; nextTrend = 1; up = lowPrice;
      }
    }

    if (trend === 0) {
      if (lowma > up) up = lowma;
      results[i] = { bullish: true };
    } else {
      if (highma < dn) dn = highma;
      results[i] = { bullish: false };
    }
  }
  return results;
}

function getSignal(candles) {
  if (!candles || candles.length < 20) return null;
  const sha = calcSHA(candles);
  const ht = calcHalfTrend(candles);
  if (!sha.length || !ht.length) return null;
  const lastSHA = sha[sha.length - 1];
  const lastHT = ht[ht.length - 1];
  if (!lastSHA || !lastHT) return null;
  if (lastSHA.bullish && lastHT.bullish) return "BUY";
  if (!lastSHA.bullish && !lastHT.bullish) return "SELL";
  return "NEUTRAL";
}

async function fetchCandles(symbol, multiplier, timespan) {
  const to = new Date();
  const from = new Date(to.getTime() - 60 * 60 * 1000 * 2); // 2 hours back
  const fromStr = from.toISOString().split(".")[0] + "Z";
  const toStr = to.toISOString().split(".")[0] + "Z";
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=200&apiKey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results) return [];
  return data.results.map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, t: r.t }));
}

// Flash overlay component
function FlashOverlay({ type, visible }) {
  if (!visible) return null;
  const color = type === "BUY" ? "rgba(0,255,120,0.18)" : "rgba(255,60,60,0.18)";
  const border = type === "BUY" ? "#00ff78" : "#ff3c3c";
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none",
      backgroundColor: color,
      border: `4px solid ${border}`,
      animation: "flashPulse 0.4s ease-in-out infinite alternate",
    }} />
  );
}

function TFCard({ tf, signal, candles, lastPrice }) {
  const isRequired = tf.required;
  const bg =
    signal === "BUY" ? "linear-gradient(135deg,#0a1f14 60%,#0d2e1a)"
    : signal === "SELL" ? "linear-gradient(135deg,#1f0a0a 60%,#2e0d0d)"
    : "linear-gradient(135deg,#0e0e14 60%,#14141e)";

  const borderColor =
    signal === "BUY" ? "#00e87a"
    : signal === "SELL" ? "#ff3c3c"
    : "#2a2a3a";

  const signalColor =
    signal === "BUY" ? "#00e87a"
    : signal === "SELL" ? "#ff4444"
    : "#555577";

  const dot =
    signal === "BUY" ? "#00e87a"
    : signal === "SELL" ? "#ff4444"
    : "#444466";

  return (
    <div style={{
      background: bg,
      border: `2px solid ${borderColor}`,
      borderRadius: 14,
      padding: "18px 16px",
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      boxShadow: signal !== "NEUTRAL" && signal ? `0 0 24px ${borderColor}44` : "none",
      transition: "all 0.3s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Required badge */}
      <div style={{
        position: "absolute", top: 10, right: 10,
        fontSize: 9, fontFamily: "'Space Mono', monospace",
        color: isRequired ? "#f0c040" : "#444466",
        background: isRequired ? "#2a2010" : "#111118",
        border: `1px solid ${isRequired ? "#f0c04066" : "#222230"}`,
        borderRadius: 4, padding: "2px 6px", letterSpacing: 1,
      }}>
        {isRequired ? "REQUIRED" : "CONFIRM"}
      </div>

      {/* Timeframe label */}
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 22, fontWeight: 700,
        color: "#e0e0ff", letterSpacing: 2,
      }}>
        {tf.label}
      </div>

      {/* Signal */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: dot,
          boxShadow: signal !== "NEUTRAL" && signal ? `0 0 8px ${dot}` : "none",
          flexShrink: 0,
          animation: signal && signal !== "NEUTRAL" ? "dotPulse 1s ease-in-out infinite" : "none",
        }} />
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 28, fontWeight: 700,
          color: signalColor,
          letterSpacing: 1,
        }}>
          {signal || "—"}
        </div>
      </div>

      {/* SHA + HT breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {["SHA", "HalfTrend"].map((ind, idx) => {
          const bullish =
            candles && candles.length >= 20
              ? idx === 0
                ? calcSHA(candles).at(-1)?.bullish
                : calcHalfTrend(candles).at(-1)?.bullish
              : null;
          return (
            <div key={ind} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#ffffff08", borderRadius: 6, padding: "4px 10px",
            }}>
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: 10,
                color: "#8888aa", letterSpacing: 1,
              }}>{ind}</span>
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
                color: bullish === null ? "#444466" : bullish ? "#00e87a" : "#ff4444",
              }}>
                {bullish === null ? "—" : bullish ? "▲ BULL" : "▼ BEAR"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last candles indicator */}
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 9,
        color: "#33334a", marginTop: "auto",
      }}>
        {candles ? `${candles.length} candles loaded` : "loading..."}
      </div>
    </div>
  );
}

export default function ScalpingTab() {
  const [symbol, setSymbol] = useState("SPY");
  const [inputSymbol, setInputSymbol] = useState("SPY");
  const [candles, setCandles] = useState({ 0: null, 1: null, 2: null, 3: null });
  const [signals, setSignals] = useState({ 0: null, 1: null, 2: null, 3: null });
  const [flash, setFlash] = useState(null); // "BUY" | "SELL" | null
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aligned, setAligned] = useState(false);
  const [exitSignal, setExitSignal] = useState(false);
  const prevSignals = useRef({});
  const flashTimeout = useRef(null);

  const fetchAll = useCallback(async (sym) => {
    setLoading(true);
    try {
      const results = await Promise.all(
        TIMEFRAMES.map(tf => fetchCandles(sym, tf.multiplier, tf.timespan))
      );
      const newCandles = {};
      const newSignals = {};
      results.forEach((c, i) => {
        newCandles[i] = c;
        newSignals[i] = getSignal(c);
      });
      setCandles(newCandles);
      setSignals(newSignals);
      setLastUpdate(new Date().toLocaleTimeString());

      // Alignment check
      const req5m = newSignals[0] === "BUY";
      const req2m = newSignals[1] === "BUY";
      const conf30s = newSignals[2] === "BUY";
      const conf15s = newSignals[3] === "BUY";

      const fullyAligned = req5m && req2m && conf30s && conf15s;
      const requiredAligned = req5m && req2m;
      const isAligned = requiredAligned; // required = both 5m+2m buy

      // Exit: 15sec flips to SELL
      const wasAligned = prevSignals.current[0] === "BUY" && prevSignals.current[1] === "BUY";
      const exit15s = wasAligned && newSignals[3] === "SELL";

      setAligned(isAligned && conf30s && conf15s);
      setExitSignal(exit15s);

      if (fullyAligned && !prevSignals.current.fullyAligned) {
        triggerFlash("BUY");
      } else if (exit15s) {
        triggerFlash("SELL");
      }

      prevSignals.current = { ...newSignals, fullyAligned };
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  function triggerFlash(type) {
    setFlash(type);
    clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 3000);
  }

  useEffect(() => {
    fetchAll(symbol);
    const interval = setInterval(() => fetchAll(symbol), 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [symbol, fetchAll]);

  const handleGo = () => {
    const s = inputSymbol.trim().toUpperCase();
    if (s) setSymbol(s);
  };

  const allBuy = signals[0] === "BUY" && signals[1] === "BUY";
  const statusText = exitSignal
    ? "⚡ EXIT NOW — 15s SELL"
    : aligned
    ? "🟢 FULL ALIGNMENT — BUY"
    : allBuy
    ? "🟡 5m+2m ALIGNED — WAIT FOR 15s"
    : "⏳ WAITING FOR SETUP";

  const statusColor = exitSignal ? "#ff3c3c"
    : aligned ? "#00e87a"
    : allBuy ? "#f0c040"
    : "#555577";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07070f",
      fontFamily: "'Space Mono', monospace",
      padding: "0",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes flashPulse {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }
        @keyframes dotPulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.7; }
        }
        @keyframes statusPulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes scanLine {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        input { outline: none; }
        input:focus { border-color: #00e87a !important; }
      `}</style>

      {/* Scan line effect */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        overflow: "hidden", opacity: 0.03,
      }}>
        <div style={{
          width: "100%", height: 2, background: "#00e87a",
          animation: "scanLine 4s linear infinite",
        }} />
      </div>

      <FlashOverlay type={flash} visible={!!flash} />

      <div style={{ position: "relative", zIndex: 1, padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 13, color: "#00e87a", letterSpacing: 4,
            marginBottom: 4, opacity: 0.8,
          }}>ATM MACHINE — SCALP MODULE</div>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 28, color: "#e0e0ff", letterSpacing: 2, fontWeight: 900,
          }}>MULTI-TF ALIGNMENT</div>
          <div style={{ fontSize: 10, color: "#333355", marginTop: 4 }}>
            SHA + HALFTREND · 5MIN · 2MIN · 30SEC · 15SEC
          </div>
        </div>

        {/* Symbol input */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
          <input
            value={inputSymbol}
            onChange={e => setInputSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleGo()}
            placeholder="SYMBOL"
            style={{
              background: "#0e0e1a", border: "2px solid #2a2a3a",
              borderRadius: 8, padding: "10px 16px",
              color: "#e0e0ff", fontFamily: "'Space Mono', monospace",
              fontSize: 18, fontWeight: 700, letterSpacing: 2,
              width: 140, transition: "border-color 0.2s",
            }}
          />
          <button
            onClick={handleGo}
            style={{
              background: "#00e87a", border: "none", borderRadius: 8,
              padding: "10px 24px", color: "#07070f",
              fontFamily: "'Space Mono', monospace", fontSize: 13,
              fontWeight: 700, cursor: "pointer", letterSpacing: 1,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => e.target.style.opacity = 0.8}
            onMouseLeave={e => e.target.style.opacity = 1}
          >
            LOAD
          </button>
          <button
            onClick={() => fetchAll(symbol)}
            style={{
              background: "transparent", border: "2px solid #2a2a3a", borderRadius: 8,
              padding: "10px 18px", color: "#8888aa",
              fontFamily: "'Space Mono', monospace", fontSize: 11,
              cursor: "pointer", letterSpacing: 1,
            }}
          >
            {loading ? "..." : "↺ REFRESH"}
          </button>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#333355" }}>
            {lastUpdate ? `LAST: ${lastUpdate}` : ""}
            <br />AUTO-REFRESH 10s
          </div>
        </div>

        {/* Status bar */}
        <div style={{
          background: "#0e0e1a",
          border: `2px solid ${statusColor}`,
          borderRadius: 12, padding: "14px 20px",
          marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: `0 0 30px ${statusColor}22`,
          animation: (aligned || exitSignal) ? "statusPulse 1s ease-in-out infinite" : "none",
        }}>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 16, fontWeight: 900,
            color: statusColor, letterSpacing: 2,
          }}>
            {statusText}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: 6,
                background: signals[i] === "BUY" ? "#00e87a22"
                  : signals[i] === "SELL" ? "#ff3c3c22" : "#ffffff08",
                border: `2px solid ${signals[i] === "BUY" ? "#00e87a"
                  : signals[i] === "SELL" ? "#ff3c3c" : "#2a2a3a"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: signals[i] === "BUY" ? "#00e87a"
                  : signals[i] === "SELL" ? "#ff3c3c" : "#333355",
                fontWeight: 700,
              }}>
                {signals[i] === "BUY" ? "▲" : signals[i] === "SELL" ? "▼" : "—"}
              </div>
            ))}
          </div>
        </div>

        {/* 4 TF Cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {TIMEFRAMES.map((tf, i) => (
            <TFCard
              key={i}
              tf={tf}
              signal={signals[i]}
              candles={candles[i]}
              lastPrice={candles[i]?.at(-1)?.c}
            />
          ))}
        </div>

        {/* Rules reminder */}
        <div style={{
          background: "#0a0a14", border: "1px solid #1a1a2a",
          borderRadius: 10, padding: "14px 18px",
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
        }}>
          {[
            { icon: "🟢", text: "5m + 2m BUY = READY TO TRADE" },
            { icon: "⚡", text: "ALL 4 BUY = FULL SEND — ENTER NOW" },
            { icon: "🚪", text: "15s SELL SIGNAL = EXIT IMMEDIATELY" },
          ].map((r, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              fontSize: 10, color: "#555577", letterSpacing: 0.5, lineHeight: 1.5,
            }}>
              <span>{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>

        {/* Symbol display */}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "#222233" }}>
          MONITORING: {symbol} · POLYGON.IO REAL-TIME DATA
        </div>
      </div>
    </div>
  );
}
