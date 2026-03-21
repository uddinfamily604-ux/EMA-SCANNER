import { useState } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";

// ── SHA ───────────────────────────────────────────────────────────────────────
function calcSHA(candles, smooth = 3) {
  if (candles.length < smooth + 2) return [];
  const k = 2 / (smooth + 1);
  let ha = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haC = (c.o + c.h + c.l + c.c) / 4;
    const haO = i === 0 ? (c.o + c.c) / 2 : (ha[i-1].o + ha[i-1].c) / 2;
    ha.push({ o: haO, c: haC });
  }
  let sO = ha[0].o, sC = ha[0].c;
  const result = [];
  for (let i = 0; i < ha.length; i++) {
    sO = i === 0 ? ha[0].o : ha[i].o * k + sO * (1 - k);
    sC = i === 0 ? ha[0].c : ha[i].c * k + sC * (1 - k);
    result.push({ bullish: sC >= sO });
  }
  return result;
}

// ── HalfTrend ────────────────────────────────────────────────────────────────
function calcHalfTrend(candles, atrLen = 14, amplitude = 2) {
  if (candles.length < atrLen + 2) return [];
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i-1].c),
      Math.abs(candles[i].l - candles[i-1].c)
    ));
  }
  let atrVal = trs.slice(0, atrLen).reduce((a, b) => a + b, 0) / atrLen;
  const atrArr = [atrVal];
  for (let i = atrLen; i < trs.length; i++) {
    atrVal = (atrVal * (atrLen - 1) + trs[i]) / atrLen;
    atrArr.push(atrVal);
  }
  const offset = candles.length - atrArr.length;
  let trend = 0, nextTrend = 0, maxLow = candles[0].l, minHigh = candles[0].h;
  const results = new Array(candles.length).fill(null);
  for (let i = 1; i < candles.length; i++) {
    const ai = i - offset;
    if (ai < 0) { results[i] = { bullish: true }; continue; }
    const dev = amplitude * atrArr[ai];
    const highma = (candles[i].h + candles[i].l) / 2 + dev;
    const lowma  = (candles[i].h + candles[i].l) / 2 - dev;
    if (nextTrend === 1) {
      maxLow = Math.max(candles[i].l, maxLow);
      if (highma < maxLow && trend !== 1) { trend = 1; nextTrend = 0; }
    } else {
      minHigh = Math.min(candles[i].h, minHigh);
      if (lowma > minHigh && trend !== 0) { trend = 0; nextTrend = 1; }
    }
    results[i] = { bullish: trend === 0 };
  }
  return results;
}

function getSignal(candles) {
  if (!candles || candles.length < 20) return null;
  const sha = calcSHA(candles);
  const ht  = calcHalfTrend(candles);
  if (!sha.length || !ht.length) return null;
  const s = sha[sha.length - 1];
  const h = ht[ht.length - 1];
  if (!s || !h) return null;
  if (s.bullish && h.bullish)   return "BUY";
  if (!s.bullish && !h.bullish) return "SELL";
  return "NEUTRAL";
}

async function fetchCandles(symbol, multiplier, timespan, from, to) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.results) return [];
  return data.results.map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, t: r.t }));
}

function getDateRange(days) {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days * 2);
  return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
}

// ── Backtest engine ───────────────────────────────────────────────────────────
async function runBacktest(symbol, days, exitBars, onProgress) {
  const { from, to } = getDateRange(days + 3);

  onProgress("Fetching 5min candles...");
  const c5m  = await fetchCandles(symbol, 5,  "minute", from, to);
  onProgress("Fetching 2min candles...");
  const c2m  = await fetchCandles(symbol, 2,  "minute", from, to);
  onProgress("Fetching 15sec candles...");
  const c15s = await fetchCandles(symbol, 15, "second", from, to);

  if (!c15s.length) return { error: "No 15sec data returned. Market may be closed or API limit reached." };

  onProgress("Building signal maps...");

  const sig5m = new Map();
  const sig2m = new Map();
  for (let i = 20; i < c5m.length; i++) sig5m.set(c5m[i].t, getSignal(c5m.slice(0, i + 1)));
  for (let i = 20; i < c2m.length; i++) sig2m.set(c2m[i].t, getSignal(c2m.slice(0, i + 1)));

  // Precompute 15sec signals array for fast flip detection
  onProgress("Computing 15sec signals...");
  const sig15s = [];
  for (let i = 0; i < c15s.length; i++) {
    sig15s.push(getSignal(c15s.slice(Math.max(0, i - 30), i + 1)));
  }

  function nearestSignal(map, ts, windowMs) {
    let best = null, bestT = -Infinity;
    for (const [t, sig] of map) {
      if (t <= ts && t >= ts - windowMs && t > bestT) { bestT = t; best = sig; }
    }
    return best;
  }

  // ── Simulate with a given exit mode ──────────────────────────────────────
  function simulate(exitMode) {
    const trades = [];
    let inTrade = false, entryIdx = -1, entryPrice = 0, entryDir = null;

    for (let i = 30; i < c15s.length - exitBars - 1; i++) {
      const barTs  = c15s[i].t;
      const etHour = new Date(barTs).getUTCHours() - 5;
      const etMins = etHour * 60 + new Date(barTs).getUTCMinutes();
      if (etMins < 570 || etMins > 810) continue; // 9:30 AM – 1:30 PM ET only

      if (inTrade) {
        const barsHeld = i - entryIdx;
        const cur15    = sig15s[i];
        const flipped  = entryDir === "BUY" ? cur15 === "SELL" : cur15 === "BUY";

        let doExit =
          exitMode === "FIXED" ? barsHeld >= exitBars :
          exitMode === "FLIP"  ? (flipped || barsHeld >= exitBars) :
          exitMode === "BEST"  ? ((flipped && barsHeld >= 4) || barsHeld >= exitBars) : false;

        if (doExit) {
          const exitPrice = c15s[i].c;
          const pnlDollar = entryDir === "BUY" ? exitPrice - entryPrice : entryPrice - exitPrice;
          const pnlPct    = entryDir === "BUY"
            ? ((exitPrice - entryPrice) / entryPrice * 100)
            : ((entryPrice - exitPrice) / entryPrice * 100);

          trades.push({
            entryTime:  new Date(c15s[entryIdx].t).toLocaleString("en-US", {timeZone:"America/New_York"}),
            exitTime:   new Date(c15s[i].t).toLocaleString("en-US", {timeZone:"America/New_York"}),
            dir:        entryDir,
            entry:      entryPrice.toFixed(2),
            exit:       exitPrice.toFixed(2),
            pnlPct:     pnlPct.toFixed(4),
            pnlDollar:  pnlDollar.toFixed(2),
            optionPnl:  (pnlDollar * 50).toFixed(0),
            win:        pnlPct > 0,
            barsHeld,
            exitReason: flipped && exitMode !== "FIXED" ? "FLIP" : "BARS",
          });
          inTrade = false;
        }
        continue;
      }

      // Entry
      const s5 = nearestSignal(sig5m, barTs, 5 * 60 * 1000);
      const s2 = nearestSignal(sig2m, barTs, 2 * 60 * 1000);
      if (!s5 || !s2) continue;

      if (s5 === "BUY" && s2 === "BUY") {
        inTrade = true; entryIdx = i + 1;
        entryPrice = c15s[i + 1]?.o || c15s[i].c; entryDir = "BUY";
      } else if (s5 === "SELL" && s2 === "SELL") {
        inTrade = true; entryIdx = i + 1;
        entryPrice = c15s[i + 1]?.o || c15s[i].c; entryDir = "SELL";
      }
    }
    return trades;
  }

  function stats(trades) {
    const total    = trades.length;
    const wins     = trades.filter(t => t.win).length;
    const losses   = total - wins;
    const winRate  = total > 0 ? (wins / total * 100).toFixed(1) : "0";
    const totalPnl = trades.reduce((a, t) => a + parseFloat(t.pnlDollar), 0);
    const totalOpt = trades.reduce((a, t) => a + parseFloat(t.optionPnl), 0);
    const avgPnl   = total > 0 ? (totalPnl / total).toFixed(3) : "0";
    const winPnl   = trades.filter(t => t.win).reduce((a, t) => a + parseFloat(t.pnlDollar), 0);
    const lossPnl  = Math.abs(trades.filter(t => !t.win).reduce((a, t) => a + parseFloat(t.pnlDollar), 0));
    const profFactor = lossPnl > 0 ? (winPnl / lossPnl).toFixed(2) : "∞";
    const longs    = trades.filter(t => t.dir === "BUY").length;
    const shorts   = trades.filter(t => t.dir === "SELL").length;
    const longWR   = longs  > 0 ? (trades.filter(t => t.dir==="BUY"  && t.win).length / longs  * 100).toFixed(0) : "0";
    const shortWR  = shorts > 0 ? (trades.filter(t => t.dir==="SELL" && t.win).length / shorts * 100).toFixed(0) : "0";
    const avgBars  = total > 0 ? (trades.reduce((a, t) => a + t.barsHeld, 0) / total).toFixed(1) : "0";
    let equity = 0;
    const curve = trades.map(t => { equity += parseFloat(t.pnlDollar); return parseFloat(equity.toFixed(2)); });
    return { total, wins, losses, winRate, totalPnl: totalPnl.toFixed(2), totalOpt: totalOpt.toFixed(0),
      avgPnl, profFactor, longs, shorts, longWR, shortWR, avgBars, curve, trades };
  }

  onProgress("Simulating FIXED exit (7 bars)...");
  const fixed = stats(simulate("FIXED"));

  onProgress("Simulating FLIP exit (15s reversal)...");
  const flip  = stats(simulate("FLIP"));

  onProgress("Simulating BEST exit (min 4 bars + flip)...");
  const best  = stats(simulate("BEST"));

  return { fixed, flip, best, symbol, days, exitBars };
}

// ── Equity Curve ──────────────────────────────────────────────────────────────
function EquityCurve({ curve, color }) {
  if (!curve || curve.length < 2) return <div style={{textAlign:"center",padding:20,color:"#333355",fontSize:10}}>Not enough trades</div>;
  const W=560, H=100, PAD=24;
  const min = Math.min(0, ...curve);
  const max = Math.max(0, ...curve);
  const range = max - min || 1;
  const toX = i => PAD + (i / (curve.length - 1)) * (W - PAD * 2);
  const toY = v => PAD + ((max - v) / range) * (H - PAD * 2);
  const zero = toY(0);
  let path = curve.map((v, i) => `${i===0?"M":"L"}${toX(i)},${toY(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
      <defs>
        <linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1={PAD} y1={zero} x2={W-PAD} y2={zero} stroke="#1e1e2e" strokeWidth="1" strokeDasharray="3,3"/>
      <polygon points={`${toX(0)},${zero} ${curve.map((v,i)=>`${toX(i)},${toY(v)}`).join(" ")} ${toX(curve.length-1)},${zero}`}
        fill={`url(#g${color.replace("#","")})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2"/>
      <text x={PAD} y={H-3} fill="#333355" fontSize="8">{curve.length} trades</text>
      <text x={W-PAD} y={H-3} fill={color} fontSize="9" textAnchor="end">
        {parseFloat(curve[curve.length-1])>=0?"+":""}${curve[curve.length-1]}
      </text>
    </svg>
  );
}

// ── Comparison Card ───────────────────────────────────────────────────────────
function ModeCard({ data, label, color, desc, exitBars }) {
  const pnlC = v => parseFloat(v) >= 0 ? "#00e87a" : "#ff3c3c";
  const wr   = parseFloat(data.winRate);
  return (
    <div style={{background:"#0e0e1a", border:`2px solid ${color}44`, borderRadius:12,
      padding:"16px", display:"flex", flexDirection:"column", gap:10, flex:1, minWidth:260}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Orbitron'", fontSize:13, fontWeight:900, color}}>{label}</div>
          <div style={{fontSize:9, color:"#444466", marginTop:2}}>{desc}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:26, fontWeight:700, color: wr>=55?"#00e87a":"#ff3c3c"}}>{data.winRate}%</div>
          <div style={{fontSize:9, color:"#444466"}}>win rate</div>
        </div>
      </div>

      {/* Key stats */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
        {[
          ["TOTAL P&L", (parseFloat(data.totalPnl)>=0?"+":"")+"$"+data.totalPnl, pnlC(data.totalPnl)],
          ["OPT EST",   (parseFloat(data.totalOpt)>=0?"+":"")+"$"+data.totalOpt, pnlC(data.totalOpt)],
          ["AVG/TRADE", (parseFloat(data.avgPnl)>=0?"+":"")+"$"+data.avgPnl, pnlC(data.avgPnl)],
          ["PROF FACTOR", data.profFactor, parseFloat(data.profFactor)>=1.5?"#00e87a":"#ff9800"],
          ["TRADES", data.total, "#e0e0ff"],
          ["AVG BARS", data.avgBars+" ("+Math.round(data.avgBars*15)+"s)", "#888899"],
          ["LONG W/R", data.longWR+"%", "#38bdf8"],
          ["SHORT W/R", data.shortWR+"%", "#e040fb"],
        ].map(([k,v,c])=>(
          <div key={k} style={{background:"#07070f", borderRadius:6, padding:"7px 10px"}}>
            <div style={{fontSize:8, color:"#333355", letterSpacing:1}}>{k}</div>
            <div style={{fontSize:13, fontWeight:700, color:c, marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      <div style={{background:"#07070f", borderRadius:8, padding:"8px", overflow:"hidden"}}>
        <EquityCurve curve={data.curve} color={color}/>
      </div>

      {/* Verdict */}
      <div style={{background: wr>=55?"#00e87a0a":"#ff3c3c0a",
        border:`1px solid ${wr>=55?"#00e87a44":"#ff3c3c44"}`,
        borderRadius:8, padding:"8px 12px", textAlign:"center"}}>
        <div style={{fontSize:11, fontWeight:700, color: wr>=65?"#00e87a":wr>=55?"#88ffbb":wr>=45?"#ff9800":"#ff3c3c"}}>
          {wr>=65?"🔥 STRONG EDGE":wr>=55?"✅ POSITIVE EDGE":wr>=45?"⚠️ MARGINAL":"❌ NO EDGE"}
        </div>
      </div>
    </div>
  );
}

// ── Trade Table ───────────────────────────────────────────────────────────────
function TradeTable({ trades, filter, setFilter }) {
  const filtered = trades.filter(t => {
    if (filter === "WIN")   return t.win;
    if (filter === "LOSS")  return !t.win;
    if (filter === "LONG")  return t.dir === "BUY";
    if (filter === "SHORT") return t.dir === "SELL";
    if (filter === "FLIP")  return t.exitReason === "FLIP";
    return true;
  });
  const pnlC = v => parseFloat(v) >= 0 ? "#00e87a" : "#ff3c3c";

  return (
    <div style={{background:"#0e0e1a", border:"1px solid #1e1e2e", borderRadius:10, padding:"14px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:6}}>
        <div style={{fontSize:10, color:"#e0e0ff", fontWeight:700}}>TRADE LOG — {filtered.length} trades</div>
        <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
          {["ALL","WIN","LOSS","LONG","SHORT","FLIP"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"3px 9px", fontSize:9, fontFamily:"'Space Mono'", fontWeight:700,
              background: filter===f?"#00e87a22":"transparent",
              border:`1px solid ${filter===f?"#00e87a":"#2a2a4a"}`,
              color: filter===f?"#00e87a":"#444466",
              borderRadius:4, cursor:"pointer"}}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"collapse", fontSize:11}}>
          <thead>
            <tr style={{borderBottom:"1px solid #1e1e2e"}}>
              {["#","DIR","ENTRY TIME","ENTRY $","EXIT $","BARS","P&L $","P&L %","OPT","EXIT","RESULT"].map(h=>(
                <th key={h} style={{padding:"6px 8px", textAlign:"left", fontSize:9, color:"#444466", letterSpacing:1, whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} style={{borderBottom:"1px solid #0a0a14"}}>
                <td style={{padding:"6px 8px", color:"#333355", fontSize:10}}>{i+1}</td>
                <td style={{padding:"6px 8px"}}>
                  <span style={{padding:"2px 6px", borderRadius:3, fontSize:9, fontWeight:700,
                    background: t.dir==="BUY"?"#00e87a22":"#ff3c3c22",
                    color: t.dir==="BUY"?"#00e87a":"#ff3c3c",
                    border:`1px solid ${t.dir==="BUY"?"#00e87a44":"#ff3c3c44"}`}}>
                    {t.dir==="BUY"?"▲":"▼"} {t.dir==="BUY"?"LONG":"SHORT"}
                  </span>
                </td>
                <td style={{padding:"6px 8px", color:"#555577", fontSize:10, whiteSpace:"nowrap"}}>{t.entryTime}</td>
                <td style={{padding:"6px 8px", color:"#e0e0ff", fontWeight:700}}>${t.entry}</td>
                <td style={{padding:"6px 8px", color:"#e0e0ff"}}>${t.exit}</td>
                <td style={{padding:"6px 8px", color:"#888899"}}>{t.barsHeld}</td>
                <td style={{padding:"6px 8px", fontWeight:700, color:pnlC(t.pnlDollar)}}>
                  {parseFloat(t.pnlDollar)>=0?"+":""}${t.pnlDollar}
                </td>
                <td style={{padding:"6px 8px", color:pnlC(t.pnlPct)}}>
                  {parseFloat(t.pnlPct)>=0?"+":""}{parseFloat(t.pnlPct).toFixed(3)}%
                </td>
                <td style={{padding:"6px 8px", fontWeight:700, color:pnlC(t.optionPnl)}}>
                  {parseFloat(t.optionPnl)>=0?"+":""}${t.optionPnl}
                </td>
                <td style={{padding:"6px 8px"}}>
                  <span style={{fontSize:9, padding:"1px 5px", borderRadius:3,
                    background: t.exitReason==="FLIP"?"#e040fb22":"#2a2a4a22",
                    color: t.exitReason==="FLIP"?"#e040fb":"#555577",
                    border:`1px solid ${t.exitReason==="FLIP"?"#e040fb44":"#2a2a4a"}`}}>
                    {t.exitReason==="FLIP"?"⚡FLIP":"⏱BARS"}
                  </span>
                </td>
                <td style={{padding:"6px 8px"}}>
                  <span style={{padding:"2px 7px", borderRadius:3, fontSize:9, fontWeight:700,
                    background: t.win?"#00e87a22":"#ff3c3c22",
                    color: t.win?"#00e87a":"#ff3c3c"}}>
                    {t.win?"✓ WIN":"✗ LOSS"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function ScalpBacktest() {
  const [symbol,   setSymbol]   = useState("SPY");
  const [days,     setDays]     = useState(5);
  const [exitBars, setExitBars] = useState(7);
  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState("");
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [activeMode, setActiveMode] = useState("fixed");
  const [filter,   setFilter]   = useState("ALL");

  const run = async () => {
    setRunning(true); setResult(null); setError(null); setProgress("Starting...");
    try {
      const r = await runBacktest(symbol.toUpperCase(), days, exitBars, setProgress);
      if (r.error) setError(r.error);
      else { setResult(r); setActiveMode("fixed"); }
    } catch(e) { setError("Error: " + e.message); }
    setRunning(false); setProgress("");
  };

  const modes = [
    { key:"fixed", label:"⏱ FIXED", color:"#00e87a",  desc:`Exit after exactly ${exitBars} bars (${exitBars*15}sec)` },
    { key:"flip",  label:"⚡ FLIP",  color:"#e040fb",  desc:"Exit on 15sec SHA+HT flip OR 7 bars max" },
    { key:"best",  label:"🎯 BEST",  color:"#f59e0b",  desc:"Min 4 bars held + flip signal OR 7 bars max" },
  ];

  // Find winner
  const winner = result ? ["fixed","flip","best"].sort((a,b) =>
    parseFloat(result[b].winRate) - parseFloat(result[a].winRate))[0] : null;

  return (
    <div style={{minHeight:"100vh", background:"#07070f", fontFamily:"'Space Mono', monospace",
      color:"#e0e0ff", padding:"20px 16px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#0e0e1a;}
        ::-webkit-scrollbar-thumb{background:#2a2a4a;border-radius:2px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        tbody tr:hover td{background:#12122088!important;}
      `}</style>

      <div style={{maxWidth:1200, margin:"0 auto"}}>

        {/* Header */}
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"'Orbitron'", fontSize:10, color:"#00e87a", letterSpacing:4, marginBottom:4}}>
            ATM MACHINE — BACKTEST ENGINE
          </div>
          <div style={{fontFamily:"'Orbitron'", fontSize:24, fontWeight:900, letterSpacing:2}}>
            SCALP BACKTESTER
          </div>
          <div style={{fontSize:10, color:"#333355", marginTop:4}}>
            SHA + HALFTREND · 5MIN + 2MIN ENTRY · 3 EXIT STRATEGIES COMPARED
          </div>
        </div>

        {/* Controls */}
        <div style={{display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end",
          background:"#0e0e1a", border:"1px solid #1e1e2e", borderRadius:12,
          padding:"16px 18px", marginBottom:20}}>
          <div>
            <div style={{fontSize:9, color:"#555577", marginBottom:4, letterSpacing:1}}>SYMBOL</div>
            <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())}
              style={{width:80, background:"#07070f", border:"2px solid #2a2a4a", borderRadius:6,
                color:"#00e87a", padding:"8px 10px", fontSize:16, fontFamily:"'Space Mono'",
                fontWeight:700, outline:"none", textAlign:"center"}}/>
          </div>
          <div>
            <div style={{fontSize:9, color:"#555577", marginBottom:4, letterSpacing:1}}>DAYS</div>
            <select value={days} onChange={e=>setDays(Number(e.target.value))}
              style={{background:"#07070f", border:"2px solid #2a2a4a", borderRadius:6,
                color:"#e0e0ff", padding:"8px 10px", fontSize:13, fontFamily:"'Space Mono'", outline:"none"}}>
              {[1,3,5,10].map(d=><option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:9, color:"#555577", marginBottom:4, letterSpacing:1}}>MAX EXIT BARS</div>
            <select value={exitBars} onChange={e=>setExitBars(Number(e.target.value))}
              style={{background:"#07070f", border:"2px solid #2a2a4a", borderRadius:6,
                color:"#e0e0ff", padding:"8px 10px", fontSize:13, fontFamily:"'Space Mono'", outline:"none"}}>
              {[4,5,6,7,8,10].map(b=><option key={b} value={b}>{b} bars ({b*15}sec)</option>)}
            </select>
          </div>
          <button onClick={run} disabled={running} style={{
            padding:"10px 24px",
            background: running?"#0e0e1a":"linear-gradient(135deg,#00e87a22,#00e87a11)",
            border:`2px solid ${running?"#2a2a4a":"#00e87a"}`,
            borderRadius:8, color:running?"#444466":"#00e87a",
            fontSize:12, fontFamily:"'Space Mono'", fontWeight:700,
            cursor:running?"not-allowed":"pointer", letterSpacing:1}}>
            {running?"RUNNING...":"▶ RUN BACKTEST"}
          </button>
          {running&&(
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <div style={{width:14, height:14, border:"2px solid #00e87a", borderTop:"2px solid transparent",
                borderRadius:"50%", animation:"spin 0.8s linear infinite"}}/>
              <span style={{fontSize:10, color:"#00e87a"}}>{progress}</span>
            </div>
          )}
        </div>

        {error&&(
          <div style={{background:"#1a0505", border:"1px solid #ff3c3c44", borderRadius:8,
            padding:"12px 16px", color:"#ff3c3c", fontSize:12, marginBottom:20}}>
            ⚠️ {error}
          </div>
        )}

        {result&&(
          <div style={{animation:"fadeIn 0.4s ease"}}>

            {/* Winner banner */}
            {winner&&(
              <div style={{background:"linear-gradient(135deg,#0a1a0a,#051505)",
                border:"2px solid #00e87a66", borderRadius:10, padding:"12px 18px",
                marginBottom:18, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap"}}>
                <div style={{fontFamily:"'Orbitron'", fontSize:11, color:"#00e87a", letterSpacing:2}}>
                  🏆 BEST STRATEGY
                </div>
                <div style={{fontFamily:"'Orbitron'", fontSize:18, fontWeight:900,
                  color: modes.find(m=>m.key===winner)?.color}}>
                  {modes.find(m=>m.key===winner)?.label} — {result[winner].winRate}% WIN RATE
                </div>
                <div style={{fontSize:10, color:"#555577"}}>
                  {result[winner].total} trades · ${result[winner].totalPnl} total · Prof factor {result[winner].profFactor}
                </div>
              </div>
            )}

            {/* 3 Mode Cards side by side */}
            <div style={{display:"flex", gap:14, flexWrap:"wrap", marginBottom:18}}>
              {modes.map(m=>(
                <ModeCard key={m.key} data={result[m.key]} label={m.label}
                  color={m.color} desc={m.desc} exitBars={exitBars}/>
              ))}
            </div>

            {/* Tab selector for trade log */}
            <div style={{display:"flex", gap:8, marginBottom:12, flexWrap:"wrap"}}>
              <div style={{fontSize:10, color:"#555577", alignSelf:"center", marginRight:4}}>VIEW TRADES:</div>
              {modes.map(m=>(
                <button key={m.key} onClick={()=>{setActiveMode(m.key);setFilter("ALL");}} style={{
                  padding:"6px 16px", fontSize:10, fontFamily:"'Space Mono'", fontWeight:700,
                  background: activeMode===m.key?`${m.color}22`:"transparent",
                  border:`1px solid ${activeMode===m.key?m.color:"#2a2a4a"}`,
                  color: activeMode===m.key?m.color:"#444466",
                  borderRadius:6, cursor:"pointer"}}>
                  {m.label} ({result[m.key].total})
                </button>
              ))}
            </div>

            {/* Trade log for selected mode */}
            <TradeTable
              trades={result[activeMode].trades}
              filter={filter}
              setFilter={setFilter}
            />

            {/* Options disclaimer */}
            <div style={{marginTop:14, padding:"10px 14px", background:"#0a0a14",
              border:"1px solid #1e1e2e", borderRadius:8, fontSize:9, color:"#333355"}}>
              💡 Options estimate = 1 ATM contract × delta 0.5 × 100 shares. Actual P&L varies by strike, expiry, IV.
              This is educational only. Entry = next bar open after signal. No slippage modeled.
            </div>

          </div>
        )}

        {!result&&!running&&(
          <div style={{textAlign:"center", padding:"60px 20px", color:"#222233"}}>
            <div style={{fontFamily:"'Orbitron'", fontSize:40, marginBottom:12, color:"#1a1a2a"}}>⚡</div>
            <div style={{fontSize:12, letterSpacing:2, color:"#333355"}}>PRESS RUN BACKTEST</div>
            <div style={{fontSize:10, marginTop:10, color:"#1e1e2e", lineHeight:2}}>
              3 exit strategies compared side by side<br/>
              ⏱ FIXED: exit after exactly N bars<br/>
              ⚡ FLIP: exit when 15sec signal reverses<br/>
              🎯 BEST: wait min 4 bars then exit on flip
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
