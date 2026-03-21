import { useState } from "react";

var API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";

var TIMEFRAMES_BT = [
  { label: "5 MIN",  multiplier: 5,  timespan: "minute" },
  { label: "2 MIN",  multiplier: 2,  timespan: "minute" },
  { label: "15 SEC", multiplier: 15, timespan: "second" },
];

function btCalcSHA(candles) {
  if (candles.length < 5) return [];
  var k = 2 / 4;
  var ha = [];
  for (var i = 0; i < candles.length; i++) {
    var c = candles[i];
    var haC = (c.o + c.h + c.l + c.c) / 4;
    var haO = i === 0 ? (c.o + c.c) / 2 : (ha[i-1].o + ha[i-1].c) / 2;
    ha.push({ o: haO, c: haC });
  }
  var sO = ha[0].o, sC = ha[0].c;
  var result = [];
  for (var j = 0; j < ha.length; j++) {
    if (j === 0) { sO = ha[0].o; sC = ha[0].c; }
    else { sO = ha[j].o * k + sO * (1 - k); sC = ha[j].c * k + sC * (1 - k); }
    result.push({ bullish: sC >= sO });
  }
  return result;
}

function btCalcHT(candles) {
  var atrLen = 14, amp = 2;
  if (candles.length < atrLen + 2) return [];
  var trs = [];
  for (var i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i-1].c),
      Math.abs(candles[i].l - candles[i-1].c)
    ));
  }
  var atrVal = trs.slice(0, atrLen).reduce(function(a,b){return a+b;}, 0) / atrLen;
  var atrArr = [atrVal];
  for (var j = atrLen; j < trs.length; j++) {
    atrVal = (atrVal * (atrLen - 1) + trs[j]) / atrLen;
    atrArr.push(atrVal);
  }
  var offset = candles.length - atrArr.length;
  var trend = 0, nextTrend = 0;
  var maxLow = candles[0].l, minHigh = candles[0].h;
  var results = new Array(candles.length).fill(null);
  for (var ii = 1; ii < candles.length; ii++) {
    var ai = ii - offset;
    if (ai < 0) { results[ii] = { bullish: true }; continue; }
    var dev = amp * atrArr[ai];
    var highma = (candles[ii].h + candles[ii].l) / 2 + dev;
    var lowma  = (candles[ii].h + candles[ii].l) / 2 - dev;
    if (nextTrend === 1) {
      maxLow = Math.max(candles[ii].l, maxLow);
      if (highma < maxLow && trend !== 1) { trend = 1; nextTrend = 0; }
    } else {
      minHigh = Math.min(candles[ii].h, minHigh);
      if (lowma > minHigh && trend !== 0) { trend = 0; nextTrend = 1; }
    }
    results[ii] = { bullish: trend === 0 };
  }
  return results;
}

function btGetSignal(candles) {
  if (!candles || candles.length < 20) return null;
  var sha = btCalcSHA(candles);
  var ht  = btCalcHT(candles);
  if (!sha.length || !ht.length) return null;
  var s = sha[sha.length - 1];
  var h = ht[ht.length - 1];
  if (!s || !h) return null;
  if (s.bullish && h.bullish)   return "BUY";
  if (!s.bullish && !h.bullish) return "SELL";
  return "NEUTRAL";
}

async function btFetchCandles(symbol, multiplier, timespan, fromStr, toStr) {
  var url = "https://api.polygon.io/v2/aggs/ticker/" + symbol
    + "/range/" + multiplier + "/" + timespan + "/"
    + fromStr + "/" + toStr
    + "?adjusted=true&sort=asc&limit=5000&apiKey=" + API_KEY;
  var res  = await fetch(url);
  var data = await res.json();
  if (!data.results) return [];
  return data.results.map(function(r) {
    return { o: r.o, h: r.h, l: r.l, c: r.c, t: r.t };
  });
}

function btGetDateRange(days) {
  var to   = new Date();
  var from = new Date();
  from.setDate(from.getDate() - days * 2);
  return {
    from: from.toISOString().split("T")[0],
    to:   to.toISOString().split("T")[0]
  };
}

function btCalcStats(trades) {
  var total   = trades.length;
  var wins    = trades.filter(function(t){return t.win;}).length;
  var losses  = total - wins;
  var winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0";
  var totalPnl = trades.reduce(function(a,t){return a + parseFloat(t.pnlDollar);}, 0);
  var totalOpt = trades.reduce(function(a,t){return a + parseFloat(t.optionPnl);}, 0);
  var avgPnl   = total > 0 ? (totalPnl / total).toFixed(3) : "0";
  var winPnl   = trades.filter(function(t){return t.win;}).reduce(function(a,t){return a+parseFloat(t.pnlDollar);},0);
  var lossPnl  = Math.abs(trades.filter(function(t){return !t.win;}).reduce(function(a,t){return a+parseFloat(t.pnlDollar);},0));
  var profFactor = lossPnl > 0 ? (winPnl / lossPnl).toFixed(2) : "INF";
  var longs  = trades.filter(function(t){return t.dir==="BUY";}).length;
  var shorts = trades.filter(function(t){return t.dir==="SELL";}).length;
  var longWR  = longs  > 0 ? (trades.filter(function(t){return t.dir==="BUY"  && t.win;}).length / longs  * 100).toFixed(0) : "0";
  var shortWR = shorts > 0 ? (trades.filter(function(t){return t.dir==="SELL" && t.win;}).length / shorts * 100).toFixed(0) : "0";
  var avgBars = total > 0 ? (trades.reduce(function(a,t){return a+t.barsHeld;},0)/total).toFixed(1) : "0";
  var equity = 0;
  var curve = trades.map(function(t){
    equity += parseFloat(t.pnlDollar);
    return parseFloat(equity.toFixed(2));
  });
  return {
    total: total, wins: wins, losses: losses, winRate: winRate,
    totalPnl: totalPnl.toFixed(2), totalOpt: totalOpt.toFixed(0),
    avgPnl: avgPnl, profFactor: profFactor,
    longs: longs, shorts: shorts, longWR: longWR, shortWR: shortWR,
    avgBars: avgBars, curve: curve, trades: trades
  };
}

async function btRunBacktest(symbol, days, exitBars, onProgress) {
  var range = btGetDateRange(days + 3);

  onProgress("Fetching 5min candles...");
  var c5m  = await btFetchCandles(symbol, 5,  "minute", range.from, range.to);
  onProgress("Fetching 2min candles...");
  var c2m  = await btFetchCandles(symbol, 2,  "minute", range.from, range.to);
  onProgress("Fetching 15sec candles...");
  var c15s = await btFetchCandles(symbol, 15, "second", range.from, range.to);

  if (!c15s.length) return { error: "No 15sec data. Market may be closed or API limit reached." };

  onProgress("Building signal maps...");

  var sig5m = new Map();
  var sig2m = new Map();

  for (var i = 20; i < c5m.length; i++) {
    sig5m.set(c5m[i].t, btGetSignal(c5m.slice(0, i + 1)));
  }
  for (var j = 20; j < c2m.length; j++) {
    sig2m.set(c2m[j].t, btGetSignal(c2m.slice(0, j + 1)));
  }

  onProgress("Pre-computing 15sec signals...");
  var sig15s = [];
  for (var k = 0; k < c15s.length; k++) {
    sig15s.push(btGetSignal(c15s.slice(Math.max(0, k - 30), k + 1)));
  }

  function nearestSig(map, ts, windowMs) {
    var best = null, bestT = -Infinity;
    map.forEach(function(sig, t) {
      if (t <= ts && t >= ts - windowMs && t > bestT) { bestT = t; best = sig; }
    });
    return best;
  }

  function simulate(exitMode) {
    var trades = [];
    var inTrade = false, entryIdx = -1, entryPrice = 0, entryDir = null;

    for (var ii = 30; ii < c15s.length - exitBars - 1; ii++) {
      var barTs   = c15s[ii].t;
      var etHour  = new Date(barTs).getUTCHours() - 5;
      var etMins  = etHour * 60 + new Date(barTs).getUTCMinutes();
      if (etMins < 570 || etMins > 810) continue;

      if (inTrade) {
        var barsHeld = ii - entryIdx;
        var cur15    = sig15s[ii];
        var flipped  = entryDir === "BUY" ? cur15 === "SELL" : cur15 === "BUY";
        var doExit   = exitMode === "FIXED" ? barsHeld >= exitBars
                     : exitMode === "FLIP"  ? (flipped || barsHeld >= exitBars)
                     : ((flipped && barsHeld >= 4) || barsHeld >= exitBars);

        if (doExit) {
          var exitPrice  = c15s[ii].c;
          var pnlDollar  = entryDir === "BUY" ? exitPrice - entryPrice : entryPrice - exitPrice;
          var pnlPct     = entryDir === "BUY"
            ? ((exitPrice - entryPrice) / entryPrice * 100)
            : ((entryPrice - exitPrice) / entryPrice * 100);

          trades.push({
            entryTime:  new Date(c15s[entryIdx].t).toLocaleString("en-US", {timeZone:"America/New_York"}),
            exitTime:   new Date(c15s[ii].t).toLocaleString("en-US",       {timeZone:"America/New_York"}),
            dir:        entryDir,
            entry:      entryPrice.toFixed(2),
            exit:       exitPrice.toFixed(2),
            pnlPct:     pnlPct.toFixed(4),
            pnlDollar:  pnlDollar.toFixed(2),
            optionPnl:  (pnlDollar * 50).toFixed(0),
            win:        pnlPct > 0,
            barsHeld:   barsHeld,
            exitReason: (flipped && exitMode !== "FIXED") ? "FLIP" : "BARS"
          });
          inTrade = false;
        }
        continue;
      }

      var s5  = nearestSig(sig5m, barTs, 5 * 60 * 1000);
      var s2  = nearestSig(sig2m, barTs, 2 * 60 * 1000);
      if (!s5 || !s2) continue;

      if (s5 === "BUY" && s2 === "BUY") {
        inTrade = true; entryIdx = ii + 1;
        entryPrice = c15s[ii+1] ? c15s[ii+1].o : c15s[ii].c;
        entryDir = "BUY";
      } else if (s5 === "SELL" && s2 === "SELL") {
        inTrade = true; entryIdx = ii + 1;
        entryPrice = c15s[ii+1] ? c15s[ii+1].o : c15s[ii].c;
        entryDir = "SELL";
      }
    }
    return trades;
  }

  onProgress("Simulating FIXED exit...");
  var fixed = btCalcStats(simulate("FIXED"));

  onProgress("Simulating FLIP exit...");
  var flip  = btCalcStats(simulate("FLIP"));

  onProgress("Simulating BEST exit...");
  var best  = btCalcStats(simulate("BEST"));

  return { fixed: fixed, flip: flip, best: best, symbol: symbol, days: days, exitBars: exitBars };
}

function BtEquityCurve(props) {
  var curve = props.curve;
  var color = props.color;
  if (!curve || curve.length < 2) return null;
  var W = 540, H = 90, PAD = 20;
  var min = Math.min.apply(null, [0].concat(curve));
  var max = Math.max.apply(null, [0].concat(curve));
  var range = max - min || 1;
  function toX(i) { return PAD + (i / (curve.length - 1)) * (W - PAD * 2); }
  function toY(v) { return PAD + ((max - v) / range) * (H - PAD * 2); }
  var zero = toY(0);
  var path = curve.map(function(v, i) { return (i===0?"M":"L") + toX(i) + "," + toY(v); }).join(" ");
  var polyPts = toX(0)+","+zero+" "
    + curve.map(function(v,i){return toX(i)+","+toY(v);}).join(" ")
    + " "+toX(curve.length-1)+","+zero;

  return (
    <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:"auto",display:"block"}}>
      <defs>
        <linearGradient id={"g"+color.replace("#","")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1={PAD} y1={zero} x2={W-PAD} y2={zero} stroke="#1e1e2e" strokeWidth="1" strokeDasharray="3,3"/>
      <polygon points={polyPts} fill={"url(#g"+color.replace("#","")+")"}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2"/>
      <text x={W-PAD} y={H-3} fill={color} fontSize="9" textAnchor="end">
        {curve.length} trades / ${curve[curve.length-1]}
      </text>
    </svg>
  );
}

function BtModeCard(props) {
  var data = props.data, label = props.label, color = props.color, desc = props.desc;
  var wr = parseFloat(data.winRate);
  var pnlC = parseFloat(data.totalPnl) >= 0 ? "#00e87a" : "#ff3c3c";

  return (
    <div style={{background:"#0e0e1a",border:"2px solid "+color+"44",borderRadius:12,
      padding:"16px",flex:1,minWidth:220,display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:color,fontFamily:"'Courier New',monospace"}}>{label}</div>
          <div style={{fontSize:9,color:"#444466",marginTop:2}}>{desc}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:26,fontWeight:700,color:wr>=55?"#00e87a":"#ff3c3c"}}>{data.winRate}%</div>
          <div style={{fontSize:9,color:"#444466"}}>win rate</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {[
          ["TOTAL P&L",  (parseFloat(data.totalPnl)>=0?"+":"")+"$"+data.totalPnl, pnlC],
          ["OPT EST",    (parseFloat(data.totalOpt)>=0?"+":"")+"$"+data.totalOpt, pnlC],
          ["AVG TRADE",  (parseFloat(data.avgPnl)>=0?"+":"")+"$"+data.avgPnl,     pnlC],
          ["PROF FACTOR", data.profFactor, parseFloat(data.profFactor)>=1.5?"#00e87a":"#ff9800"],
          ["TRADES",     data.total,    "#e0e0ff"],
          ["AVG BARS",   data.avgBars,  "#888899"],
          ["LONG W/R",   data.longWR+"%",  "#38bdf8"],
          ["SHORT W/R",  data.shortWR+"%", "#e040fb"],
        ].map(function(row) {
          return (
            <div key={row[0]} style={{background:"#07070f",borderRadius:6,padding:"6px 10px"}}>
              <div style={{fontSize:8,color:"#333355",letterSpacing:1}}>{row[0]}</div>
              <div style={{fontSize:13,fontWeight:700,color:row[2],marginTop:2}}>{row[1]}</div>
            </div>
          );
        })}
      </div>
      <div style={{background:"#07070f",borderRadius:8,padding:"8px",overflow:"hidden"}}>
        <BtEquityCurve curve={data.curve} color={color}/>
      </div>
      <div style={{
        background: wr>=55?"#00e87a0a":"#ff3c3c0a",
        border: "1px solid "+(wr>=55?"#00e87a44":"#ff3c3c44"),
        borderRadius:8,padding:"8px 12px",textAlign:"center"
      }}>
        <div style={{fontSize:11,fontWeight:700,
          color:wr>=65?"#00e87a":wr>=55?"#88ffbb":wr>=45?"#ff9800":"#ff3c3c"}}>
          {wr>=65?"STRONG EDGE - TRADE IT":wr>=55?"POSITIVE EDGE":wr>=45?"MARGINAL":"NO EDGE YET"}
        </div>
      </div>
    </div>
  );
}

function BtTradeTable(props) {
  var trades = props.trades;
  var filter = props.filter;
  var setFilter = props.setFilter;

  var filtered = trades.filter(function(t) {
    if (filter==="WIN")   return t.win;
    if (filter==="LOSS")  return !t.win;
    if (filter==="LONG")  return t.dir==="BUY";
    if (filter==="SHORT") return t.dir==="SELL";
    if (filter==="FLIP")  return t.exitReason==="FLIP";
    return true;
  });

  return (
    <div style={{background:"#0e0e1a",border:"1px solid #1e1e2e",borderRadius:10,padding:"14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
        <div style={{fontSize:10,color:"#e0e0ff",fontWeight:700}}>TRADE LOG — {filtered.length} trades</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {["ALL","WIN","LOSS","LONG","SHORT","FLIP"].map(function(f) {
            return (
              <button key={f} onClick={function(){setFilter(f);}} style={{
                padding:"3px 9px",fontSize:9,fontFamily:"inherit",fontWeight:700,
                background:filter===f?"#00e87a22":"transparent",
                border:"1px solid "+(filter===f?"#00e87a":"#2a2a4a"),
                color:filter===f?"#00e87a":"#444466",
                borderRadius:4,cursor:"pointer"}}>
                {f}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{borderBottom:"1px solid #1e1e2e"}}>
              {["#","DIR","ENTRY TIME","ENTRY","EXIT","BARS","P&L $","P&L %","OPT","EXIT","RESULT"].map(function(h) {
                return <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:9,color:"#444466",letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map(function(t, i) {
              var pc = parseFloat(t.pnlDollar) >= 0 ? "#00e87a" : "#ff3c3c";
              var dc = t.dir === "BUY" ? "#00e87a" : "#ff3c3c";
              return (
                <tr key={i} style={{borderBottom:"1px solid #0a0a14"}}>
                  <td style={{padding:"6px 8px",color:"#333355",fontSize:10}}>{i+1}</td>
                  <td style={{padding:"6px 8px"}}>
                    <span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,
                      background:t.dir==="BUY"?"#00e87a22":"#ff3c3c22",color:dc,
                      border:"1px solid "+(t.dir==="BUY"?"#00e87a44":"#ff3c3c44")}}>
                      {t.dir==="BUY"?"UP":"DN"} {t.dir==="BUY"?"LONG":"SHORT"}
                    </span>
                  </td>
                  <td style={{padding:"6px 8px",color:"#555577",fontSize:10,whiteSpace:"nowrap"}}>{t.entryTime}</td>
                  <td style={{padding:"6px 8px",color:"#e0e0ff",fontWeight:700}}>${t.entry}</td>
                  <td style={{padding:"6px 8px",color:"#e0e0ff"}}>${t.exit}</td>
                  <td style={{padding:"6px 8px",color:"#888899"}}>{t.barsHeld}</td>
                  <td style={{padding:"6px 8px",fontWeight:700,color:pc}}>{parseFloat(t.pnlDollar)>=0?"+":""}${t.pnlDollar}</td>
                  <td style={{padding:"6px 8px",color:pc}}>{parseFloat(t.pnlPct)>=0?"+":""}{parseFloat(t.pnlPct).toFixed(3)}%</td>
                  <td style={{padding:"6px 8px",fontWeight:700,color:pc}}>{parseFloat(t.optionPnl)>=0?"+":""}${t.optionPnl}</td>
                  <td style={{padding:"6px 8px"}}>
                    <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,
                      background:t.exitReason==="FLIP"?"#e040fb22":"#2a2a4a22",
                      color:t.exitReason==="FLIP"?"#e040fb":"#555577",
                      border:"1px solid "+(t.exitReason==="FLIP"?"#e040fb44":"#2a2a4a")}}>
                      {t.exitReason==="FLIP"?"FLIP":"BARS"}
                    </span>
                  </td>
                  <td style={{padding:"6px 8px"}}>
                    <span style={{padding:"2px 7px",borderRadius:3,fontSize:9,fontWeight:700,
                      background:t.win?"#00e87a22":"#ff3c3c22",
                      color:t.win?"#00e87a":"#ff3c3c"}}>
                      {t.win?"WIN":"LOSS"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScalpBacktest() {
  var symbolState    = useState("SPY");
  var symbol         = symbolState[0], setSymbol = symbolState[1];

  var daysState      = useState(5);
  var days           = daysState[0], setDays = daysState[1];

  var exitBarsState  = useState(7);
  var exitBars       = exitBarsState[0], setExitBars = exitBarsState[1];

  var runningState   = useState(false);
  var running        = runningState[0], setRunning = runningState[1];

  var progressState  = useState("");
  var progress       = progressState[0], setProgress = progressState[1];

  var resultState    = useState(null);
  var result         = resultState[0], setResult = resultState[1];

  var errorState     = useState(null);
  var error          = errorState[0], setError = errorState[1];

  var modeState      = useState("fixed");
  var activeMode     = modeState[0], setActiveMode = modeState[1];

  var filterState    = useState("ALL");
  var filter         = filterState[0], setFilter = filterState[1];

  function run() {
    setRunning(true); setResult(null); setError(null); setProgress("Starting...");
    btRunBacktest(symbol.toUpperCase(), days, exitBars, setProgress).then(function(r) {
      if (r.error) { setError(r.error); }
      else { setResult(r); setActiveMode("fixed"); }
      setRunning(false); setProgress("");
    }).catch(function(e) {
      setError("Error: " + e.message);
      setRunning(false); setProgress("");
    });
  }

  var modes = [
    { key:"fixed", label:"FIXED",  color:"#00e87a", desc:"Exit after exactly "+exitBars+" bars ("+exitBars*15+"sec)" },
    { key:"flip",  label:"FLIP",   color:"#e040fb", desc:"Exit on 15sec SHA+HT flip OR "+exitBars+" bars max" },
    { key:"best",  label:"BEST",   color:"#f59e0b", desc:"Min 4 bars held + flip OR "+exitBars+" bars max" },
  ];

  var winner = null;
  if (result) {
    var keys = ["fixed","flip","best"];
    winner = keys.sort(function(a,b) {
      return parseFloat(result[b].winRate) - parseFloat(result[a].winRate);
    })[0];
  }

  return (
    <div style={{minHeight:"100vh",background:"#07070f",fontFamily:"'Courier New',monospace",
      color:"#e0e0ff",padding:"20px 16px"}}>
      <style>{"* { box-sizing: border-box; margin: 0; padding: 0; }"}</style>

      <div style={{maxWidth:1200,margin:"0 auto"}}>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:"#00e87a",letterSpacing:4,marginBottom:4}}>ATM MACHINE — BACKTEST ENGINE</div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:2}}>SCALP BACKTESTER</div>
          <div style={{fontSize:10,color:"#333355",marginTop:4}}>SHA + HALFTREND - 5MIN + 2MIN ENTRY - 3 EXIT STRATEGIES</div>
        </div>

        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end",
          background:"#0e0e1a",border:"1px solid #1e1e2e",borderRadius:12,
          padding:"16px 18px",marginBottom:20}}>
          <div>
            <div style={{fontSize:9,color:"#555577",marginBottom:4,letterSpacing:1}}>SYMBOL</div>
            <input value={symbol} onChange={function(e){setSymbol(e.target.value.toUpperCase());}}
              style={{width:80,background:"#07070f",border:"2px solid #2a2a4a",borderRadius:6,
                color:"#00e87a",padding:"8px 10px",fontSize:16,fontFamily:"inherit",
                fontWeight:700,outline:"none",textAlign:"center"}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#555577",marginBottom:4,letterSpacing:1}}>DAYS</div>
            <select value={days} onChange={function(e){setDays(Number(e.target.value));}}
              style={{background:"#07070f",border:"2px solid #2a2a4a",borderRadius:6,
                color:"#e0e0ff",padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={10}>10 days</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#555577",marginBottom:4,letterSpacing:1}}>MAX EXIT BARS</div>
            <select value={exitBars} onChange={function(e){setExitBars(Number(e.target.value));}}
              style={{background:"#07070f",border:"2px solid #2a2a4a",borderRadius:6,
                color:"#e0e0ff",padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value={4}>4 bars (60sec)</option>
              <option value={5}>5 bars (75sec)</option>
              <option value={6}>6 bars (90sec)</option>
              <option value={7}>7 bars (105sec)</option>
              <option value={8}>8 bars (120sec)</option>
              <option value={10}>10 bars (150sec)</option>
            </select>
          </div>
          <button onClick={run} disabled={running} style={{
            padding:"10px 24px",
            background:running?"#0e0e1a":"#00e87a22",
            border:"2px solid "+(running?"#2a2a4a":"#00e87a"),
            borderRadius:8,color:running?"#444466":"#00e87a",
            fontSize:12,fontFamily:"inherit",fontWeight:700,
            cursor:running?"not-allowed":"pointer",letterSpacing:1}}>
            {running?"RUNNING...":"RUN BACKTEST"}
          </button>
          {running && (
            <div style={{fontSize:10,color:"#00e87a"}}>{progress}</div>
          )}
        </div>

        {error && (
          <div style={{background:"#1a0505",border:"1px solid #ff3c3c44",borderRadius:8,
            padding:"12px 16px",color:"#ff3c3c",fontSize:12,marginBottom:20}}>
            {error}
          </div>
        )}

        {result && (
          <div>
            {winner && (
              <div style={{background:"#0a1a0a",border:"2px solid #00e87a66",
                borderRadius:10,padding:"12px 18px",marginBottom:18,
                display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:"#00e87a",letterSpacing:2}}>BEST STRATEGY</div>
                <div style={{fontSize:18,fontWeight:700,
                  color:modes.filter(function(m){return m.key===winner;})[0].color}}>
                  {modes.filter(function(m){return m.key===winner;})[0].label} — {result[winner].winRate}% WIN RATE
                </div>
                <div style={{fontSize:10,color:"#555577"}}>
                  {result[winner].total} trades / ${result[winner].totalPnl} total / Prof factor {result[winner].profFactor}
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:18}}>
              {modes.map(function(m) {
                return (
                  <BtModeCard key={m.key} data={result[m.key]}
                    label={m.label} color={m.color} desc={m.desc}/>
                );
              })}
            </div>

            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              <div style={{fontSize:10,color:"#555577",alignSelf:"center"}}>VIEW TRADES:</div>
              {modes.map(function(m) {
                return (
                  <button key={m.key}
                    onClick={function(){setActiveMode(m.key); setFilter("ALL");}}
                    style={{
                      padding:"6px 16px",fontSize:10,fontFamily:"inherit",fontWeight:700,
                      background:activeMode===m.key?m.color+"22":"transparent",
                      border:"1px solid "+(activeMode===m.key?m.color:"#2a2a4a"),
                      color:activeMode===m.key?m.color:"#444466",
                      borderRadius:6,cursor:"pointer"}}>
                    {m.label} ({result[m.key].total})
                  </button>
                );
              })}
            </div>

            <BtTradeTable
              trades={result[activeMode].trades}
              filter={filter}
              setFilter={setFilter}/>

            <div style={{marginTop:14,padding:"10px 14px",background:"#0a0a14",
              border:"1px solid #1e1e2e",borderRadius:8,fontSize:9,color:"#333355"}}>
              Options estimate = 1 ATM contract x delta 0.5 x 100 shares. Educational only. No slippage modeled.
            </div>
          </div>
        )}

        {!result && !running && (
          <div style={{textAlign:"center",padding:"60px 20px",color:"#222233"}}>
            <div style={{fontSize:36,marginBottom:12,color:"#1a1a2a"}}>TEST</div>
            <div style={{fontSize:12,letterSpacing:2,color:"#333355"}}>PRESS RUN BACKTEST</div>
            <div style={{fontSize:10,marginTop:10,color:"#1e1e2e",lineHeight:2}}>
              FIXED: exit after N bars<br/>
              FLIP: exit on 15sec reversal<br/>
              BEST: min 4 bars then flip
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
