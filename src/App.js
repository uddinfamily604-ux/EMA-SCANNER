import { useState, useCallback, useEffect, useRef } from "react";

// ─── MOBILE HOOK ──────────────────────────────────────────────────────────────
function useMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}
// Inject global mobile CSS once
if (typeof document !== "undefined" && !document.getElementById("atm-mobile-css")) {
  const s = document.createElement("style");
  s.id = "atm-mobile-css";
  s.textContent = `
    *{box-sizing:border-box;}
    body{overflow-x:hidden;-webkit-text-size-adjust:100%;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:#080e1a;}
    ::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:2px;}
    @media(max-width:768px){
      input,button,select{font-size:16px!important;}
    }
  `;
  document.head.appendChild(s);
}

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";
const ANTHROPIC_KEY = "YOUR_ANTHROPIC_API_KEY_HERE";
const BASE_URL = "https://api.polygon.io";
const DEFAULT_SYMBOLS = ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","SOFI","PLTR","MARA","COIN","RIVN","BABA","BAC","JPM","GS","IWM"];

const WATCHLIST_PRESETS = {
  "⭐ My Favorites": ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","SOFI","PLTR","MARA","COIN","RIVN","BABA","BAC","JPM","GS","IWM"],
  "📊 S&P 500 Core": ["AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","JPM","V","UNH","XOM","LLY","JNJ","WMT","MA","PG","AVGO","HD","CVX","MRK","ABBV","COST","PEP","KO","ADBE","WFC","CRM","TMO","ACN","MCD","CSCO","ABT","GE","BAC","LIN","DHR","TXN","NEE","PM","RTX","AMGN","IBM","INTU","UPS","CAT","SPGI","LOW","GS","ISRG","BKNG","ELV","SYK","VRTX","BLK","AXP","PLD","CB","MDT","GILD","ADI","MS","REGN","MMC","CI","TJX","CME","ZTS","C","MO","DUK","SO","PNC","USB","ICE","NOC","ITW","AON","EOG","SLB","FDX","CL","MCK","PSX","EMR","MPC","VLO","FCX","NEM","WM","EW","F","GM","HON","GD","LMT","NSC","CSX","UNP","DE","MMM","APD","ECL","KLAC","LRCX","AMAT","MRVL","MU","INTC","AMD","QCOM","ORCL","NOW"],
  "🔥 High Volume Tech": ["AAPL","MSFT","NVDA","AMD","INTC","TSLA","AMZN","META","GOOGL","NFLX","SHOP","SQ","PYPL","COIN","MELI","UBER","ABNB","RBLX","SPOT","NOW","SNOW","PANW","CRWD","ZS","DDOG","NET","TEAM","OKTA","ADBE","CRM","ORCL","IBM","QCOM","AVGO","AMAT","LRCX","KLAC","MU","MRVL","TXN","ADI"],
  "💊 Biotech/Health": ["UNH","JNJ","LLY","ABBV","MRK","ABT","TMO","MDT","BMY","PFE","MRNA","BNTX","BIIB","ILMN","GILD","AMGN","REGN","VRTX","IQV","LH","DGX","HCA","CNC","MOH","HUM","ELV","SYK","EW","ISRG","ZTS"],
  "🏦 Financials": ["JPM","BAC","WFC","GS","MS","C","BLK","AXP","V","MA","PNC","USB","TFC","COF","DFS","SYF","ALLY","ICE","CME","SPGI","MMC","AON","CB","PLD","AMT","CCI","EQIX"],
  "⚡ Russell Liquid >$20 >700k": ["AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","JPM","V","UNH","XOM","LLY","JNJ","WMT","MA","PG","AVGO","HD","CVX","MRK","ABBV","COST","PEP","KO","ADBE","WFC","CRM","TMO","ACN","MCD","CSCO","ABT","GE","BAC","LIN","DHR","TXN","NEE","PM","RTX","AMGN","IBM","INTU","UPS","CAT","SPGI","LOW","GS","ISRG","BKNG","SYK","VRTX","BLK","AXP","MDT","GILD","ADI","MS","REGN","TJX","CME","ZTS","C","DUK","SO","PNC","USB","ICE","NOC","ITW","EOG","SLB","FDX","PSX","EMR","MPC","VLO","FCX","NEM","WM","F","GM","HON","GD","LMT","NSC","CSX","UNP","DE","APD","KLAC","LRCX","AMAT","MRVL","MU","INTC","AMD","QCOM","ORCL","NOW","SNOW","PANW","CRWD","DDOG","NET","SHOP","PYPL","COIN","MELI","UBER","ABNB","NFLX","DIS","CMCSA","T","VZ","TMUS","AMT","CCI","EQIX","OKE","WMB","KMI","OXY","HAL","DVN","MRO","CLF","NUE","STLD","DOW","SHW","CARR","ROK","PH","CTAS","FAST","ODFL","JBHT","CMG","SBUX","MCD","DRI","HCA","CNC","HUM","BMY","PFE","MRNA","BIIB","ILMN","IQV","COF","DFS","ALLY","SPY","QQQ","IWM","XLF","XLK","XLE","XLV","XLY","BA","DAL","UAL","AAL","LUV","CCL","RCL","MGM","WYNN","LVS","PENN","DKNG","NKE","TGT","COST","DG","DLTR","ETSY","W","ROKU","TTD","ENPH","FSLR","NLY","AGNC"],
};

// ─── SOUND ENGINE ─────────────────────────────────────────────────────────────
function playAlertSound(type="signal") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = type==="signal"
      ? [{f:880,t:0,d:0.15},{f:1100,t:0.18,d:0.15},{f:1320,t:0.36,d:0.25},{f:1760,t:0.64,d:0.4}]
      : [{f:440,t:0,d:0.1},{f:550,t:0.12,d:0.1}];
    notes.forEach(({f,t,d})=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value=f; osc.type="sine";
      gain.gain.setValueAtTime(0,ctx.currentTime+t);
      gain.gain.linearRampToValueAtTime(0.4,ctx.currentTime+t+0.02);
      gain.gain.linearRampToValueAtTime(0,ctx.currentTime+t+d);
      osc.start(ctx.currentTime+t);
      osc.stop(ctx.currentTime+t+d+0.05);
    });
  } catch(e){}
}

// ─── PUSHOVER NOTIFICATION ────────────────────────────────────────────────────
async function sendPushover(userKey, apiToken, title, message) {
  if(!userKey||!apiToken) return {ok:false,error:"No credentials"};
  try {
    const body = new FormData();
    body.append("token", apiToken);
    body.append("user", userKey);
    body.append("title", title);
    body.append("message", message);
    body.append("priority", "1");
    body.append("sound", "cashregister");
    const res = await fetch("https://api.pushover.net/1/messages.json", {method:"POST",body});
    const data = await res.json();
    return {ok: data.status===1, error: data.errors?.join(", ")||""};
  } catch(e){ return {ok:false,error:e.message}; }
}

// ─── SIGNAL LOG (global, persists across re-renders) ─────────────────────────
let SIGNAL_LOG = [];
try { SIGNAL_LOG = JSON.parse(localStorage.getItem("alo_signal_log")||"[]"); } catch(e){}
function addSignalLog(entry) {
  const enriched = {
    ...entry,
    id: Date.now(),
    entryPrice: parseFloat(entry.price),
    p15: null, p30: null, p60: null, pEOD: null,   // price snapshots
    pnl15: null, pnl30: null, pnl60: null,           // % moves
    checked15: false, checked30: false, checked60: false,
  };
  SIGNAL_LOG = [enriched, ...SIGNAL_LOG].slice(0, 200);
  try { localStorage.setItem("alo_signal_log", JSON.stringify(SIGNAL_LOG)); } catch(e){}
}
function clearSignalLog() {
  SIGNAL_LOG = [];
  try { localStorage.removeItem("alo_signal_log"); } catch(e){}
}
function saveSignalLog() {
  try { localStorage.setItem("alo_signal_log", JSON.stringify(SIGNAL_LOG)); } catch(e){}
}

// ── Update signal performance with a fetched price ──
async function checkSignalPerformance() {
  const now = Date.now();
  let updated = false;
  for(let i = 0; i < SIGNAL_LOG.length; i++) {
    const s = SIGNAL_LOG[i];
    if(!s.id || !s.entryPrice) continue;
    const age = (now - s.id) / 1000 / 60; // minutes since signal
    const needsCheck = (!s.checked15 && age >= 15) || (!s.checked30 && age >= 30) || (!s.checked60 && age >= 60);
    if(!needsCheck) continue;
    try {
      const res = await fetch(`https://api.polygon.io/v2/last/trade/${s.symbol}?apiKey=${API_KEY}`);
      const data = await res.json();
      const cur = data.results?.p;
      if(!cur) continue;
      const pct = ((cur - s.entryPrice) / s.entryPrice * 100);
      const isLong = s.direction === "BUY";
      const signedPct = isLong ? pct : -pct; // positive = signal was correct
      if(!s.checked15 && age >= 15) {
        SIGNAL_LOG[i] = {...s, checked15:true, p15:cur.toFixed(2), pnl15:signedPct.toFixed(2)};
        s.checked15 = true; s.p15 = cur.toFixed(2); s.pnl15 = signedPct.toFixed(2);
        updated = true;
      }
      if(!s.checked30 && age >= 30) {
        SIGNAL_LOG[i] = {...SIGNAL_LOG[i], checked30:true, p30:cur.toFixed(2), pnl30:signedPct.toFixed(2)};
        updated = true;
      }
      if(!s.checked60 && age >= 60) {
        SIGNAL_LOG[i] = {...SIGNAL_LOG[i], checked60:true, p60:cur.toFixed(2), pnl60:signedPct.toFixed(2)};
        updated = true;
      }
    } catch(e) {}
  }
  if(updated) saveSignalLog();
  return updated;
}

// ─── P&L TRACKER ─────────────────────────────────────────────────────────────


// ─── MARKET HOURS CHECK ───────────────────────────────────────────────────────
function isMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", {timeZone:"America/New_York"}));
  const day = et.getDay();
  if(day === 0 || day === 6) return false;
  const h = et.getHours(), m = et.getMinutes();
  const mins = h * 60 + m;
  return mins >= 570 && mins < 960;
}
function getETTime() {
  return new Date().toLocaleTimeString("en-US", {timeZone:"America/New_York", hour:"2-digit", minute:"2-digit", second:"2-digit"});
}
function getETDateTime() {
  return new Date().toLocaleString("en-US", {timeZone:"America/New_York", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"});
}
function MarketBanner() {
  const open = isMarketOpen();
  if(open) return null;
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
  const day = et.getDay();
  const isWeekend = day===0||day===6;
  return (
    <div style={{background:"#1a0a00",border:"1px solid #ff6600",borderRadius:6,padding:"8px 14px",margin:"8px 12px",display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:16}}>⚠️</span>
      <span style={{fontSize:11,color:"#ff9800",fontWeight:700}}>
        {isWeekend ? "MARKET CLOSED — Weekend. Opens Monday 9:30 AM ET." : "MARKET CLOSED — After hours. Opens 9:30 AM ET. Data may be delayed or empty."}
      </span>
    </div>
  );
}

// ─── TIMEFRAME PARSER ─────────────────────────────────────────────────────────
function parseTF(tf) {
  const s = tf.trim().toLowerCase();
  if (s.endsWith("s")) return { multiplier: parseInt(s), timespan: "second" };
  if (s.endsWith("m")) return { multiplier: parseInt(s), timespan: "minute" };
  if (s.endsWith("h")) return { multiplier: parseInt(s), timespan: "hour" };
  if (s.endsWith("d")) return { multiplier: 1, timespan: "day" };
  if (s.endsWith("w")) return { multiplier: 1, timespan: "week" };
  return { multiplier: parseInt(s) || 1, timespan: "minute" };
}
function daysBack(timespan) {
  if (timespan === "second") return 2;
  if (timespan === "minute") return 7;
  if (timespan === "hour") return 60;
  if (timespan === "day") return 500;
  return 900;
}

// ─── FETCH ────────────────────────────────────────────────────────────────────
async function fetchCandles(symbol, tf) {
  try {
    const { multiplier, timespan } = parseTF(tf);
    const now = new Date();

    // ── Cache key: symbol + tf + date + hour (intraday TFs refresh hourly, daily refreshes once) ──
    const today = now.toISOString().split("T")[0];
    const hour = now.getHours();
    const isIntraday = ["minute","hour"].includes(timespan);
    const cacheKey = `bondo_candles_${symbol}_${tf}_${today}${isIntraday ? "_h"+hour : ""}`;

    // ── Check cache first ──
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.closes && parsed.closes.length > 0) return parsed;
      }
    } catch(cacheErr) {}

    const from = new Date(now);
    from.setDate(from.getDate() - daysBack(timespan));
    const fromStr = from.toISOString().split("T")[0];
    const toStr = today;
    const url = `${BASE_URL}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    const result = {
      closes: data.results.map(r => r.c),
      opens:  data.results.map(r => r.o),
      highs:  data.results.map(r => r.h),
      lows:   data.results.map(r => r.l),
    };

    // ── Save to cache ──
    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(cacheErr) {}

    return result;
  } catch(e) { return null; }
}

// ── Purge old candle cache entries ──
function purgeOldCandleCache() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const hour = new Date().getHours();
    const toDelete = [];
    for(let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if(!key || !key.startsWith("bondo_candles_")) continue;
      // Delete if not today's date
      if(!key.includes(today)) { toDelete.push(key); continue; }
      // Delete intraday candles older than current hour
      const hourMatch = key.match(/_h(\d+)$/);
      if(hourMatch && parseInt(hourMatch[1]) < hour) toDelete.push(key);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
    if(toDelete.length > 0) console.log("🧹 Purged", toDelete.length, "old candle cache entries");
  } catch(e) {}
}

// ─── EMA UTILS ────────────────────────────────────────────────────────────────
function calcEMASeries(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a,b)=>a+b,0)/period;
  const result = [ema];
  for (let i = period; i < prices.length; i++) { ema = prices[i]*k + ema*(1-k); result.push(ema); }
  return result;
}
function calcSlope(arr, period=8) {
  if (arr.length < period) return 0;
  const slice = arr.slice(-period).filter(v=>v!==null&&!isNaN(v));
  if (slice.length < 3) return 0;
  const n=slice.length, xM=(n-1)/2, yM=slice.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  for(let i=0;i<n;i++){num+=(i-xM)*(slice[i]-yM);den+=(i-xM)**2;}
  return den===0?0:num/den;
}
function slopeToStrength(slope,price){ if(!price) return 0; return Math.min(100,Math.round(Math.abs(slope)/price*10000*80)); }
function getSlopeLabel(s){ return s>=80?"EXTREME":s>=60?"STRONG":s>=40?"MODERATE":s>=20?"WEAK":"FLAT"; }
function getSlopeColor(s){ return s>=80?"#ff1744":s>=60?"#ff5722":s>=40?"#ff9800":s>=20?"#ffeb3b":"#546e7a"; }
function detectBounce(closes,lows,emaSeries){
  if(!closes||closes.length<20||!emaSeries||emaSeries.length<10) return {hasBounce:false,bounceUp:"0"};
  const rl=lows?lows.slice(-10):closes.slice(-10);
  const cur=closes[closes.length-1], low=Math.min(...rl);
  const bu=(cur-low)/low*100;
  const lastEMA=emaSeries[emaSeries.length-1];
  return {hasBounce:bu>1.0&&bu<8.0,bounceUp:bu.toFixed(2),nearEMA:Math.abs(cur-lastEMA)/lastEMA*100<1.5};
}
function detectRedRejection(opens,closes,emaSeries){
  if(!opens||!closes||opens.length<3||!emaSeries||emaSeries.length<3) return false;
  const lo=opens[opens.length-1],lc=closes[closes.length-1],le=emaSeries[emaSeries.length-1];
  const isRed=lc<lo, sz=Math.abs(lo-lc)/lo*100;
  const touched=Math.min(lo,lc)<=le&&Math.max(lo,lc)>=le*0.99;
  return isRed&&sz>0.2&&(touched||lo>le*0.995);
}
async function analyzeEMA(symbol, e1p, e2p, e3p, tf, minSlope) {
  try {
    const candles = await fetchCandles(symbol, tf);
    if(!candles||candles.closes.length<e3p+10) return null;
    const {closes,opens,highs,lows}=candles;
    const price=closes[closes.length-1];
    const e1S=calcEMASeries(closes,e1p),e2S=calcEMASeries(closes,e2p),e3S=calcEMASeries(closes,e3p);
    const e1=e1S[e1S.length-1],e2=e2S[e2S.length-1],e3=e3S[e3S.length-1];
    if(!e1||!e2||!e3) return null;
    const sl1=calcSlope(e1S),sl2=calcSlope(e2S),sl3=calcSlope(e3S);
    const st1=slopeToStrength(sl1,price),st2=slopeToStrength(sl2,price),st3=slopeToStrength(sl3,price);
    const avg=Math.round((st1+st2+st3)/3);
    if(avg<minSlope) return null;
    const spread=Math.abs(e3-e1),spreadPct=(spread/e1)*100,compressed=spreadPct<1.5;
    const aSD=sl1<0&&sl2<0&&sl3<0,aSU=sl1>0&&sl2>0&&sl3>0;
    const d1=((price-e1)/e1)*100,d2=((price-e2)/e2)*100,d3=((price-e3)/e3)*100;
    const bd=detectBounce(closes,lows,e3S),rr=detectRedRejection(opens,closes,e3S);
    const sw=aSD&&bd.hasBounce&&rr;
    let score=0;
    if(aSD||aSU)score+=35;if(compressed)score+=25;
    score+=Math.max(0,20-spreadPct*8);score+=Math.min(20,avg/5);if(sw)score+=10;
    return {
      symbol,price:price.toFixed(2),
      ema1:e1.toFixed(2),ema2:e2.toFixed(2),ema3:e3.toFixed(2),
      spread:spread.toFixed(2),spreadPct:spreadPct.toFixed(3),
      slope1:sl1,slope2:sl2,slope3:sl3,
      strength1:st1,strength2:st2,strength3:st3,avgStrength:avg,
      allSlopingDown:aSD,allSlopingUp:aSU,compressed,
      distFromE1:d1.toFixed(2),distFromE2:d2.toFixed(2),distFromE3:d3.toFixed(2),
      trend:aSD?"BEARISH":aSU?"BULLISH":"MIXED",
      score:Math.min(100,Math.round(score)),
      bounceDetected:bd.hasBounce,bounceUp:bd.bounceUp,nearEMA:bd.nearEMA,
      redRejection:rr,swingSignal:sw,
    };
  } catch(e){return null;}
}

// ─── HALFTREND ENGINE ─────────────────────────────────────────────────────────
function calcATR(highs,lows,closes,period=100){
  if(closes.length<period+1) return [];
  const trs=[];
  for(let i=1;i<closes.length;i++){
    trs.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])));
  }
  let atr=trs.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const atrs=[atr];
  for(let i=period;i<trs.length;i++){atr=(atr*(period-1)+trs[i])/period;atrs.push(atr);}
  return atrs;
}
function calcSMA(arr,period){
  const result=[];
  for(let i=0;i<arr.length;i++){
    if(i<period-1){result.push(null);continue;}
    result.push(arr.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period);
  }
  return result;
}
function highestIn(arr,from,to){let m=-Infinity;for(let i=from;i<=to;i++)if(arr[i]>m)m=arr[i];return m;}
function lowestIn(arr,from,to){let m=Infinity;for(let i=from;i<=to;i++)if(arr[i]<m)m=arr[i];return m;}

function calcHalfTrend(highs,lows,closes,amplitude=2){
  const n=closes.length;
  if(n<115) return null;
  const atrFull=calcATR(highs,lows,closes,100);
  const atrOff=closes.length-atrFull.length;
  const highma=calcSMA(highs,amplitude);
  const lowma=calcSMA(lows,amplitude);
  let trend=0,nextTrend=0;
  let maxLowPrice=lows[0],minHighPrice=highs[0];
  let up=0,down=0;
  const trends=[];
  for(let i=1;i<n;i++){
    const ai=i-atrOff;
    if(ai<0){trends.push(trend);continue;}
    const hb=Math.max(0,i-amplitude+1);
    const highPrice=highestIn(highs,hb,i);
    const lowPrice=lowestIn(lows,hb,i);
    const hma=highma[i],lma=lowma[i];
    const prevLow=lows[i-1],prevHigh=highs[i-1];
    if(nextTrend===1){
      maxLowPrice=Math.max(lowPrice,maxLowPrice);
      if(hma!==null&&hma<maxLowPrice&&closes[i]<prevLow){trend=1;nextTrend=0;minHighPrice=highPrice;}
    } else {
      minHighPrice=Math.min(highPrice,minHighPrice);
      if(lma!==null&&lma>minHighPrice&&closes[i]>prevHigh){trend=0;nextTrend=1;maxLowPrice=lowPrice;}
    }
    if(trend===0){
      const prev=trends.length>0?trends[trends.length-1]:0;
      if(prev!==0) up=down; else up=Math.max(maxLowPrice,up||maxLowPrice);
    } else {
      const prev=trends.length>0?trends[trends.length-1]:1;
      if(prev!==1) down=up; else down=Math.min(minHighPrice,down||minHighPrice);
    }
    trends.push(trend);
  }
  const cur=trends[trends.length-1];
  const prev=trends.length>1?trends[trends.length-2]:cur;
  return { trend:cur, sellSignal:cur===1&&prev===0, buySignal:cur===0&&prev===1, direction:cur===0?"BULL":"BEAR" };
}

// ─── SMOOTHED HEIKIN ASHI ENGINE ──────────────────────────────────────────────
function calcEMASlice(arr, from, to, period) {
  const slice = arr.slice(from, to+1);
  if(slice.length === 0) return arr[to]||0;
  if(slice.length < period) return slice.reduce((a,b)=>a+b,0)/slice.length;
  const k = 2/(period+1);
  let ema = slice.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<slice.length;i++) ema = slice[i]*k + ema*(1-k);
  return ema;
}
function calcSmoothHeikinAshi(opens, highs, lows, closes, smoothLen=10) {
  const n = closes.length;
  if(n < smoothLen + 5) return null;
  const smO=[], smH=[], smL=[], smC=[];
  for(let i=0;i<n;i++){
    const slice = Math.min(i+1, smoothLen);
    const from = i - slice + 1;
    smO.push(calcEMASlice(opens, from, i, smoothLen));
    smH.push(calcEMASlice(highs, from, i, smoothLen));
    smL.push(calcEMASlice(lows, from, i, smoothLen));
    smC.push(calcEMASlice(closes, from, i, smoothLen));
  }
  const haO=[], haC=[];
  for(let i=0;i<n;i++){
    const hac = (smO[i]+smH[i]+smL[i]+smC[i])/4;
    haC.push(hac);
    if(i===0) haO.push((smO[i]+smC[i])/2);
    else haO.push((haO[i-1]+haC[i-1])/2);
  }
  const dsmO=[], dsmC=[];
  for(let i=0;i<n;i++){
    dsmO.push(calcEMASlice(haO, Math.max(0,i-smoothLen+1), i, smoothLen));
    dsmC.push(calcEMASlice(haC, Math.max(0,i-smoothLen+1), i, smoothLen));
  }
  const curO = dsmO[dsmO.length-1];
  const curC = dsmC[dsmC.length-1];
  const prevO = dsmO[dsmO.length-2]||curO;
  const prevC = dsmC[dsmC.length-2]||curC;
  const isBull = curC > curO;
  const wasBull = prevC > prevO;
  return { direction: isBull ? "UP" : "DOWN", isBull, flipped: isBull !== wasBull };
}

async function analyzeSHAHT(symbol, tf) {
  const c = await fetchCandles(symbol, tf);
  if(!c || c.closes.length < 120) return null;
  const ht = calcHalfTrend(c.highs, c.lows, c.closes);
  const sha = calcSmoothHeikinAshi(c.opens, c.highs, c.lows, c.closes);
  if(!ht || !sha) return null;
  const price = c.closes[c.closes.length-1].toFixed(2);
  const algo1 = sha.isBull ? "UP" : "DOWN";
  const algo2 = ht.trend === 0 ? "UP" : "DOWN";
  const agree = algo1 === algo2;
  return { algo1, algo2, agree, htSellSignal: ht.sellSignal, htBuySignal: ht.buySignal, shaFlipped: sha.flipped, price, isBull: sha.isBull, htTrend: ht.trend };
}

async function analyzeHTOnly(symbol, tf) {
  const c = await fetchCandles(symbol, tf);
  if(!c||c.closes.length<120) return null;
  const ht = calcHalfTrend(c.highs,c.lows,c.closes);
  if(!ht) return null;
  return {...ht, price:c.closes[c.closes.length-1].toFixed(2), candlesAgo:ht.candlesAgo, freshSignal:ht.freshSignal};
}

// ─── STOCK QUALITY METRICS ────────────────────────────────────────────────────
// Fetches daily candles and computes: RelVol, ATR%, EMA distance
async function getStockMetrics(symbol) {
  try {
    // ── Cache check ──
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `bondo_metrics_${symbol}_${today}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if(cached) { const p = JSON.parse(cached); if(p && p.score !== undefined) return p; }
    } catch(e) {}

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 60);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = today;
    const url = `${BASE_URL}/v2/aggs/ticker/${symbol}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=100&apiKey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.results || data.results.length < 20) return null;

    const bars = data.results;
    const n = bars.length;
    const closes = bars.map(b=>b.c);
    const highs  = bars.map(b=>b.h);
    const lows   = bars.map(b=>b.l);
    const vols   = bars.map(b=>b.v);

    // ── Relative Volume (today vs 20-day avg) ──
    const todayVol = vols[n-1];
    const avgVol20 = vols.slice(-21,-1).reduce((a,b)=>a+b,0)/20;
    const relVol = avgVol20>0 ? parseFloat((todayVol/avgVol20).toFixed(2)) : 0;

    // ── ATR% (14-day Average True Range as % of price) ──
    let atrSum=0;
    for(let i=n-14;i<n;i++){
      const tr=Math.max(
        highs[i]-lows[i],
        Math.abs(highs[i]-closes[i-1]),
        Math.abs(lows[i]-closes[i-1])
      );
      atrSum+=tr;
    }
    const atr14 = atrSum/14;
    const price = closes[n-1];
    const atrPct = parseFloat((atr14/price*100).toFixed(2));

    // ── EMA Distance (price vs 20 EMA as %) ──
    let ema=closes[0];
    const k=2/21;
    for(let i=1;i<n;i++) ema=closes[i]*k+ema*(1-k);
    const emaDist = parseFloat(((price-ema)/ema*100).toFixed(2));

    // ── Score (0-100) ──
    const rvScore = relVol>=2?40:relVol>=1.5?25:relVol>=1?10:0;
    const atrScore = atrPct>=3?30:atrPct>=2?20:atrPct>=1?10:0;
    const edScore = Math.abs(emaDist)>=3?30:Math.abs(emaDist)>=1.5?20:Math.abs(emaDist)>=0.5?10:0;
    const score = rvScore+atrScore+edScore;

    const result = { relVol, atrPct, emaDist, score, price: price.toFixed(2), avgVol20: Math.round(avgVol20) };
    // ── Save to cache ──
    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(e) {}
    return result;
  } catch(e){ return null; }
}

// ── Purge old metrics cache ──
function purgeOldMetricsCache() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const toDelete = [];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && key.startsWith("bondo_metrics_") && !key.includes(today)) toDelete.push(key);
    }
    toDelete.forEach(k=>localStorage.removeItem(k));
    if(toDelete.length>0) console.log("🧹 Purged",toDelete.length,"old metric cache entries");
  } catch(e) {}
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function SlopeArrow({slope}){
  const deg=slope>0.15?-45:slope>0.05?-25:slope>0?-10:slope>-0.05?10:slope>-0.15?25:45;
  return <span style={{display:"inline-block",transform:`rotate(${deg}deg)`,color:slope>0?"#00e676":"#ff1744",fontWeight:900,fontSize:14}}>→</span>;
}
function ScoreBar({score}){
  const c=score>75?"#ff1744":score>50?"#ff9800":score>30?"#ffeb3b":"#546e7a";
  return <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:55,height:6,background:"#1a2332",borderRadius:3,overflow:"hidden"}}>
      <div style={{width:`${score}%`,height:"100%",background:c,borderRadius:3}}/>
    </div>
    <span style={{color:c,fontSize:11,fontWeight:700,minWidth:24}}>{score}</span>
  </div>;
}
function StrengthBar({strength}){
  const c=getSlopeColor(strength);
  return <div style={{display:"flex",alignItems:"center",gap:5}}>
    <div style={{width:40,height:5,background:"#1a2332",borderRadius:2,overflow:"hidden"}}>
      <div style={{width:`${strength}%`,height:"100%",background:c,borderRadius:2}}/>
    </div>
    <span style={{color:c,fontSize:10,fontWeight:700,minWidth:50}}>{getSlopeLabel(strength)}</span>
  </div>;
}
function Section({title,children}){
  return <div>
    <div style={{fontSize:9,color:"#2a5a7a",letterSpacing:2,marginBottom:8,borderBottom:"1px solid #0f1e2e",paddingBottom:5,fontWeight:700}}>{title}</div>
    {children}
  </div>;
}
// Mobile-friendly collapsible settings panel
function MobileSettingsPanel({width=250, children, style={}}){
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);
  if(!isMobile){
    return <div style={{width,minWidth:width,background:"#0a1520",borderRight:"1px solid #1e3a5a",padding:"14px 12px",display:"flex",flexDirection:"column",gap:13,overflowY:"auto",...style}}>{children}</div>;
  }
  return(
    <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",...style}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",color:"#00b4d8",fontFamily:"'Courier New',monospace",fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span>⚙️ SETTINGS</span>
        <span style={{fontSize:14}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:12,borderTop:"1px solid #1e3a5a"}}>
          {children}
        </div>
      )}
    </div>
  );
}
function Stat({label,value,color="#c9d8e8"}){
  return <div style={{display:"flex",alignItems:"center",gap:5}}>
    <span style={{fontSize:9,color:"#2a5a7a",letterSpacing:1}}>{label}</span>
    <span style={{fontSize:12,color,fontWeight:700}}>{value}</span>
  </div>;
}
function TFInput({label,value,onChange}){
  return <div style={{flex:1}}>
    <div style={{fontSize:9,color:"#3a6e9a",marginBottom:4,letterSpacing:1,textAlign:"center"}}>{label}</div>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder="e.g. 5m"
      style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#00b4d8",padding:"6px 4px",fontSize:13,fontFamily:"inherit",fontWeight:700,outline:"none",boxSizing:"border-box",textAlign:"center"}}/>
  </div>;
}
function HTBadge({result}){
  if(!result) return <span style={{color:"#2a4a6a",fontSize:10}}>—</span>;
  const bull=result.trend===0;
  const c=bull?"#00b4d8":"#ff1744";
  const bg=bull?"#0a1e30":"#2a0a0a";
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
    <span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:bg,color:c,border:`1px solid ${c}`}}>
      {bull?"▲ BULL":"▼ BEAR"}
    </span>
    {result.sellSignal&&<span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:"#2a0028",color:"#e040fb",border:"1px solid #e040fb"}}>★FLIP</span>}
    {result.buySignal&&<span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:"#002a10",color:"#00e676",border:"1px solid #00e676"}}>★FLIP</span>}
  </div>;
}
function SHAHTBadge({result}){
  if(!result) return <span style={{color:"#2a4a6a",fontSize:10}}>—</span>;
  const upColor="#00e676", downColor="#ff1744";
  const shaColor=result.algo1==="UP"?upColor:downColor;
  const htColor=result.algo2==="UP"?upColor:downColor;
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
    <div style={{display:"flex",gap:3}}>
      <span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:result.algo1==="UP"?"#0a2a0a":"#2a0a0a",color:shaColor,border:`1px solid ${shaColor}`}}>SHA:{result.algo1}</span>
      <span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:result.algo2==="UP"?"#0a2a0a":"#2a0a0a",color:htColor,border:`1px solid ${htColor}`}}>HT:{result.algo2}</span>
    </div>
    {result.agree&&<span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:result.algo1==="UP"?"#0a2a0a":"#2a0a0a",color:result.algo1==="UP"?"#00e676":"#ff1744",border:`1px solid ${result.algo1==="UP"?"#00e676":"#ff1744"}`}}>✓AGREE</span>}
    {!result.agree&&<span style={{padding:"1px 5px",borderRadius:3,fontSize:8,fontWeight:700,background:"#1a1a00",color:"#ffeb3b",border:"1px solid #ffeb3b"}}>✗SPLIT</span>}
  </div>;
}

// ─── AUTO-REFRESH HOOK ────────────────────────────────────────────────────────
function useAutoRefresh(runScan, enabled, intervalMin) {
  const timerRef = useRef(null);
  const [nextIn, setNextIn] = useState(0);
  const nextScanRef = useRef(null);

  useEffect(()=>{
    if(!enabled) { clearInterval(timerRef.current); setNextIn(0); return; }
    const ms = intervalMin * 60 * 1000;
    nextScanRef.current = Date.now() + ms;

    const tick = setInterval(()=>{
      const remaining = Math.max(0, Math.round((nextScanRef.current - Date.now())/1000));
      setNextIn(remaining);
      if(remaining <= 0) {
        runScan();
        nextScanRef.current = Date.now() + ms;
      }
    }, 1000);
    timerRef.current = tick;
    return ()=>clearInterval(tick);
  },[enabled, intervalMin, runScan]);

  return nextIn;
}

// ─── ALERT SETTINGS PANEL ─────────────────────────────────────────────────────
function AlertSettings({pushKey,setPushKey,pushToken,setPushToken,soundOn,setSoundOn,onTest}) {
  const [show, setShow] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const handleTest = async()=>{
    setTestStatus("Sending...");
    const r = await onTest();
    setTestStatus(r.ok ? "✅ Sent! Check your phone." : `❌ ${r.error}`);
    setTimeout(()=>setTestStatus(""),4000);
  };
  return (
    <div style={{marginTop:"auto"}}>
      <button onClick={()=>setShow(s=>!s)} style={{width:"100%",padding:"7px",background:"#0d1b2e",border:"1px solid #1e5a3a",borderRadius:5,color:"#00e676",fontSize:10,fontFamily:"inherit",fontWeight:700,cursor:"pointer",letterSpacing:1}}>
        🔔 ALERT SETTINGS {show?"▲":"▼"}
      </button>
      {show&&(
        <div style={{marginTop:8,padding:10,background:"#080e1a",border:"1px solid #1e3a5a",borderRadius:6,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:9,color:"#00e676",fontWeight:700,letterSpacing:1}}>PUSHOVER SETUP</div>
          <div style={{fontSize:9,color:"#3a6e9a"}}>1. Install Pushover app ($5)<br/>2. Get User Key + API Token at pushover.net</div>
          <div>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:3}}>USER KEY</div>
            <input value={pushKey} onChange={e=>{setPushKey(e.target.value);try{localStorage.setItem("alo_push_key",e.target.value);}catch(err){}}}
              placeholder="Your Pushover user key"
              style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#e8f4ff",padding:"5px 8px",fontSize:10,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:3}}>API TOKEN</div>
            <input value={pushToken} onChange={e=>{setPushToken(e.target.value);try{localStorage.setItem("alo_push_token",e.target.value);}catch(err){}}}
              placeholder="Your app API token"
              style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#e8f4ff",padding:"5px 8px",fontSize:10,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" checked={soundOn} onChange={e=>setSoundOn(e.target.checked)} id="soundtoggle"/>
            <label htmlFor="soundtoggle" style={{fontSize:10,color:"#c9d8e8",cursor:"pointer"}}>🔊 Sound Alert</label>
          </div>
          <button onClick={handleTest} style={{padding:"6px",background:"#0d3b2a",border:"1px solid #00e676",borderRadius:4,color:"#00e676",fontSize:10,fontFamily:"inherit",fontWeight:700,cursor:"pointer"}}>
            📱 TEST PUSH NOW
          </button>
          {testStatus&&<div style={{fontSize:10,color:testStatus.startsWith("✅")?"#00e676":"#ff1744",fontWeight:700}}>{testStatus}</div>}
        </div>
      )}
    </div>
  );
}

// ─── SIGNAL LOG PANEL ─────────────────────────────────────────────────────────
function SignalLogPanel({logVersion}) {
  const [show, setShow] = useState(false);
  const [tick, setTick] = useState(0);

  // Auto-check performance every 60 seconds
  useEffect(()=>{
    const interval = setInterval(async()=>{
      const updated = await checkSignalPerformance();
      if(updated) setTick(n=>n+1);
    }, 60000);
    return ()=>clearInterval(interval);
  },[]);

  const handleClear = ()=>{ clearSignalLog(); setTick(n=>n+1); };

  // Stats calculation
  const completed = SIGNAL_LOG.filter(s=>s.pnl60!==null);
  const wins = completed.filter(s=>parseFloat(s.pnl60)>0);
  const losses = completed.filter(s=>parseFloat(s.pnl60)<=0);
  const winRate = completed.length>0?((wins.length/completed.length)*100).toFixed(0):null;
  const avgMove = completed.length>0?(completed.reduce((a,s)=>a+parseFloat(s.pnl60),0)/completed.length).toFixed(2):null;

  const PnlBadge = ({val, label})=>{
    if(val===null) return <span style={{fontSize:8,color:"#2a5a7a",padding:"1px 4px",border:"1px solid #1e3a5a",borderRadius:2}}>{label}…</span>;
    const v = parseFloat(val);
    const c = v>0?"#00e676":v<0?"#ff1744":"#ffeb3b";
    return <span style={{fontSize:8,color:c,padding:"1px 4px",border:`1px solid ${c}`,borderRadius:2,fontWeight:700}}>{label} {v>0?"+":""}{v}%</span>;
  };

  return (
    <div style={{borderTop:"1px solid #1e3a5a",padding:"8px 12px"}}>
      <button onClick={()=>setShow(s=>!s)} style={{width:"100%",padding:"6px",background:"#080e1a",border:"1px solid #1e3a5a",borderRadius:4,color:"#ffeb3b",fontSize:10,fontFamily:"inherit",fontWeight:700,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>📋 SIGNAL LOG ({SIGNAL_LOG.length})</span>
        <span style={{display:"flex",gap:6,alignItems:"center"}}>
          {winRate!==null&&<span style={{fontSize:9,color:parseFloat(winRate)>=50?"#00e676":"#ff1744"}}>WIN {winRate}%</span>}
          {avgMove!==null&&<span style={{fontSize:9,color:parseFloat(avgMove)>=0?"#00e676":"#ff1744"}}>AVG {parseFloat(avgMove)>=0?"+":""}{avgMove}%</span>}
          <span>{show?"▲":"▼"}</span>
        </span>
      </button>
      {show&&(
        <div style={{maxHeight:320,overflowY:"auto",marginTop:6}}>
          <button onClick={handleClear} style={{width:"100%",padding:"4px",marginBottom:6,background:"#1a0a00",border:"1px solid #ff5722",borderRadius:3,color:"#ff5722",fontSize:9,fontFamily:"inherit",cursor:"pointer"}}>🗑 CLEAR LOG</button>

          {/* Stats bar */}
          {completed.length>0&&(
            <div style={{display:"flex",gap:6,marginBottom:8,padding:"6px 8px",background:"#0a1520",borderRadius:4,border:"1px solid #1e3a5a",flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:"#3a6e9a"}}>📊 {completed.length} completed</span>
              <span style={{fontSize:9,color:"#00e676"}}>✅ {wins.length} wins</span>
              <span style={{fontSize:9,color:"#ff1744"}}>❌ {losses.length} losses</span>
              <span style={{fontSize:9,color:parseFloat(winRate)>=50?"#00e676":"#ff1744",fontWeight:700}}>WIN RATE: {winRate}%</span>
              <span style={{fontSize:9,color:parseFloat(avgMove)>=0?"#00e676":"#ff1744",fontWeight:700}}>AVG 1HR: {parseFloat(avgMove)>=0?"+":""}{avgMove}%</span>
            </div>
          )}

          {SIGNAL_LOG.length===0&&<div style={{fontSize:10,color:"#2a5a7a",textAlign:"center",padding:10}}>No signals yet</div>}
          {SIGNAL_LOG.map((s,i)=>(
            <div key={i} style={{padding:"6px 8px",marginBottom:4,background:s.direction==="SELL"?"#1a050a":"#051a0a",border:`1px solid ${s.direction==="SELL"?"#ff1744":"#00e676"}`,borderRadius:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:"#e8f4ff"}}>{s.symbol}</span>
                <span style={{fontSize:9,color:s.direction==="SELL"?"#ff1744":"#00e676",fontWeight:700}}>★ {s.direction}</span>
              </div>
              <div style={{fontSize:9,color:"#3a6e9a",marginTop:2}}>{s.tab} · Entry: <span style={{color:"#e8f4ff",fontWeight:700}}>${s.price}</span></div>
              <div style={{fontSize:9,color:"#ffeb3b",marginTop:2}}>🕐 {s.timestamp}</div>
              {/* Performance badges */}
              <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                <PnlBadge val={s.pnl15} label="15m"/>
                <PnlBadge val={s.pnl30} label="30m"/>
                <PnlBadge val={s.pnl60} label="1hr"/>
                {s.p15&&<span style={{fontSize:8,color:"#2a5a7a"}}>→ ${s.p15}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BONDO FUND — FULL HEDGE FUND P&L ────────────────────────────────────────
const STARTING_BALANCE = 100000;

function getBondoFundData() {
  try { return JSON.parse(localStorage.getItem("bondo_fund")||"[]"); } catch(e){ return []; }
}
function saveBondoFund(trades) {
  try { localStorage.setItem("bondo_fund", JSON.stringify(trades)); } catch(e){}
}

function calcFundStats(trades, livePrices={}) {
  const closed = trades.filter(t=>t.pnl!==null);
  const open = trades.filter(t=>t.pnl===null);
  const totalPnl = closed.reduce((a,t)=>a+parseFloat(t.pnl),0);

  // ── Unrealized P&L from open positions using live prices ──
  const unrealizedPnl = open.reduce((sum, t) => {
    const cur = parseFloat(livePrices[t.id]);
    if(!cur || !t.entry) return sum;
    return sum + calcPnl(t.direction, t.type, t.entry, cur, t.qty);
  }, 0);

  const nav = STARTING_BALANCE + totalPnl + unrealizedPnl;
  const roi = ((totalPnl + unrealizedPnl) / STARTING_BALANCE) * 100;
  const wins = closed.filter(t=>parseFloat(t.pnl)>0);
  const losses = closed.filter(t=>parseFloat(t.pnl)<0);
  const winRate = closed.length>0?(wins.length/closed.length*100):0;
  const avgWin = wins.length>0?wins.reduce((a,t)=>a+parseFloat(t.pnl),0)/wins.length:0;
  const avgLoss = losses.length>0?Math.abs(losses.reduce((a,t)=>a+parseFloat(t.pnl),0)/losses.length):0;
  const profitFactor = avgLoss>0?(avgWin*wins.length)/(avgLoss*Math.max(losses.length,1)):avgWin>0?999:0;
  let peak=STARTING_BALANCE, maxDD=0, running=STARTING_BALANCE;
  [...closed].reverse().forEach(t=>{
    running+=parseFloat(t.pnl);
    if(running>peak) peak=running;
    const dd=peak-running;
    if(dd>maxDD) maxDD=dd;
  });
  const maxDDPct = peak>0?(maxDD/peak*100):0;
  const bondo = Math.max(0,totalPnl)*0.20;
  const sharpe = avgLoss>0?(avgWin/avgLoss).toFixed(2):"∞";
  return {totalPnl,unrealizedPnl,nav,roi,wins:wins.length,losses:losses.length,winRate,avgWin,avgLoss,profitFactor,maxDD,maxDDPct,bondo,sharpe,closed:closed.length,openCount:open.length};
}

function MiniEquityCurve({trades}) {
  const closed = [...trades].filter(t=>t.pnl!==null).reverse();
  if(closed.length<2) return (
    <div style={{textAlign:"center",padding:"20px 0",color:"#2a5a7a",fontSize:10}}>
      📈 Equity curve appears after 2+ closed trades
    </div>
  );
  const points=[STARTING_BALANCE];
  let bal=STARTING_BALANCE;
  closed.forEach(t=>{ bal+=parseFloat(t.pnl); points.push(bal); });
  const min=Math.min(...points), max=Math.max(...points);
  const range=max-min||1;
  const W=500, H=100;
  const pts=points.map((v,i)=>{
    const x=(i/(points.length-1))*W;
    const y=H-((v-min)/range*(H-15))-8;
    return `${x},${y}`;
  }).join(" ");
  const isUp=points[points.length-1]>=STARTING_BALANCE;
  const color=isUp?"#00e676":"#ff1744";
  const baseY=H-((STARTING_BALANCE-min)/range*(H-15))-8;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#curveGrad)"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"/>
      <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="#1e3a5a" strokeWidth="1" strokeDasharray="4,4"/>
      <text x="4" y="12" fill="#2a5a7a" fontSize="9">${(max/1000).toFixed(1)}k</text>
      <text x="4" y={H-3} fill="#2a5a7a" fontSize="9">${(min/1000).toFixed(1)}k</text>
      <text x={W/2-20} y="12" fill="#3a6e9a" fontSize="9">BONDO EQUITY CURVE</text>
    </svg>
  );
}

function StatBox({label,value,color="#c9d8e8",bg="#0d1b2e",border="#1e3a5a",sub=null}) {
  return (
    <div style={{padding:"10px 12px",background:bg,borderRadius:6,border:`1px solid ${border}`,textAlign:"center",flex:1,minWidth:90}}>
      <div style={{fontSize:8,color:"#2a5a7a",letterSpacing:1,marginBottom:4}}>{label}</div>
      <div style={{fontSize:15,fontWeight:700,color}}>{value}</div>
      {sub&&<div style={{fontSize:8,color:"#3a6e9a",marginTop:2}}>{sub}</div>}
    </div>
  );
}

function calcPnl(direction, type, entry, exit, qty) {
  const e = parseFloat(entry), x = parseFloat(exit), q = parseFloat(qty)||1;
  if(!e||!x) return 0;
  const optionTypes = ["BUY CALL","BUY PUT","SELL CALL","SELL PUT"];
  const mult = optionTypes.includes(direction) ? 100 : 1;
  const longTypes = ["BUY","BUY CALL","SELL PUT","COVER"];
  const dir = longTypes.includes(direction) ? 1 : -1;
  return dir * (x - e) * q * mult;
}

function BondoFund() {
  const [trades, setTrades] = useState(()=>getBondoFundData());
  const [sym, setSym] = useState("");
  const [dir, setDir] = useState("BUY PUT");
  const [type, setType] = useState("OPTIONS");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [view, setView] = useState("dashboard");
  const [confirmReset, setConfirmReset] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [liveQuote, setLiveQuote] = useState(null);
  const [closingPrices, setClosingPrices] = useState({});
  const [fetchingClose, setFetchingClose] = useState({});
  const [posAction, setPosAction] = useState({}); // {id: "close"|"add"|"partial"}
  const [addInputs, setAddInputs] = useState({});   // {id: {price, qty}}
  const [partialInputs, setPartialInputs] = useState({}); // {id: {price, qty}}
  const symDebounceRef = useRef(null);
  const priceTimerRef = useRef({});

  const s = calcFundStats(trades, closingPrices);
  const openTrades   = trades.filter(t=>t.pnl===null);
  const closedTrades = trades.filter(t=>t.pnl!==null);

  // ── Live price fetch (debounced) ──
  const fetchLivePrice = async (symbol) => {
    if(!symbol) { setLiveQuote(null); return; }
    setFetchingPrice(true);
    try {
      const res = await fetch(`https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${API_KEY}`);
      const json = await res.json();
      if(json.results?.p) { setLiveQuote(parseFloat(json.results.p.toFixed(2))); }
      else {
        const r2 = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${API_KEY}`);
        const j2 = await r2.json();
        if(j2.results?.[0]) setLiveQuote(parseFloat(j2.results[0].c.toFixed(2)));
        else setLiveQuote(null);
      }
    } catch(e) { setLiveQuote(null); }
    setFetchingPrice(false);
  };

  const handleSymChange = (val) => {
    setSym(val); setLiveQuote(null);
    if(symDebounceRef.current) clearTimeout(symDebounceRef.current);
    symDebounceRef.current = setTimeout(()=>fetchLivePrice(val), 600);
  };

  // ── Fetch current price for closing a position ──
  const fetchClosePrice = async (id, symbol) => {
    setFetchingClose(p=>({...p,[id]:true}));
    try {
      const res = await fetch(`https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${API_KEY}`);
      const json = await res.json();
      if(json.results?.p) setClosingPrices(p=>({...p,[id]:json.results.p.toFixed(2)}));
      else {
        const r2 = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${API_KEY}`);
        const j2 = await r2.json();
        if(j2.results?.[0]) setClosingPrices(p=>({...p,[id]:j2.results[0].c.toFixed(2)}));
      }
    } catch(e) {}
    setFetchingClose(p=>({...p,[id]:false}));
  };

  // ── WebSocket real-time streaming for open positions ──
  const wsRef = useRef(null);
  const [wsStatus, setWsStatus] = useState("disconnected"); // connected | delayed | disconnected

  useEffect(()=>{
    if(openTrades.length===0){ setWsStatus("disconnected"); return; }

    // Close existing WS
    if(wsRef.current){ wsRef.current.close(); wsRef.current=null; }

    const syms = [...new Set(openTrades.map(t=>t.symbol.toUpperCase()))];
    const ws = new WebSocket("wss://socket.polygon.io/stocks");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({action:"auth",params:API_KEY}));
    };

    ws.onmessage = (e) => {
      const msgs = JSON.parse(e.data);
      msgs.forEach(msg => {
        // Auth response
        if(msg.ev==="status"){
          if(msg.status==="auth_success"){
            // Subscribe to trades for all open position symbols
            ws.send(JSON.stringify({action:"subscribe", params: syms.map(s=>`T.${s}`).join(",")}));
            setWsStatus("connected");
          } else if(msg.status==="auth_failed"){
            setWsStatus("delayed");
          } else if(msg.status==="delayed"){
            setWsStatus("delayed");
          }
        }
        // Trade tick
        if(msg.ev==="T"){
          const price = parseFloat(msg.p).toFixed(2);
          // Update all open trades matching this symbol
          setTrades(prev => {
            const updated = prev.map(t => {
              if(t.pnl===null && t.symbol.toUpperCase()===msg.sym){
                return {...t, _livePrice: parseFloat(price)};
              }
              return t;
            });
            return updated;
          });
          setClosingPrices(p=>{
            const next = {...p};
            // find open trade ids matching this symbol
            openTrades.forEach(t=>{
              if(t.symbol.toUpperCase()===msg.sym) next[t.id]=price;
            });
            return next;
          });
        }
      });
    };

    ws.onerror = () => { setWsStatus("delayed"); };
    ws.onclose = () => { setWsStatus("disconnected"); };

    // Fallback: also do one REST fetch immediately for current price
    const restFetch = async () => {
      for(const t of openTrades){
        try {
          const res = await fetch(`https://api.polygon.io/v2/last/trade/${t.symbol}?apiKey=${API_KEY}`);
          const json = await res.json();
          if(json.results?.p) setClosingPrices(p=>({...p,[t.id]:json.results.p.toFixed(2)}));
        } catch(e){}
      }
    };
    restFetch();

    return ()=>{ if(wsRef.current){ wsRef.current.close(); wsRef.current=null; } };
  }, [openTrades.length, openTrades.map(t=>t.symbol).join(",")]);

  // ── Open a new position ──
  const openPosition = () => {
    if(!sym||!liveQuote) return;
    const t = {
      id:Date.now(), symbol:sym.toUpperCase(), direction:dir, type,
      entry:liveQuote, exit:null, qty:parseInt(qty)||1, pnl:null,
      note, timestamp:getETDateTime(), open:true, closedAt:null, checks:{}
    };
    const updated=[t,...trades];
    saveBondoFund(updated); setTrades(updated);
    setSym(""); setLiveQuote(null); setQty("1"); setNote(""); setView("positions");
  };

  // ── Close a position ──
  const closePosition = (id) => {
    const exitPrice = parseFloat(closingPrices[id]);
    if(!exitPrice) return;
    const updated = trades.map(t=>{
      if(t.id!==id) return t;
      const pnl = calcPnl(t.direction, t.type, t.entry, exitPrice, t.qty);
      return {...t, exit:exitPrice, pnl, open:false, closedAt:getETDateTime()};
    });
    saveBondoFund(updated); setTrades(updated);
  };

  // ── Add to existing position (avg down/up) ──
  const addToPosition = (id, addPrice, addQty) => {
    const price = parseFloat(addPrice);
    const qty = parseFloat(addQty);
    if(!price || !qty || qty <= 0) return;
    const updated = trades.map(t => {
      if(t.id !== id) return t;
      const newQty = parseFloat(t.qty) + qty;
      // Weighted average entry price
      const newAvgEntry = ((parseFloat(t.entry) * parseFloat(t.qty)) + (price * qty)) / newQty;
      const note = (t.note||"") + ` +${qty}@$${price}`;
      return {...t, qty: newQty, entry: newAvgEntry.toFixed(2), note: note.trim()};
    });
    saveBondoFund(updated); setTrades(updated);
  };

  // ── Partial close ──
  const partialClose = (id, exitPrice, sellQty) => {
    const price = parseFloat(exitPrice);
    const qty = parseFloat(sellQty);
    if(!price || !qty || qty <= 0) return;
    const trade = trades.find(t => t.id === id);
    if(!trade) return;
    const remainQty = parseFloat(trade.qty) - qty;
    if(remainQty < 0) { alert("Cannot sell more than you hold!"); return; }
    // Record partial close as a closed trade
    const partialPnl = calcPnl(trade.direction, trade.type, trade.entry, price, qty);
    const closedPartial = {
      ...trade,
      id: Date.now(),
      qty: qty,
      exit: price,
      pnl: partialPnl,
      open: false,
      closedAt: getETDateTime(),
      note: `Partial close of ${trade.symbol} (${qty} of ${trade.qty})`,
    };
    let updated;
    if(remainQty === 0) {
      // Full close via partial
      updated = trades.map(t => t.id === id ? {...t, exit:price, pnl:partialPnl, open:false, closedAt:getETDateTime()} : t);
    } else {
      // Keep remaining open, add closed partial as new entry
      updated = trades.map(t => t.id === id ? {...t, qty: remainQty} : t);
      updated = [...updated, closedPartial];
    }
    saveBondoFund(updated); setTrades(updated);
  };

  const deleteTrade = (id) => {
    const updated=trades.filter(t=>t.id!==id);
    saveBondoFund(updated); setTrades(updated);
  };

  const handleReset = () => {
    if(confirmReset){ saveBondoFund([]); setTrades([]); setConfirmReset(false); }
    else setConfirmReset(true);
  };

  const navColor  = s.nav>=STARTING_BALANCE?"#00e676":"#ff1744";
  const roiColor  = s.roi>=0?"#00e676":"#ff1744";
  const pnlColor  = (pnl,open) => open?"#ffeb3b":parseFloat(pnl)>=0?"#00e676":"#ff1744";
  const dirColor  = (d) => ["BUY","BUY CALL","SELL PUT","COVER"].includes(d)?"#00e676":"#ff1744";

  // Unrealized P&L for open position
  const unrealizedPnl = (t) => {
    const cur = parseFloat(closingPrices[t.id]);
    if(!cur) return null;
    return calcPnl(t.direction, t.type, t.entry, cur, t.qty);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#080e1a",overflowY:"auto"}}>

      {/* FUND HEADER */}
      <div style={{background:"linear-gradient(135deg,#0a1520,#0d1b2e)",borderBottom:"2px solid #1e3a5a",padding:"14px 20px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>🏦</span>
              <span style={{fontSize:18,fontWeight:700,color:"#e8f4ff",letterSpacing:2}}>BONDO FUND</span>
              <span style={{fontSize:10,color:"#00e676",padding:"2px 8px",border:"1px solid #00e676",borderRadius:3}}>PAPER TRADING</span>
              {openTrades.length>0&&<span style={{fontSize:10,color:"#ffeb3b",padding:"2px 8px",border:"1px solid #ffeb3b",borderRadius:3}}>⚡ {openTrades.length} OPEN</span>}
            </div>
            <div style={{fontSize:10,color:"#3a6e9a",marginTop:4}}>Starting Capital: $100,000 · For educational purposes only</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:28,fontWeight:700,color:navColor}}>${s.nav.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style={{fontSize:12,color:roiColor,fontWeight:700}}>{s.roi>=0?"+":""}{s.roi.toFixed(2)}% ROI · {s.totalPnl>=0?"+":""}${s.totalPnl.toFixed(2)} Realized{s.unrealizedPnl!==0?` · ${s.unrealizedPnl>=0?"+":""}$${s.unrealizedPnl.toFixed(2)} Open`:""}</div>
          </div>
        </div>
        {/* Equity Curve */}
        <div style={{marginTop:10,background:"#080e1a",borderRadius:6,border:"1px solid #1e3a5a",padding:"8px",overflow:"hidden"}}>
          <MiniEquityCurve trades={trades}/>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex",background:"#0a1520",borderBottom:"1px solid #1e3a5a",flexShrink:0}}>
        {[
          ["dashboard","📊 DASHBOARD"],
          ["positions",`⚡ POSITIONS${openTrades.length>0?` (${openTrades.length})`:""}` ],
          ["history","✅ HISTORY"],
          ["open","+ NEW TRADE"],
        ].map(([id,label])=>(
          <button key={id} onClick={()=>setView(id)} style={{padding:"10px 14px",fontFamily:"inherit",fontSize:10,fontWeight:700,
            background:view===id?"#0d1e30":"transparent",
            borderBottom:view===id?"2px solid #ff9800":"2px solid transparent",
            color:view===id?"#ff9800":"#3a6e9a",border:"none",cursor:"pointer",marginBottom:"-1px",whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {view==="dashboard"&&(
        <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <StatBox label="NET P&L"      value={`${s.totalPnl>=0?"+":""}$${s.totalPnl.toFixed(0)}`} color={s.totalPnl>=0?"#00e676":"#ff1744"} bg={s.totalPnl>=0?"#051a05":"#1a0505"} border={s.totalPnl>=0?"#00e676":"#ff1744"}/>
            <StatBox label="NAV"          value={`$${(s.nav/1000).toFixed(1)}k`} color="#e8f4ff"/>
            <StatBox label="ROI %"        value={`${s.roi>=0?"+":""}${s.roi.toFixed(2)}%`} color={roiColor}/>
            <StatBox label="WIN RATE"     value={`${s.winRate.toFixed(0)}%`} color={s.winRate>=50?"#00e676":"#ff9800"} sub={`${s.wins}W / ${s.losses}L`}/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <StatBox label="AVG WIN"      value={`+$${s.avgWin.toFixed(0)}`}  color="#00e676"/>
            <StatBox label="AVG LOSS"     value={`-$${s.avgLoss.toFixed(0)}`} color="#ff1744"/>
            <StatBox label="PROFIT FACTOR" value={s.profitFactor>99?"∞":s.profitFactor.toFixed(2)} color={s.profitFactor>=2?"#00e676":s.profitFactor>=1?"#ff9800":"#ff1744"} sub="(>2 = excellent)"/>
            <StatBox label="SHARPE"       value={s.sharpe} color="#00b4d8"/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <StatBox label="MAX DRAWDOWN" value={`-$${s.maxDD.toFixed(0)}`} color="#ff5722" sub={`${s.maxDDPct.toFixed(1)}% from peak`}/>
            <StatBox label="OPEN"         value={s.openCount} color="#ffeb3b"/>
            <StatBox label="CLOSED"       value={s.closed}    color="#c9d8e8"/>
          </div>
          {/* Bondo Charity */}
          <div style={{padding:"12px 16px",background:"linear-gradient(135deg,#051a05,#0a2a0a)",border:"2px solid #00e676",borderRadius:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,color:"#00e676",fontWeight:700,letterSpacing:2}}>🙏 BONDO CHARITY</div>
                <div style={{fontSize:9,color:"#3a6e9a"}}>20% of profits → Bondo 501(c)(3)</div>
              </div>
              <div style={{fontSize:24,fontWeight:700,color:"#00e676"}}>${s.bondo.toFixed(2)}</div>
            </div>
            <div style={{marginTop:8,background:"#0d1b2e",borderRadius:4,height:6,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100,(s.bondo/1000)*100)}%`,height:"100%",background:"linear-gradient(90deg,#00e676,#69f0ae)",borderRadius:4}}/>
            </div>
            <div style={{fontSize:9,color:"#2a5a7a",marginTop:3}}>Goal: $1,000 · {((s.bondo/1000)*100).toFixed(1)}% reached</div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button onClick={handleReset} style={{padding:"4px 10px",background:confirmReset?"#2a0a0a":"#0d1b2e",border:`1px solid ${confirmReset?"#ff1744":"#1e3a5a"}`,borderRadius:4,color:confirmReset?"#ff1744":"#2a5a7a",fontSize:9,fontFamily:"inherit",cursor:"pointer"}}>
              {confirmReset?"⚠️ CONFIRM RESET":"🗑 Reset Fund"}
            </button>
          </div>
        </div>
      )}

      {/* ── OPEN POSITIONS ── */}
      {view==="positions"&&(
        <div style={{padding:"12px 16px"}}>
          {/* WS Status Bar */}
          <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:wsStatus==="connected"?"#00e676":wsStatus==="delayed"?"#ffeb3b":"#ff1744",boxShadow:wsStatus==="connected"?"0 0 6px #00e676":"none"}}/>
            <span style={{fontSize:9,color:wsStatus==="connected"?"#00e676":wsStatus==="delayed"?"#ffeb3b":"#3a6e9a",letterSpacing:1}}>
              {wsStatus==="connected"?"⚡ REAL-TIME STREAMING":wsStatus==="delayed"?"⚠️ DELAYED DATA":"○ DISCONNECTED"}
            </span>
          </div>
          {openTrades.length===0&&(
            <div style={{textAlign:"center",padding:"40px",color:"#2a5a7a"}}>
              <div style={{fontSize:30,marginBottom:8}}>⚡</div>
              <div>No open positions</div>
              <div style={{fontSize:11,marginTop:6}}>Click "+ NEW TRADE" to open one</div>
            </div>
          )}
          {openTrades.map(t=>{
            const unreal = unrealizedPnl(t);
            const curPrice = closingPrices[t.id];
            const unrealColor = unreal===null?"#ffeb3b":unreal>=0?"#00e676":"#ff1744";
            return (
              <div key={t.id} style={{marginBottom:10,padding:"12px 14px",background:"#0d1b2e",border:"2px solid #1e5a3a",borderRadius:8}}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18,fontWeight:700,color:"#e8f4ff"}}>{t.symbol}</span>
                    <span style={{fontSize:9,fontWeight:700,color:dirColor(t.direction),padding:"2px 6px",border:`1px solid ${dirColor(t.direction)}`,borderRadius:3}}>{t.direction}</span>
                    <span style={{fontSize:9,color:"#3a6e9a",padding:"2px 6px",border:"1px solid #1e3a5a",borderRadius:3}}>{t.type}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:9,color:"#ffeb3b",fontWeight:700,padding:"2px 8px",border:"1px solid #ffeb3b",borderRadius:3}}>⚡ LIVE</span>
                    <button onClick={()=>deleteTrade(t.id)} style={{background:"none",border:"none",color:"#2a5a7a",cursor:"pointer",fontSize:14}}>✕</button>
                  </div>
                </div>

                {/* Price info */}
                <div style={{display:"flex",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                  <div style={{background:"#080e1a",borderRadius:5,padding:"8px 12px",flex:1}}>
                    <div style={{fontSize:8,color:"#2a5a7a",marginBottom:2}}>ENTRY PRICE</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#ffeb3b"}}>${t.entry}</div>
                  </div>
                  <div style={{background:"#080e1a",borderRadius:5,padding:"8px 12px",flex:1}}>
                    <div style={{fontSize:8,color:"#2a5a7a",marginBottom:2}}>CURRENT PRICE</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#00b4d8"}}>{curPrice?`$${curPrice}`:"--"}</div>
                  </div>
                  <div style={{background:unreal===null?"#0d1b2e":unreal>=0?"#051a05":"#1a0505",borderRadius:5,padding:"8px 12px",flex:1,border:`1px solid ${unrealColor}`}}>
                    <div style={{fontSize:8,color:"#2a5a7a",marginBottom:2}}>UNREALIZED P&L</div>
                    <div style={{fontSize:16,fontWeight:700,color:unrealColor}}>
                      {unreal===null?"--":`${unreal>=0?"+":""}$${unreal.toFixed(2)}`}
                    </div>
                  </div>
                </div>

                <div style={{fontSize:9,color:"#3a6e9a",marginBottom:10}}>
                  Qty: <span style={{color:"#c9d8e8"}}>{t.qty}</span>
                  {t.note&&<> · <span style={{color:"#8ab4cc"}}>{t.note}</span></>}
                  <span style={{color:"#2a4a6a"}}> · Opened: {t.timestamp}</span>
                </div>

                {/* POSITION ACTIONS — ADD / PARTIAL / CLOSE */}
                <div style={{background:"#080e1a",borderRadius:6,padding:"10px",border:"1px solid #1e5a3a"}}>
                  {/* Tab selector */}
                  <div style={{display:"flex",gap:4,marginBottom:8}}>
                    {[["close","✓ CLOSE","#00e676"],["add","➕ ADD","#ffeb3b"],["partial","➖ PARTIAL","#ff9800"]].map(([key,label,color])=>(
                      <button key={key} onClick={()=>setPosAction(p=>({...p,[t.id]:p[t.id]===key?null:key}))}
                        style={{flex:1,padding:"5px 4px",fontSize:9,fontWeight:700,fontFamily:"inherit",cursor:"pointer",borderRadius:3,
                          background:posAction[t.id]===key?color+"22":"#0d1b2e",
                          border:`1px solid ${posAction[t.id]===key?color:"#1e3a5a"}`,
                          color:posAction[t.id]===key?color:"#3a6e9a"}}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* CLOSE */}
                  {(posAction[t.id]==="close"||!posAction[t.id])&&(
                    <div>
                      <div style={{fontSize:9,color:"#00e676",fontWeight:700,marginBottom:6}}>CLOSE ALL {t.qty} SHARES</div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <input value={closingPrices[t.id]||""} onChange={e=>setClosingPrices(p=>({...p,[t.id]:e.target.value}))}
                          placeholder="Exit price" style={{flex:1,background:"#0d1b2e",border:"1px solid #00e676",borderRadius:4,color:"#00e676",padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}/>
                        <button onClick={()=>fetchClosePrice(t.id,t.symbol)}
                          style={{padding:"8px 10px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:4,color:"#00b4d8",fontSize:9,fontFamily:"inherit",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                          {fetchingClose[t.id]?"⟳":"📡 LIVE"}
                        </button>
                        <button onClick={()=>closePosition(t.id)} disabled={!closingPrices[t.id]}
                          style={{padding:"8px 14px",background:closingPrices[t.id]?"linear-gradient(135deg,#0d3b1a,#0a5530)":"#0d1b2e",
                            border:`1px solid ${closingPrices[t.id]?"#00e676":"#1e3a5a"}`,borderRadius:4,
                            color:closingPrices[t.id]?"#00e676":"#2a5a7a",fontSize:11,fontFamily:"inherit",
                            cursor:closingPrices[t.id]?"pointer":"not-allowed",fontWeight:700}}>
                          ✓ CLOSE ALL
                        </button>
                      </div>
                      {closingPrices[t.id]&&(()=>{
                        const preview = calcPnl(t.direction,t.type,t.entry,closingPrices[t.id],t.qty);
                        const col = preview>=0?"#00e676":"#ff1744";
                        return <div style={{marginTop:6,display:"flex",gap:12}}>
                          <span style={{fontSize:12,fontWeight:700,color:col}}>{preview>=0?"+":""}${preview.toFixed(2)}</span>
                          <span style={{fontSize:9,color:"#00e676"}}>🙏 Bondo: ${Math.max(0,preview*0.2).toFixed(2)}</span>
                        </div>;
                      })()}
                    </div>
                  )}

                  {/* ADD TO POSITION */}
                  {posAction[t.id]==="add"&&(
                    <div>
                      <div style={{fontSize:9,color:"#ffeb3b",fontWeight:700,marginBottom:6}}>ADD TO POSITION · Avg Entry: ${t.entry}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <input placeholder="Add price" value={addInputs[t.id]?.price ?? (closingPrices[t.id]||"")}
                          onChange={e=>setAddInputs(p=>({...p,[t.id]:{...p[t.id],price:e.target.value}}))}
                          style={{flex:1,background:"#0d1b2e",border:"1px solid #ffeb3b",borderRadius:4,color:"#ffeb3b",padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}/>
                        <button onClick={()=>{ fetchClosePrice(t.id,t.symbol); setAddInputs(p=>({...p,[t.id]:{...p[t.id],price:closingPrices[t.id]||""}})); }}
                          style={{padding:"8px 10px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:4,color:"#00b4d8",fontSize:9,fontFamily:"inherit",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                          {fetchingClose[t.id]?"⟳":"📡 LIVE"}
                        </button>
                        <input placeholder="Qty" value={addInputs[t.id]?.qty||""}
                          onChange={e=>setAddInputs(p=>({...p,[t.id]:{...p[t.id],qty:e.target.value}}))}
                          style={{width:60,background:"#0d1b2e",border:"1px solid #ffeb3b",borderRadius:4,color:"#ffeb3b",padding:"8px 8px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}/>
                        <button onClick={()=>{ addToPosition(t.id, addInputs[t.id]?.price ?? closingPrices[t.id], addInputs[t.id]?.qty); setAddInputs(p=>({...p,[t.id]:{}})); setPosAction(p=>({...p,[t.id]:null})); }}
                          disabled={!(addInputs[t.id]?.price||closingPrices[t.id])||!addInputs[t.id]?.qty}
                          style={{padding:"8px 12px",background:"linear-gradient(135deg,#3b3b00,#555500)",border:"1px solid #ffeb3b",borderRadius:4,
                            color:"#ffeb3b",fontSize:11,fontFamily:"inherit",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                          ➕ ADD
                        </button>
                      </div>
                      {addInputs[t.id]?.price&&addInputs[t.id]?.qty&&(()=>{
                        const newQty = parseFloat(t.qty)+parseFloat(addInputs[t.id].qty);
                        const newAvg = ((parseFloat(t.entry)*parseFloat(t.qty))+(parseFloat(addInputs[t.id].price)*parseFloat(addInputs[t.id].qty)))/newQty;
                        return <div style={{marginTop:6,fontSize:9,color:"#ffeb3b"}}>
                          New avg: <strong>${newAvg.toFixed(2)}</strong> · Total qty: <strong>{newQty}</strong>
                        </div>;
                      })()}
                    </div>
                  )}

                  {/* PARTIAL CLOSE */}
                  {posAction[t.id]==="partial"&&(
                    <div>
                      <div style={{fontSize:9,color:"#ff9800",fontWeight:700,marginBottom:6}}>PARTIAL SELL · Holding {t.qty} shares</div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <input placeholder="Exit price" value={partialInputs[t.id]?.price ?? (closingPrices[t.id]||"")}
                          onChange={e=>setPartialInputs(p=>({...p,[t.id]:{...p[t.id],price:e.target.value}}))}
                          style={{flex:1,background:"#0d1b2e",border:"1px solid #ff9800",borderRadius:4,color:"#ff9800",padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}/>
                        <button onClick={()=>{ fetchClosePrice(t.id,t.symbol); setPartialInputs(p=>({...p,[t.id]:{...p[t.id],price:closingPrices[t.id]||""}})); }}
                          style={{padding:"8px 10px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:4,color:"#00b4d8",fontSize:9,fontFamily:"inherit",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                          {fetchingClose[t.id]?"⟳":"📡 LIVE"}
                        </button>
                        <input placeholder="Sell qty" value={partialInputs[t.id]?.qty||""}
                          onChange={e=>setPartialInputs(p=>({...p,[t.id]:{...p[t.id],qty:e.target.value}}))}
                          style={{width:60,background:"#0d1b2e",border:"1px solid #ff9800",borderRadius:4,color:"#ff9800",padding:"8px 8px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}/>
                        <button onClick={()=>{ partialClose(t.id, partialInputs[t.id]?.price, partialInputs[t.id]?.qty); setPartialInputs(p=>({...p,[t.id]:{}})); setPosAction(p=>({...p,[t.id]:null})); }}
                          disabled={!partialInputs[t.id]?.price||!partialInputs[t.id]?.qty}
                          style={{padding:"8px 12px",background:"linear-gradient(135deg,#3b1500,#5a2500)",border:"1px solid #ff9800",borderRadius:4,
                            color:"#ff9800",fontSize:11,fontFamily:"inherit",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                          ➖ SELL
                        </button>
                      </div>
                      {partialInputs[t.id]?.price&&partialInputs[t.id]?.qty&&(()=>{
                        const sellQty = parseFloat(partialInputs[t.id].qty);
                        const remain = parseFloat(t.qty) - sellQty;
                        const pnl = calcPnl(t.direction,t.type,t.entry,partialInputs[t.id].price,sellQty);
                        const col = pnl>=0?"#00e676":"#ff1744";
                        return <div style={{marginTop:6,fontSize:9,color:"#ff9800"}}>
                          Selling {sellQty} shares · Remaining: <strong>{remain>=0?remain:"⚠️ OVER"}</strong>
                          {remain>=0&&<span style={{color:col,fontWeight:700}}> · P&L: {pnl>=0?"+":""}${pnl.toFixed(2)}</span>}
                        </div>;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY ── */}
      {view==="history"&&(
        <div style={{padding:"12px 16px"}}>
          {closedTrades.length===0&&(
            <div style={{textAlign:"center",padding:"40px",color:"#2a5a7a"}}>
              <div style={{fontSize:30,marginBottom:8}}>✅</div>
              <div>No closed trades yet</div>
            </div>
          )}
          {closedTrades.map(t=>{
            const col=parseFloat(t.pnl)>=0?"#00e676":"#ff1744";
            const bg=parseFloat(t.pnl)>=0?"#051a05":"#1a0505";
            return(
              <div key={t.id} style={{marginBottom:8,padding:"10px 12px",background:bg,border:`1px solid ${col}44`,borderRadius:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#e8f4ff"}}>{t.symbol}</span>
                    <span style={{fontSize:9,color:dirColor(t.direction),padding:"2px 5px",border:`1px solid ${dirColor(t.direction)}`,borderRadius:3}}>{t.direction}</span>
                    <span style={{fontSize:9,color:"#3a6e9a"}}>{t.type}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16,fontWeight:700,color:col}}>{parseFloat(t.pnl)>=0?"+":""}${parseFloat(t.pnl).toFixed(2)}</span>
                    <button onClick={()=>deleteTrade(t.id)} style={{background:"none",border:"none",color:"#2a5a7a",cursor:"pointer"}}>✕</button>
                  </div>
                </div>
                <div style={{fontSize:9,color:"#3a6e9a",marginTop:4}}>
                  Entry: <span style={{color:"#ffeb3b"}}>${t.entry}</span>
                  {" → "}Exit: <span style={{color:"#00e676"}}>${t.exit}</span>
                  {" · "}Qty: {t.qty}
                  {t.note&&<> · <span style={{color:"#8ab4cc"}}>{t.note}</span></>}
                </div>
                <div style={{fontSize:9,color:"#2a4a6a",marginTop:2}}>{t.timestamp} → {t.closedAt}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── NEW TRADE ── */}
      {view==="open"&&(
        <div style={{padding:"20px",maxWidth:480}}>
          <div style={{fontSize:12,color:"#ff9800",fontWeight:700,letterSpacing:2,marginBottom:16}}>+ OPEN NEW POSITION</div>

          {/* Symbol */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:4}}>SYMBOL</div>
            <input value={sym} onChange={e=>handleSymChange(e.target.value.toUpperCase())}
              placeholder="e.g. SPY, VIX, AAPL"
              style={{width:"100%",background:"#0d1b2e",border:`1px solid ${liveQuote?"#00e676":"#1e3a5a"}`,
                borderRadius:4,color:"#e8f4ff",padding:"10px 12px",fontSize:16,fontFamily:"inherit",
                outline:"none",boxSizing:"border-box",fontWeight:700}}/>
            <div style={{marginTop:4,height:16}}>
              {fetchingPrice&&<span style={{fontSize:9,color:"#ff9800"}}>⟳ Fetching live price...</span>}
              {liveQuote&&!fetchingPrice&&<span style={{fontSize:9,color:"#00e676"}}>✅ Entry price: <strong>${liveQuote}</strong> (live)</span>}
              {!fetchingPrice&&!liveQuote&&sym&&<span style={{fontSize:9,color:"#ff1744"}}>⚠️ Could not fetch price</span>}
            </div>
          </div>

          {/* Order Type */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:4}}>ORDER TYPE</div>
            <select value={dir} onChange={e=>setDir(e.target.value)}
              style={{width:"100%",background:"#0d1b2e",border:`1px solid ${["BUY","BUY CALL","SELL PUT","COVER"].includes(dir)?"#00e676":"#ff1744"}`,
                borderRadius:4,color:["BUY","BUY CALL","SELL PUT","COVER"].includes(dir)?"#00e676":"#ff1744",
                padding:"9px 8px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}>
              <optgroup label="── STOCKS ──">
                <option value="BUY">▲ BUY (go long)</option>
                <option value="SHORT">▼ SHORT (go short)</option>
              </optgroup>
              <optgroup label="── OPTIONS ──">
                <option value="BUY CALL">▲ BUY CALL (bullish)</option>
                <option value="BUY PUT">▼ BUY PUT (bearish)</option>
                <option value="SELL CALL">▼ SELL CALL</option>
                <option value="SELL PUT">▲ SELL PUT</option>
              </optgroup>
              <optgroup label="── CRYPTO ──">
                <option value="BUY">▲ BUY CRYPTO</option>
                <option value="SHORT">▼ SHORT CRYPTO</option>
              </optgroup>
            </select>
            <div style={{marginTop:4,fontSize:9,color:"#3a6e9a"}}>
              {dir==="BUY"&&"▲ Profit when price goes UP"}
              {dir==="SHORT"&&"▼ Profit when price goes DOWN"}
              {dir==="BUY CALL"&&"▲ Bullish — profit when stock goes UP"}
              {dir==="BUY PUT"&&"▼ Bearish — profit when stock goes DOWN"}
              {dir==="SELL CALL"&&"▼ Profit when stock stays BELOW strike"}
              {dir==="SELL PUT"&&"▲ Profit when stock stays ABOVE strike"}
            </div>
          </div>

          {/* Asset Type */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:4}}>ASSET TYPE</div>
            <div style={{display:"flex",gap:6}}>
              {["STOCK","OPTIONS","CRYPTO"].map(t=>(
                <button key={t} onClick={()=>setType(t)} style={{flex:1,padding:"7px",fontFamily:"inherit",fontSize:10,fontWeight:700,
                  background:type===t?"#0d3b5e":"#0d1b2e",border:`1px solid ${type===t?"#00b4d8":"#1e3a5a"}`,
                  color:type===t?"#00b4d8":"#3a6e9a",borderRadius:4,cursor:"pointer"}}>{t}</button>
              ))}
            </div>
          </div>

          {/* Qty + Note */}
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{width:100}}>
              <div style={{fontSize:9,color:"#2a5a7a",marginBottom:4}}>CONTRACTS / QTY</div>
              <input value={qty} onChange={e=>setQty(e.target.value)} placeholder="1"
                style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,
                  color:"#c9d8e8",padding:"9px 10px",fontSize:14,fontFamily:"inherit",outline:"none",
                  boxSizing:"border-box",fontWeight:700}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:"#2a5a7a",marginBottom:4}}>NOTE (optional)</div>
              <input value={note} onChange={e=>setNote(e.target.value)}
                placeholder="e.g. Saturn-Neptune thesis, VIX call..."
                style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,
                  color:"#8ab4cc",padding:"9px 10px",fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>

          {/* Submit */}
          <button onClick={openPosition} disabled={!sym||!liveQuote}
            style={{width:"100%",padding:"14px",
              background:sym&&liveQuote?"linear-gradient(135deg,#0d3b1a,#0a5530)":"#0d1b2e",
              border:`1px solid ${sym&&liveQuote?"#00e676":"#1e3a5a"}`,
              color:sym&&liveQuote?"#00e676":"#2a5a7a",
              borderRadius:6,cursor:sym&&liveQuote?"pointer":"not-allowed",
              fontSize:13,fontFamily:"inherit",fontWeight:700,letterSpacing:2}}>
            {liveQuote?`⚡ OPEN POSITION @ $${liveQuote}`:"TYPE SYMBOL TO GET LIVE PRICE"}
          </button>
          <div style={{fontSize:9,color:"#2a4a6a",textAlign:"center",marginTop:8}}>For educational purposes only · Not financial advice</div>
        </div>
      )}
    </div>
  );
}


// ─── CHART PATTERN ANALYZER ───────────────────────────────────────────────────
function ChartPatternAnalyzer() {
  const [image, setImage] = React.useState(null);
  const [imageData, setImageData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef();

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(",")[1];
      setImageData({ base64, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  React.useEffect(() => {
    const handler = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) { processFile(item.getAsFile()); break; }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  const analyze = async () => {
    if (!imageData) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-calls": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert technical analysis assistant embedded in the ATM Machine trading scanner — Alo's proprietary system combining SHA + HalfTrend signals.
Analyze the uploaded stock chart image and respond ONLY in this exact structured format — no preamble, no markdown:

Pattern: [chart pattern name, e.g. Bull Flag, Head & Shoulders, Double Bottom, Ascending Triangle, Wedge, etc.]
Signal: [Bullish / Bearish / Neutral]
Bias: [Bullish / Bearish / Neutral]
Entry Zone: [price level or zone if visible, else "See chart"]
Target: [price target if estimable, else "See chart"]
Stop Loss: [stop level if estimable, else "See chart"]
Confidence: [0-100 number only]
Notes: [2-3 sentences of sharp, actionable insight. Mention key levels, volume if visible, and whether this aligns with a momentum or reversal setup.]

If no clear pattern is visible, say Pattern: No clear pattern and explain in Notes.`,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: imageData.type, data: imageData.base64 } },
              { type: "text", text: "Analyze this stock chart and identify the pattern." }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("").trim();
      if (text) setResult(text);
      else setError("No analysis returned. Try a cleaner chart image.");
    } catch {
      setError("Analysis failed. Check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const get = (key) => {
    if (!result) return null;
    const line = result.split("\n").find(l => l.toLowerCase().startsWith(key.toLowerCase()));
    return line ? line.replace(/^[^:]+:\s*/i, "").trim() : null;
  };

  const pattern = get("Pattern");
  const signal = get("Signal");
  const bias = get("Bias");
  const entry = get("Entry Zone");
  const target = get("Target");
  const stop = get("Stop Loss");
  const confidence = get("Confidence");
  const notes = get("Notes");
  const confNum = confidence ? parseInt(confidence) : null;
  const signalColor = signal?.toLowerCase().includes("bull") ? "#00e676" : signal?.toLowerCase().includes("bear") ? "#ff5252" : "#38bdf8";

  return (
    <div style={{flex:1,overflowY:"auto",padding:"16px",background:"#080e1a",fontFamily:"monospace"}}>
      <div style={{maxWidth:700,margin:"0 auto"}}>

        {/* Header */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"#3a6e9a",letterSpacing:"0.1em",marginBottom:4}}>ATM MACHINE v6.0 · AI MODULE</div>
          <div style={{fontSize:18,fontWeight:700,color:"#e8f4ff",letterSpacing:"-0.01em"}}>📊 Chart Pattern Analyzer</div>
          <div style={{fontSize:11,color:"#3a6e9a",marginTop:2}}>Upload, drag, or Ctrl+V paste a chart → AI identifies the pattern</div>
        </div>

        {/* Drop Zone */}
        <div
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border:`2px dashed ${dragging?"#00e676":"#1e3a5a"}`,
            borderRadius:8, padding:"28px 16px", textAlign:"center",
            cursor:"pointer", background:dragging?"#00e67608":"#0d1e30",
            transition:"all 0.2s", marginBottom:12
          }}
        >
          <div style={{fontSize:28,marginBottom:8}}>📈</div>
          <div style={{color:"#e8f4ff",fontSize:13,fontWeight:600,marginBottom:4}}>Drop chart here, click to browse, or Ctrl+V to paste</div>
          <div style={{color:"#3a6e9a",fontSize:11}}>JPG · PNG · WEBP — TradingView screenshots work perfectly</div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/>
        </div>

        {/* Preview */}
        {image && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,color:"#3a6e9a",letterSpacing:"0.1em",marginBottom:6}}>CHART PREVIEW</div>
            <div style={{border:"1px solid #1e3a5a",borderRadius:6,overflow:"hidden",position:"relative"}}>
              <img src={image} alt="Chart" style={{width:"100%",display:"block",maxHeight:300,objectFit:"contain",background:"#000"}}/>
              <button onClick={e=>{e.stopPropagation();setImage(null);setImageData(null);setResult(null);}}
                style={{position:"absolute",top:6,right:6,background:"#00000099",border:"none",color:"#e8f4ff",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11}}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {imageData && !loading && (
          <button onClick={analyze} style={{
            width:"100%",padding:"12px 0",
            background:"linear-gradient(135deg,#00e67622,#00e67611)",
            border:"1px solid #00e67666",borderRadius:6,
            color:"#00e676",fontSize:12,fontWeight:700,letterSpacing:"0.1em",
            cursor:"pointer",fontFamily:"monospace",marginBottom:4
          }}>⚡ ANALYZE PATTERN</button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:32}}>
            <div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #1e3a5a",borderTop:"3px solid #00e676",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
            <div style={{color:"#3a6e9a",fontSize:12,letterSpacing:"0.08em"}}>ANALYZING CHART...</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{background:"#ff525211",border:"1px solid #ff525244",borderRadius:6,padding:12,color:"#ff5252",fontSize:12,marginTop:8}}>{error}</div>
        )}

        {/* Result Card */}
        {result && (
          <div style={{background:"#0d1e30",border:"1px solid #1e3a5a",borderRadius:8,padding:18,marginTop:12}}>

            {/* Pattern + Signal */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:9,color:"#3a6e9a",letterSpacing:"0.12em",marginBottom:3}}>PATTERN DETECTED</div>
                <div style={{fontSize:17,fontWeight:700,color:"#e8f4ff"}}>{pattern||"—"}</div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {signal&&<span style={{background:signalColor+"22",color:signalColor,border:`1px solid ${signalColor}44`,borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:700,letterSpacing:"0.1em"}}>{signal}</span>}
                {bias&&<span style={{background:"#f59e0b22",color:"#f59e0b",border:"1px solid #f59e0b44",borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:700,letterSpacing:"0.1em"}}>{bias}</span>}
              </div>
            </div>

            {/* Metrics */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
              {[["ENTRY ZONE",entry,"#38bdf8"],["TARGET",target,"#00e676"],["STOP LOSS",stop,"#ff5252"]].map(([lbl,val,col])=>(
                <div key={lbl} style={{background:"#080e1a",border:"1px solid #1e3a5a",borderRadius:6,padding:"10px 11px"}}>
                  <div style={{fontSize:8,color:"#3a6e9a",letterSpacing:"0.1em",marginBottom:3}}>{lbl}</div>
                  <div style={{color:val?col:"#3a6e9a",fontSize:12,fontWeight:600}}>{val||"N/A"}</div>
                </div>
              ))}
            </div>

            {/* Confidence Bar */}
            {confNum&&(
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:9,color:"#3a6e9a",letterSpacing:"0.1em"}}>CONFIDENCE</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#f59e0b"}}>{confNum}%</span>
                </div>
                <div style={{height:5,background:"#1e3a5a",borderRadius:3}}>
                  <div style={{height:"100%",width:`${confNum}%`,background:confNum>=70?"#00e676":confNum>=50?"#f59e0b":"#ff5252",borderRadius:3,transition:"width 1s ease"}}/>
                </div>
              </div>
            )}

            {/* Notes */}
            {notes&&(
              <div style={{background:"#080e1a",border:"1px solid #1e3a5a",borderRadius:6,padding:"10px 12px"}}>
                <div style={{fontSize:9,color:"#3a6e9a",letterSpacing:"0.1em",marginBottom:5}}>🤖 BONDO NOTES</div>
                <div style={{color:"#e8f4ff",fontSize:12,lineHeight:1.7}}>{notes}</div>
              </div>
            )}

            {!pattern&&(
              <div style={{color:"#e8f4ff",fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</div>
            )}
          </div>
        )}

        {/* Tips */}
        {!image&&(
          <div style={{marginTop:16,background:"#0d1e30",border:"1px solid #1e3a5a",borderRadius:6,padding:14}}>
            <div style={{fontSize:9,color:"#3a6e9a",letterSpacing:"0.1em",marginBottom:8}}>💡 PRO TIPS</div>
            {["Use TradingView's camera icon to download a clean chart screenshot","Crop out toolbars and side panels for best accuracy","Works with any timeframe — 5m, 15m, 1H, Daily","Ctrl+V to paste a screenshot directly from clipboard"].map((tip,i)=>(
              <div key={i} style={{color:"#3a6e9a",fontSize:11,marginBottom:5,display:"flex",gap:6}}>
                <span style={{color:"#00e676"}}>→</span>{tip}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── CHART TAB ────────────────────────────────────────────────────────────────
function ChartTab({trades, initialSym}) {
  const [chartSym, setChartSym] = useState(initialSym||"SPY");
  const [inputSym, setInputSym] = useState(initialSym||"SPY");
  const [tf, setTf] = useState("60");
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  const closedTrades = trades.filter(t=>t.pnl!==null);
  const openTrades   = trades.filter(t=>t.pnl===null);

  const TF_OPTIONS = [
    {label:"1m",  val:"1"},
    {label:"2m",  val:"2"},
    {label:"3m",  val:"3"},
    {label:"5m",  val:"5"},
    {label:"15m", val:"15"},
    {label:"30m", val:"30"},
    {label:"1H",  val:"60"},
    {label:"4H",  val:"240"},
    {label:"1D",  val:"D"},
    {label:"1W",  val:"W"},
  ];

  const loadChart = (sym, interval) => {
    setChartSym(sym);
    setInputSym(sym);
    if(interval) setTf(interval);
    setWidgetKey(k=>k+1); // force re-render of widget
  };

  const reviewTrade = (t) => {
    setSelectedTrade(t);
    loadChart(t.symbol);
  };

  // Build TradingView widget whenever sym/tf/key changes
  useEffect(()=>{
    if(!containerRef.current) return;
    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if(!containerRef.current) return;
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: chartSym,
        interval: tf,
        timezone: "America/New_York",
        theme: "dark",
        style: "1",           // candlestick
        locale: "en",
        toolbar_bg: "#0d1b2e",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        watchlist: ["SPY","QQQ","VIX","AAPL","TSLA","AMZN","NVDA","MSFT"],
        details: true,
        hotlist: false,
        calendar: false,
        show_popup_button: true,
        popup_width: "1000",
        popup_height: "650",
        // YOUR TradingView account — loads your saved indicators & layouts
        username: "alan12",
        withdateranges: true,
        save_image: true,
        studies: [
          "MASimple@tv-basicstudies",   // EMA
          "MACD@tv-basicstudies",
          "RSI@tv-basicstudies",
        ],
        container_id: "tv_chart_container",
      });
    };

    // If tv.js already loaded, just create widget
    if(window.TradingView) {
      script.onload();
    } else {
      document.head.appendChild(script);
    }

    return () => { containerRef.current && (containerRef.current.innerHTML=""); };
  }, [chartSym, tf, widgetKey]);

  const pnlColor = (pnl) => pnl===null?"#ffeb3b":parseFloat(pnl)>=0?"#00e676":"#ff1744";
  const dirColor = (d) => ["BUY","BUY CALL","SELL PUT","COVER"].includes(d)?"#00e676":"#ff1744";

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#080e1a",overflow:"hidden"}}>

      {/* TOP CONTROLS */}
      <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"8px 14px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
        {/* Symbol */}
        <input value={inputSym} onChange={e=>setInputSym(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&loadChart(inputSym)}
          style={{width:90,background:"#0d1b2e",border:"1px solid #00b4d8",borderRadius:4,color:"#00b4d8",
            padding:"6px 8px",fontSize:14,fontFamily:"inherit",outline:"none",fontWeight:700,textAlign:"center"}}/>
        <button onClick={()=>loadChart(inputSym)}
          style={{padding:"6px 12px",background:"#0d3b5e",border:"1px solid #00b4d8",
          borderRadius:4,color:"#00b4d8",fontSize:10,fontFamily:"inherit",cursor:"pointer",fontWeight:700}}>
          LOAD ↵
        </button>

        <div style={{width:1,height:20,background:"#1e3a5a"}}/>

        {/* Timeframes */}
        {TF_OPTIONS.map(t=>(
          <button key={t.val} onClick={()=>{ setTf(t.val); setWidgetKey(k=>k+1); }}
            style={{padding:"4px 8px",
              background:tf===t.val?"#0d3b5e":"transparent",
              border:`1px solid ${tf===t.val?"#00b4d8":"#1e3a5a"}`,
              color:tf===t.val?"#00b4d8":"#3a6e9a",
              borderRadius:3,fontSize:10,fontFamily:"inherit",cursor:"pointer",fontWeight:tf===t.val?700:400}}>
            {t.label}
          </button>
        ))}

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16,fontWeight:700,color:"#e8f4ff"}}>{chartSym}</span>
          <span style={{fontSize:9,color:"#00e676",padding:"2px 6px",border:"1px solid #00e676",borderRadius:3}}>alan12 ✓</span>
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{flex:1,display:"flex",overflow:"hidden",flexDirection:typeof window!=="undefined"&&window.innerWidth<768?"column":"row"}}>

        {/* TRADINGVIEW CHART — YOUR ACCOUNT */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          <div
            id="tv_chart_container"
            ref={containerRef}
            key={widgetKey}
            style={{width:"100%",height:"100%"}}
          />
          {/* Entry/Exit overlay labels */}
          {selectedTrade&&(
            <div style={{position:"absolute",top:10,left:10,zIndex:10,display:"flex",flexDirection:"column",gap:4,pointerEvents:"none"}}>
              <div style={{padding:"4px 10px",background:"rgba(8,14,26,0.9)",border:"1px solid #ffeb3b",borderRadius:4,fontSize:11,color:"#ffeb3b",fontWeight:700}}>
                ── ENTRY ${selectedTrade.entry}
              </div>
              {selectedTrade.exit&&(
                <div style={{padding:"4px 10px",background:"rgba(8,14,26,0.9)",border:"1px solid #00e676",borderRadius:4,fontSize:11,color:"#00e676",fontWeight:700}}>
                  ── EXIT ${selectedTrade.exit}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Trade Review */}
        <div style={{width:typeof window!=="undefined"&&window.innerWidth<768?"100%":250,minWidth:typeof window!=="undefined"&&window.innerWidth<768?0:250,background:"#080e1a",borderLeft:typeof window!=="undefined"&&window.innerWidth<768?"none":"1px solid #1e3a5a",borderTop:typeof window!=="undefined"&&window.innerWidth<768?"1px solid #1e3a5a":"none",display:"flex",flexDirection:"column",overflow:"hidden",maxHeight:typeof window!=="undefined"&&window.innerWidth<768?"40vh":"none"}}>

          {/* Selected trade detail */}
          {selectedTrade&&(
            <div style={{padding:"10px",borderBottom:"1px solid #1e3a5a",flexShrink:0,overflowY:"auto",maxHeight:"60%"}}>
              <div style={{fontSize:9,color:"#ff9800",fontWeight:700,letterSpacing:1,marginBottom:6}}>🔍 REVIEWING: {selectedTrade.symbol}</div>
              <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:700,color:"#e8f4ff"}}>{selectedTrade.symbol}</span>
                <span style={{fontSize:9,fontWeight:700,color:dirColor(selectedTrade.direction),
                  padding:"2px 5px",border:`1px solid ${dirColor(selectedTrade.direction)}`,borderRadius:3}}>
                  {selectedTrade.direction}
                </span>
              </div>
              {/* Price levels */}
              <div style={{background:"#0d1b2e",borderRadius:5,padding:"8px",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:9,color:"#2a5a7a"}}>── ENTRY</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#ffeb3b"}}>${selectedTrade.entry}</span>
                </div>
                {selectedTrade.exit&&(
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:9,color:"#2a5a7a"}}>── EXIT</span>
                    <span style={{fontSize:13,fontWeight:700,color:"#00e676"}}>${selectedTrade.exit}</span>
                  </div>
                )}
                {!selectedTrade.exit&&<div style={{fontSize:9,color:"#ffeb3b",textAlign:"center",marginTop:4}}>⚡ OPEN</div>}
              </div>
              {/* P&L */}
              <div style={{padding:"8px",background:selectedTrade.pnl>=0?"#051a05":"#1a0505",
                border:`1px solid ${pnlColor(selectedTrade.pnl)}`,borderRadius:5,marginBottom:6,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:pnlColor(selectedTrade.pnl)}}>
                  {selectedTrade.pnl!==null?`${parseFloat(selectedTrade.pnl)>=0?"+":""}$${parseFloat(selectedTrade.pnl).toFixed(2)}`:"OPEN"}
                </div>
                {selectedTrade.pnl!==null&&selectedTrade.pnl<0&&<div style={{fontSize:9,color:"#ff5722",marginTop:3}}>⚠️ Did setup match chart?</div>}
                {selectedTrade.pnl!==null&&selectedTrade.pnl>=0&&<div style={{fontSize:9,color:"#00e676",marginTop:3}}>✅ Profitable!</div>}
              </div>
              {/* Chart Alignment Checklist */}
              <div style={{background:"#0d1b2e",borderRadius:5,padding:"8px",marginBottom:6}}>
                <div style={{fontSize:9,color:"#3a6e9a",fontWeight:700,marginBottom:5}}>CHART ALIGNMENT CHECK</div>
                {[["HalfTrend matched?","ht"],["EMA compression?","ema"],["MACD confirmed?","macd"],["RSI not extreme?","rsi"],["Volume confirmed?","vol"]].map(([label,key])=>{
                  const val=(selectedTrade.checks||{})[key];
                  const mk=(v)=>{
                    const updated=trades.map(t=>t.id===selectedTrade.id?{...t,checks:{...(t.checks||{}),[key]:v}}:t);
                    saveBondoFund(updated);
                    setSelectedTrade(prev=>({...prev,checks:{...(prev.checks||{}),[key]:v}}));
                  };
                  return (
                    <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:9,color:"#8ab4cc"}}>{label}</span>
                      <div style={{display:"flex",gap:3}}>
                        <button onClick={()=>mk(true)}  style={{padding:"2px 7px",background:val===true?"#0a2a0a":"#0d1b2e",border:`1px solid ${val===true?"#00e676":"#1e3a5a"}`,borderRadius:3,color:val===true?"#00e676":"#3a6e9a",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                        <button onClick={()=>mk(false)} style={{padding:"2px 7px",background:val===false?"#2a0a0a":"#0d1b2e",border:`1px solid ${val===false?"#ff1744":"#1e3a5a"}`,borderRadius:3,color:val===false?"#ff1744":"#3a6e9a",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                      </div>
                    </div>
                  );
                })}
                {selectedTrade.checks&&(()=>{
                  const yes=Object.values(selectedTrade.checks).filter(v=>v===true).length;
                  const tot=Object.values(selectedTrade.checks).length;
                  const score=tot>0?Math.round(yes/tot*100):0;
                  const col=score>=80?"#00e676":score>=60?"#ff9800":"#ff1744";
                  return(
                    <div style={{marginTop:6,textAlign:"center"}}>
                      <span style={{fontSize:14,fontWeight:700,color:col}}>{score}%</span>
                      <span style={{fontSize:9,color:"#3a6e9a"}}> setup quality</span>
                      <div style={{background:"#080e1a",borderRadius:3,height:4,marginTop:4,overflow:"hidden"}}>
                        <div style={{width:`${score}%`,height:"100%",background:col,transition:"width 0.5s"}}/>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button onClick={()=>setSelectedTrade(null)}
                style={{width:"100%",padding:"4px",background:"#0d1b2e",border:"1px solid #1e3a5a",
                borderRadius:3,color:"#3a6e9a",fontSize:9,fontFamily:"inherit",cursor:"pointer"}}>
                ✕ Close Review
              </button>
            </div>
          )}

          {/* Trade list */}
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            <div style={{fontSize:9,color:"#3a6e9a",fontWeight:700,letterSpacing:1,marginBottom:6}}>
              📋 CLICK TRADE TO REVIEW
            </div>
            {trades.length===0&&(
              <div style={{textAlign:"center",padding:"20px",color:"#2a5a7a",fontSize:10}}>
                No trades yet.<br/>Log in 🏦 BONDO FUND.
              </div>
            )}
            {openTrades.length>0&&<div style={{fontSize:8,color:"#ffeb3b",letterSpacing:1,marginBottom:4}}>⚡ OPEN</div>}
            {openTrades.map(t=>(
              <div key={t.id} onClick={()=>reviewTrade(t)}
                style={{padding:"7px 9px",marginBottom:4,
                  background:selectedTrade?.id===t.id?"#0d3b5e":"#0d1b2e",
                  border:`1px solid ${selectedTrade?.id===t.id?"#00b4d8":"#1e5a3a"}`,
                  borderRadius:4,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#e8f4ff"}}>{t.symbol}</span>
                  <span style={{fontSize:9,color:"#ffeb3b",fontWeight:700}}>OPEN</span>
                </div>
                <div style={{fontSize:9,color:dirColor(t.direction)}}>{t.direction} · ${t.entry}</div>
              </div>
            ))}
            {closedTrades.length>0&&<div style={{fontSize:8,color:"#3a6e9a",letterSpacing:1,marginBottom:4,marginTop:6}}>✅ CLOSED</div>}
            {closedTrades.map(t=>(
              <div key={t.id} onClick={()=>reviewTrade(t)}
                style={{padding:"7px 9px",marginBottom:4,
                  background:selectedTrade?.id===t.id?"#0d3b5e":parseFloat(t.pnl)>=0?"#051a05":"#1a0505",
                  border:`1px solid ${selectedTrade?.id===t.id?"#00b4d8":parseFloat(t.pnl)>=0?"#1e5a3a":"#5a1e1e"}`,
                  borderRadius:4,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#e8f4ff"}}>{t.symbol}</span>
                  <span style={{fontSize:11,fontWeight:700,color:pnlColor(t.pnl)}}>{parseFloat(t.pnl)>=0?"+":""}${parseFloat(t.pnl).toFixed(0)}</span>
                </div>
                <div style={{fontSize:9,color:dirColor(t.direction)}}>{t.direction}</div>
                <div style={{fontSize:9,color:"#3a6e9a"}}>${t.entry}{t.exit?` → $${t.exit}`:""}</div>
                {t.checks&&(()=>{
                  const y=Object.values(t.checks).filter(v=>v===true).length;
                  const tot=Object.values(t.checks).length;
                  const sc=tot>0?Math.round(y/tot*100):null;
                  const col=sc>=80?"#00e676":sc>=60?"#ff9800":"#ff1744";
                  return sc!==null?<div style={{fontSize:8,color:col}}>Setup: {sc}% aligned</div>:null;
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



// ─── EMA SCANNER ──────────────────────────────────────────────────────────────
function EMAScanner({symbols, pushKey, pushToken, soundOn, onSignal, logVersion, goToChart}){
  const [ema1,setEma1]=useState(50);
  const [ema2,setEma2]=useState(100);
  const [ema3,setEma3]=useState(200);
  const [tf,setTf]=useState("1h");
  const [maxSpread,setMaxSpread]=useState(1.5);
  const [minSlope,setMinSlope]=useState(0);
  const [filterMode,setFilterMode]=useState("ALL");
  const [results,setResults]=useState([]);
  const [scanning,setScanning]=useState(false);
  const [sortBy,setSortBy]=useState("score");
  const [selRow,setSelRow]=useState(null);
  const [lastScan,setLastScan]=useState(null);
  const [prog,setProg]=useState({done:0,total:0});
  const [errors,setErrors]=useState([]);
  const [autoOn,setAutoOn]=useState(false);
  const [autoMin,setAutoMin]=useState(5);
  const prevAlignedRef = useRef(new Set());

  const runScan=useCallback(async()=>{
    setScanning(true);setSelRow(null);setErrors([]);
    const syms=symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    setProg({done:0,total:syms.length});
    const all=[],failed=[];
    // Parallel scan in batches of 10
    const BATCH=10;
    for(let b=0;b<syms.length;b+=BATCH){
      const batch=syms.slice(b,b+BATCH);
      const results=await Promise.all(batch.map(s=>analyzeEMA(s,ema1,ema2,ema3,tf,minSlope)));
      results.forEach((r,i)=>{ if(r)all.push(r); else failed.push(batch[i]); });
      setProg({done:Math.min(b+BATCH,syms.length),total:syms.length});
    }
    let filtered=[...all];
    if(filterMode==="BEARISH")filtered=filtered.filter(d=>d.allSlopingDown);
    if(filterMode==="BULLISH")filtered=filtered.filter(d=>d.allSlopingUp);
    if(filterMode==="COMPRESSED")filtered=filtered.filter(d=>parseFloat(d.spreadPct)<=maxSpread);
    if(filterMode==="SWING SIGNAL")filtered=filtered.filter(d=>d.swingSignal);
    filtered.sort((a,b)=>sortBy==="score"?b.score-a.score:sortBy==="spread"?parseFloat(a.spreadPct)-parseFloat(b.spreadPct):sortBy==="strength"?b.avgStrength-a.avgStrength:a.symbol.localeCompare(b.symbol));

    // Check for new swing signals
    const newSwing = filtered.filter(r=>r.swingSignal);
    for(const r of newSwing) {
      const key = `${r.symbol}-${r.swingSignal}`;
      if(!prevAlignedRef.current.has(key)) {
        prevAlignedRef.current.add(key);
        const ts = getETDateTime();
        const direction = "SELL";
        addSignalLog({symbol:r.symbol,direction,price:r.price,tab:"EMA SWING",timestamp:ts});
        onSignal();
        if(soundOn) playAlertSound("signal");
        if(pushKey&&pushToken) sendPushover(pushKey,pushToken,`🚨 EMA SWING ${direction}: ${r.symbol}`,`Price: $${r.price} | TF: ${tf} | Score: ${r.score}\n🕐 ${ts}`);
      }
    }

    setResults(filtered);setErrors(failed);setScanning(false);setLastScan(getETTime());
  },[ema1,ema2,ema3,tf,maxSpread,filterMode,symbols,sortBy,minSlope,pushKey,pushToken,soundOn,onSignal]);

  const nextIn = useAutoRefresh(runScan, autoOn, autoMin);
  const sel=selRow!==null?results[selRow]:null;

  return(
    <div style={{display:"flex",flex:1,minHeight:0,flexDirection:typeof window!=="undefined"&&window.innerWidth<768?"column":"row"}}>
      <MobileSettingsPanel>
        <Section title="EMA PERIODS">
          {[["EMA 1 (Fast)",ema1,setEma1],["EMA 2 (Mid)",ema2,setEma2],["EMA 3 (Slow)",ema3,setEma3]].map(([l,v,s])=>(
            <div key={l} style={{marginBottom:9}}>
              <div style={{fontSize:10,color:"#3a6e9a",marginBottom:3,letterSpacing:1}}>{l}</div>
              <input type="number" min={1} max={500} value={v} onChange={e=>s(Number(e.target.value))}
                style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#00b4d8",padding:"6px 10px",fontSize:14,fontFamily:"inherit",fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </Section>
        <Section title="TIMEFRAME (type any)">
          <input value={tf} onChange={e=>setTf(e.target.value)} placeholder="e.g. 1h, 15m, 30s"
            style={{width:"100%",background:"#0d1b2e",border:"1px solid #00b4d8",borderRadius:4,color:"#00b4d8",padding:"7px 10px",fontSize:15,fontFamily:"inherit",fontWeight:700,outline:"none",boxSizing:"border-box",textAlign:"center"}}/>
        </Section>
        <Section title="AUTO-REFRESH">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <input type="checkbox" checked={autoOn} onChange={e=>setAutoOn(e.target.checked)} id="ema_auto"/>
            <label htmlFor="ema_auto" style={{fontSize:10,color:"#c9d8e8",cursor:"pointer"}}>⏱ Auto-Refresh</label>
          </div>
          {autoOn&&<>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <input type="number" min={1} max={60} value={autoMin} onChange={e=>setAutoMin(Number(e.target.value))}
                style={{width:50,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:3,color:"#00b4d8",padding:"4px 6px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <span style={{fontSize:10,color:"#3a6e9a"}}>min interval</span>
            </div>
            <div style={{fontSize:10,color:"#ffeb3b",fontWeight:700}}>⏳ Next scan: {nextIn}s</div>
          </>}
        </Section>
        <Section title="MIN SLOPE STRENGTH">
          <span style={{fontSize:10,color:"#3a6e9a"}}>Min: <span style={{color:getSlopeColor(minSlope),fontWeight:700}}>{minSlope}% — {getSlopeLabel(minSlope)}</span></span>
          <input type="range" min={0} max={90} step={5} value={minSlope} onChange={e=>setMinSlope(Number(e.target.value))}
            style={{width:"100%",accentColor:getSlopeColor(minSlope),cursor:"pointer",marginTop:5}}/>
        </Section>
        <Section title="FILTER">
          {["ALL","BEARISH","BULLISH","COMPRESSED","SWING SIGNAL"].map(m=>(
            <button key={m} onClick={()=>setFilterMode(m)} style={{width:"100%",padding:"5px",marginBottom:4,
              background:filterMode===m?(m==="BEARISH"?"#2a0a0a":m==="BULLISH"?"#0a2a0a":m==="SWING SIGNAL"?"#1a0a2a":"#0d2a3a"):"#0d1b2e",
              border:`1px solid ${filterMode===m?(m==="BEARISH"?"#ff1744":m==="BULLISH"?"#00e676":m==="SWING SIGNAL"?"#e040fb":"#00b4d8"):"#1e3a5a"}`,
              color:filterMode===m?(m==="BEARISH"?"#ff1744":m==="BULLISH"?"#00e676":m==="SWING SIGNAL"?"#e040fb":"#00b4d8"):"#3a6e9a",
              borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700}}>{m}</button>
          ))}
        </Section>
        <Section title="SORT BY">
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["score","spread","strength","symbol"].map(s=><button key={s} onClick={()=>setSortBy(s)}
              style={{flex:1,padding:"4px 2px",fontSize:9,fontFamily:"inherit",background:sortBy===s?"#0d3b5e":"#0d1b2e",
              border:`1px solid ${sortBy===s?"#00b4d8":"#1e3a5a"}`,color:sortBy===s?"#00b4d8":"#3a6e9a",borderRadius:4,cursor:"pointer",fontWeight:700,minWidth:40}}>{s.toUpperCase()}</button>)}
          </div>
        </Section>
        <button onClick={runScan} disabled={scanning} style={{width:"100%",padding:"10px",
          background:scanning?"#0d1b2e":"linear-gradient(135deg,#0d3b5e,#0a5577)",
          border:`1px solid ${scanning?"#1e3a5a":"#00b4d8"}`,color:scanning?"#3a6e9a":"#00e5ff",
          borderRadius:6,cursor:scanning?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700,letterSpacing:2}}>
          {scanning?`SCANNING ${prog.done}/${prog.total}...`:"▶ RUN EMA SCAN"}
        </button>
        {errors.length>0&&<div style={{fontSize:10,color:"#ff5722"}}>Failed: {errors.join(", ")}</div>}
      </MobileSettingsPanel>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <MarketBanner/>
        <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"7px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <Stat label="TOTAL" value={results.length}/>
          <Stat label="BEARISH" value={results.filter(r=>r.allSlopingDown).length} color="#ff1744"/>
          <Stat label="BULLISH" value={results.filter(r=>r.allSlopingUp).length} color="#00e676"/>
          <Stat label="SWING★" value={results.filter(r=>r.swingSignal).length} color="#e040fb"/>
          <Stat label="TF" value={tf.toUpperCase()} color="#00b4d8"/>
          {lastScan&&<Stat label="SCANNED @" value={lastScan} color="#3a6e9a"/>}
          {autoOn&&nextIn>0&&<Stat label="NEXT IN" value={`${nextIn}s`} color="#ffeb3b"/>}
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {results.length===0&&!scanning&&<div style={{padding:40,textAlign:"center",color:"#2a5a7a",fontSize:13}}>{lastScan?"No results matched filter.":"Press ▶ RUN EMA SCAN"}</div>}
          {results.length>0&&(
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead><tr style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a"}}>
                {["SYMBOL","PRICE","EMA1","EMA2","EMA3","SPREAD%","SLOPE","STRENGTH","BOUNCE","REJECT","SWING★","TREND","SCORE"].map(h=>
                  <th key={h} style={{padding:"7px 7px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {results.map((r,i)=>{
                  const isSel=selRow===i;
                  const bg=isSel?"#0d2a3e":r.swingSignal?"#1a0a1a":r.allSlopingDown&&r.compressed?"#1a0a0a":r.allSlopingUp&&r.compressed?"#0a1a0a":i%2===0?"#080e1a":"#0a1218";
                  return <tr key={r.symbol} onClick={()=>setSelRow(isSel?null:i)} style={{background:bg,borderBottom:"1px solid #0f1e2e",cursor:"pointer"}}>
                    <td style={{padding:"6px 7px",fontWeight:700,color:"#e8f4ff",fontSize:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {r.symbol}
                        <button onClick={e=>{e.stopPropagation();goToChart&&goToChart(r.symbol);}} title="View on Chart"
                          style={{padding:"1px 5px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:3,
                          color:"#00b4d8",fontSize:9,cursor:"pointer",fontFamily:"inherit",lineHeight:1.4}}>📈</button>
                      </div>
                    </td>
                    <td style={{padding:"6px 7px",color:"#c9d8e8"}}>{r.price}</td>
                    <td style={{padding:"6px 7px",color:"#00b4d8"}}>{r.ema1}</td>
                    <td style={{padding:"6px 7px",color:"#00b4d8"}}>{r.ema2}</td>
                    <td style={{padding:"6px 7px",color:"#00b4d8"}}>{r.ema3}</td>
                    <td style={{padding:"6px 7px"}}><span style={{color:parseFloat(r.spreadPct)<0.5?"#ff9800":"#c9d8e8",fontWeight:parseFloat(r.spreadPct)<0.5?700:400}}>{r.spreadPct}%</span></td>
                    <td style={{padding:"6px 7px"}}><div style={{display:"flex",gap:2}}><SlopeArrow slope={r.slope1}/><SlopeArrow slope={r.slope2}/><SlopeArrow slope={r.slope3}/></div></td>
                    <td style={{padding:"6px 7px",minWidth:105}}><StrengthBar strength={r.avgStrength}/></td>
                    <td style={{padding:"6px 7px"}}>{r.bounceDetected?<span style={{padding:"2px 5px",borderRadius:3,fontSize:9,fontWeight:700,background:"#1a1400",color:"#ffeb3b",border:"1px solid #ffeb3b"}}>↑{r.bounceUp}%</span>:<span style={{color:"#2a4a6a"}}>—</span>}</td>
                    <td style={{padding:"6px 7px"}}>{r.redRejection?<span style={{padding:"2px 5px",borderRadius:3,fontSize:9,fontWeight:700,background:"#2a0a0a",color:"#ff1744",border:"1px solid #ff1744"}}>RED✖</span>:<span style={{color:"#2a4a6a"}}>—</span>}</td>
                    <td style={{padding:"6px 7px"}}>{r.swingSignal?<span style={{padding:"2px 5px",borderRadius:3,fontSize:9,fontWeight:700,background:"#1a0028",color:"#e040fb",border:"1px solid #e040fb"}}>★SELL</span>:<span style={{color:"#2a4a6a"}}>—</span>}</td>
                    <td style={{padding:"6px 7px"}}><span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:r.trend==="BEARISH"?"#2a0a0a":r.trend==="BULLISH"?"#0a2a0a":"#1a1a0a",color:r.trend==="BEARISH"?"#ff1744":r.trend==="BULLISH"?"#00e676":"#ffeb3b",border:`1px solid ${r.trend==="BEARISH"?"#ff1744":r.trend==="BULLISH"?"#00e676":"#ffeb3b"}`}}>{r.trend}</span></td>
                    <td style={{padding:"6px 7px"}}><ScoreBar score={r.score}/></td>
                  </tr>;
                })}
              </tbody>
            </table></div>
          )}
        </div>
        {sel&&(
          <div style={{background:"#0a1520",borderTop:"2px solid #1e3a5a",padding:"10px 16px"}}>
            <div style={{fontSize:10,color:"#3a6e9a",marginBottom:7,letterSpacing:2}}>▼ {sel.symbol} — {tf.toUpperCase()}</div>
            <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
              <div><div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700}}>EMA LEVELS</div>
                {[["EMA1",sel.ema1],["EMA2",sel.ema2],["EMA3",sel.ema3],["Price",sel.price]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:3}}>
                    <span style={{fontSize:10,color:"#3a6e9a"}}>{l}</span><span style={{fontSize:10,color:"#00b4d8",fontWeight:700}}>{v}</span>
                  </div>))}
              </div>
              <div><div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700}}>SIGNALS</div>
                {[["Bounce?",sel.bounceDetected?`YES +${sel.bounceUp}%`:"No",sel.bounceDetected?"#ffeb3b":"#3a6e9a"],
                  ["Red Reject?",sel.redRejection?"YES":"No",sel.redRejection?"#ff1744":"#3a6e9a"],
                  ["Swing★?",sel.swingSignal?"★ SELL SETUP!":"No",sel.swingSignal?"#e040fb":"#3a6e9a"]
                ].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:3}}>
                    <span style={{fontSize:10,color:"#3a6e9a"}}>{l}</span><span style={{fontSize:10,color:c,fontWeight:700}}>{v}</span>
                  </div>))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HALFTREND MTF SCANNER ────────────────────────────────────────────────────
function HalfTrendScanner({symbols, pushKey, pushToken, soundOn, onSignal, logVersion, goToChart}){
  const [tf1,setTf1]=useState("1h");
  const [tf2,setTf2]=useState("15m");
  const [tf3,setTf3]=useState("5m");
  const [tf4,setTf4]=useState("1m");
  const [direction,setDirection]=useState("SELL");
  const [results,setResults]=useState([]);
  const [scanning,setScanning]=useState(false);
  const [lastScan,setLastScan]=useState(null);
  const [prog,setProg]=useState({done:0,total:0});
  const [errors,setErrors]=useState([]);
  const [autoOn,setAutoOn]=useState(false);
  const [autoMin,setAutoMin]=useState(5);
  const [freshOnly,setFreshOnly]=useState(true);
  const prevAlignedRef = useRef(new Set());
  const tfs=[tf1,tf2,tf3,tf4];

  const runScan=useCallback(async()=>{
    setScanning(true);setErrors([]);
    const syms=symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    setProg({done:0,total:syms.length});
    const all=[],failed=[];
    const BATCH=10;
    for(let b=0;b<syms.length;b+=BATCH){
      const batch=syms.slice(b,b+BATCH);
      await Promise.all(batch.map(async sym=>{
        try {
          const [r1,r2,r3,r4]=await Promise.all(tfs.map(tf=>analyzeHTOnly(sym,tf)));
          const price=(r1||r2||r3||r4)?.price||"—";
          const isSell=direction==="SELL";
          const htResults=[r1,r2,r3,r4];
          const matchCount=htResults.filter(r=>r&&(isSell?r.trend===1:r.trend===0)).length;
          const totalFetched=htResults.filter(Boolean).length;
          const aligned=totalFetched===4&&matchCount===4;
          const flipCount=htResults.filter(r=>r&&(isSell?r.sellSignal:r.buySignal)).length;
          // 4th timeframe freshness check — skip if signal is older than 3 candles
          if(r4&&freshOnly){
            const r4fresh = r4.candlesAgo<=2;
            if(!r4fresh) return;
          }
          if(totalFetched===0) return;
          const r4CandlesAgo = r4?.candlesAgo??null;
          // Fetch quality metrics (relVol, ATR%, EMA dist)
          const metrics = await getStockMetrics(sym);
          all.push({symbol:sym,price,r1,r2,r3,r4,aligned,matchCount,totalFetched,flipCount,r4CandlesAgo,metrics});
        } catch(e){failed.push(sym);}
      }));
      setProg({done:Math.min(b+BATCH,syms.length),total:syms.length});
    }
    // Sort: aligned first, then by metrics score, then matchCount
    all.sort((a,b)=>{
      if(b.aligned!==a.aligned) return b.aligned-a.aligned;
      const bScore=(b.metrics?.score||0)+(b.matchCount*10)+(b.flipCount*5);
      const aScore=(a.metrics?.score||0)+(a.matchCount*10)+(a.flipCount*5);
      return bScore-aScore;
    });

    // Fire alerts for newly aligned
    const newAligned = all.filter(r=>r.aligned);
    for(const r of newAligned) {
      const key = `${r.symbol}-${direction}`;
      if(!prevAlignedRef.current.has(key)) {
        prevAlignedRef.current.add(key);
        const ts = getETDateTime();
        addSignalLog({symbol:r.symbol,direction,price:r.price,tab:"HALFTREND MTF",timestamp:ts});
        onSignal();
        if(soundOn) playAlertSound("signal");
        if(pushKey&&pushToken) sendPushover(pushKey,pushToken,`🚨 ATM SIGNAL ${direction}: ${r.symbol}`,`HalfTrend ALL 4 TF ALIGNED!\nPrice: $${r.price}\nTF: ${tf1}/${tf2}/${tf3}/${tf4}\n🕐 ${ts}`);
      }
    }
    // Clear stale keys
    const alignedKeys = new Set(newAligned.map(r=>`${r.symbol}-${direction}`));
    prevAlignedRef.current = alignedKeys;

    setResults(all);setErrors(failed);setScanning(false);setLastScan(getETTime());
  },[symbols,tf1,tf2,tf3,tf4,direction,freshOnly,pushKey,pushToken,soundOn,onSignal]);

  const nextIn = useAutoRefresh(runScan, autoOn, autoMin);
  const fullyAligned=results.filter(r=>r.aligned).length;

  return(
    <div style={{display:"flex",flex:1,minHeight:0,flexDirection:typeof window!=="undefined"&&window.innerWidth<768?"column":"row"}}>
      <MobileSettingsPanel>
        <Section title="4 TIMEFRAMES (type any)">
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <TFInput label="TF1 BIAS" value={tf1} onChange={setTf1}/>
            <TFInput label="TF2 CONFIRM" value={tf2} onChange={setTf2}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <TFInput label="TF3 ENTRY" value={tf3} onChange={setTf3}/>
            <TFInput label="TF4 FINE" value={tf4} onChange={setTf4}/>
          </div>
          <div style={{marginTop:8,padding:"8px",background:"#0d1b2e",borderRadius:4,border:"1px solid #1e3a5a"}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700,letterSpacing:1}}>QUICK PRESETS</div>
            {[["SWING","1h","15m","5m","1m"],["SCALP","5m","2m","30s","15s"],["DAY","4h","1h","15m","5m"]].map(([label,a,b,c,d])=>(
              <button key={label} onClick={()=>{setTf1(a);setTf2(b);setTf3(c);setTf4(d);}}
                style={{width:"100%",padding:"4px",marginBottom:4,background:"#0d1b2e",border:"1px solid #1e3a5a",color:"#3a6e9a",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700}}>
                {label}: {a}/{b}/{c}/{d}
              </button>))}
          </div>
        </Section>
        <Section title="DIRECTION">
          <div style={{display:"flex",gap:6}}>
            {["SELL","BUY"].map(d=><button key={d} onClick={()=>setDirection(d)} style={{flex:1,padding:"8px",
              background:direction===d?(d==="SELL"?"#2a0a0a":"#0a2a0a"):"#0d1b2e",
              border:`1px solid ${direction===d?(d==="SELL"?"#ff1744":"#00e676"):"#1e3a5a"}`,
              color:direction===d?(d==="SELL"?"#ff1744":"#00e676"):"#3a6e9a",
              borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>
              {d==="SELL"?"▼ SELL":"▲ BUY"}
            </button>)}
          </div>
        </Section>
        <Section title="TF4 SIGNAL FRESHNESS">
          <div style={{padding:"8px",background:"#0d1b2e",borderRadius:4,border:`1px solid ${freshOnly?"#ffeb3b":"#1e3a5a"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <input type="checkbox" checked={freshOnly} onChange={e=>setFreshOnly(e.target.checked)} id="ht_fresh"/>
              <label htmlFor="ht_fresh" style={{fontSize:10,color:freshOnly?"#ffeb3b":"#3a6e9a",cursor:"pointer",fontWeight:700}}>⚡ FRESH SIGNALS ONLY</label>
            </div>
            <div style={{fontSize:9,color:"#2a5a7a",lineHeight:1.5}}>
              TF4 signal must be within <span style={{color:"#ffeb3b",fontWeight:700}}>3 candles</span> — skip stale signals
            </div>
          </div>
        </Section>
        <Section title="AUTO-REFRESH">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <input type="checkbox" checked={autoOn} onChange={e=>setAutoOn(e.target.checked)} id="ht_auto"/>
            <label htmlFor="ht_auto" style={{fontSize:10,color:"#c9d8e8",cursor:"pointer"}}>⏱ Auto-Refresh</label>
          </div>
          {autoOn&&<>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <input type="number" min={1} max={60} value={autoMin} onChange={e=>setAutoMin(Number(e.target.value))}
                style={{width:50,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:3,color:"#00b4d8",padding:"4px 6px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <span style={{fontSize:10,color:"#3a6e9a"}}>min interval</span>
            </div>
            <div style={{fontSize:10,color:"#ffeb3b",fontWeight:700}}>⏳ Next scan: {nextIn}s</div>
          </>}
        </Section>
        <button onClick={runScan} disabled={scanning} style={{width:"100%",padding:"10px",
          background:scanning?"#0d1b2e":`linear-gradient(135deg,${direction==="SELL"?"#3b0d0d,#550a0a":"#0d3b0d,#0a550a"})`,
          border:`1px solid ${scanning?"#1e3a5a":direction==="SELL"?"#ff1744":"#00e676"}`,
          color:scanning?"#3a6e9a":direction==="SELL"?"#ff6b6b":"#69f0ae",
          borderRadius:6,cursor:scanning?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700,letterSpacing:2}}>
          {scanning?`SCANNING ${prog.done}/${prog.total}...`:`▶ SCAN ${direction}`}
        </button>
        {errors.length>0&&<div style={{fontSize:10,color:"#ff5722"}}>Failed: {errors.join(", ")}</div>}
      </MobileSettingsPanel>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <MarketBanner/>
        <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"7px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <Stat label="TOTAL" value={results.length}/>
          <Stat label="FULL ALIGN★" value={fullyAligned} color={direction==="SELL"?"#ff1744":"#00e676"}/>
          <Stat label="DIRECTION" value={direction} color={direction==="SELL"?"#ff1744":"#00e676"}/>
          {lastScan&&<Stat label="SCANNED @" value={lastScan} color="#3a6e9a"/>}
          {autoOn&&nextIn>0&&<Stat label="NEXT IN" value={`${nextIn}s`} color="#ffeb3b"/>}
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {results.length===0&&!scanning&&<div style={{padding:40,textAlign:"center",color:"#2a5a7a",fontSize:13}}>Press ▶ SCAN to find HalfTrend signals</div>}
          {results.length>0&&(
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead><tr style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a"}}>
                {["SYMBOL","PRICE",`${tf1.toUpperCase()} BIAS`,`${tf2.toUpperCase()} CONFIRM`,`${tf3.toUpperCase()} ENTRY`,`${tf4.toUpperCase()} FINE`,"MATCH","REL VOL","ATR%","EMA DIST","SCORE","SIGNAL","TIME"].map(h=>
                  <th key={h} style={{padding:"7px 8px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {results.map((r,i)=>{
                  const bg=r.aligned?(direction==="SELL"?"#1a0505":"#051a05"):r.matchCount>=3?"#110a05":i%2===0?"#080e1a":"#0a1218";
                  return <tr key={r.symbol} style={{background:bg,borderBottom:"1px solid #0f1e2e"}}>
                    <td style={{padding:"7px 8px",fontWeight:700,color:"#e8f4ff",fontSize:13}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {r.symbol}
                        <button onClick={e=>{e.stopPropagation();goToChart&&goToChart(r.symbol);}} title="View on Chart"
                          style={{padding:"1px 5px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:3,
                          color:"#00b4d8",fontSize:9,cursor:"pointer",fontFamily:"inherit",lineHeight:1.4}}>📈</button>
                      </div>
                    </td>
                    <td style={{padding:"7px 8px",color:"#c9d8e8"}}>{r.price}</td>
                    {[r.r1,r.r2,r.r3].map((ht,j)=><td key={j} style={{padding:"7px 8px"}}><HTBadge result={ht}/></td>)}
                    <td style={{padding:"7px 8px"}}>
                      <HTBadge result={r.r4}/>
                      {r.r4CandlesAgo!==null&&<div style={{fontSize:8,marginTop:2,color:r.r4CandlesAgo<=2?"#00e676":r.r4CandlesAgo<=5?"#ffeb3b":"#ff5722",fontWeight:700}}>
                        {r.r4CandlesAgo===0?"🔥 NOW":r.r4CandlesAgo<=2?`⚡ ${r.r4CandlesAgo+1} candles ago`:`${r.r4CandlesAgo+1} candles ago`}
                      </div>}
                    </td>
                    <td style={{padding:"7px 8px"}}>
                      <span style={{padding:"2px 7px",borderRadius:3,fontSize:10,fontWeight:700,
                        background:r.matchCount===4?(direction==="SELL"?"#3a0505":"#053a05"):"#1a1a05",
                        color:r.matchCount===4?(direction==="SELL"?"#ff1744":"#00e676"):"#ff9800",
                        border:`1px solid ${r.matchCount===4?(direction==="SELL"?"#ff1744":"#00e676"):"#ff9800"}`}}>
                        {r.matchCount}/{r.totalFetched}
                      </span>
                    </td>
                    {/* REL VOL */}
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      {r.metrics?<span style={{fontSize:10,fontWeight:700,
                        color:r.metrics.relVol>=2?"#ff1744":r.metrics.relVol>=1.5?"#ff9800":r.metrics.relVol>=1?"#ffeb3b":"#3a6e9a"}}>
                        {r.metrics.relVol}x
                      </span>:<span style={{color:"#2a4a6a"}}>—</span>}
                    </td>
                    {/* ATR% */}
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      {r.metrics?<span style={{fontSize:10,fontWeight:700,
                        color:r.metrics.atrPct>=3?"#00e676":r.metrics.atrPct>=2?"#ffeb3b":"#3a6e9a"}}>
                        {r.metrics.atrPct}%
                      </span>:<span style={{color:"#2a4a6a"}}>—</span>}
                    </td>
                    {/* EMA DIST */}
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      {r.metrics?<span style={{fontSize:10,fontWeight:700,
                        color:r.metrics.emaDist>0?"#ff1744":"#00e676"}}>
                        {r.metrics.emaDist>0?"+":""}{r.metrics.emaDist}%
                      </span>:<span style={{color:"#2a4a6a"}}>—</span>}
                    </td>
                    {/* SCORE */}
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      {r.metrics?<span style={{padding:"2px 6px",borderRadius:3,fontSize:10,fontWeight:700,
                        background:r.metrics.score>=70?"#1a0505":r.metrics.score>=40?"#1a1200":"#0d1b2e",
                        color:r.metrics.score>=70?"#ff1744":r.metrics.score>=40?"#ffeb3b":"#3a6e9a",
                        border:`1px solid ${r.metrics.score>=70?"#ff1744":r.metrics.score>=40?"#ff9800":"#1e3a5a"}`}}>
                        {r.metrics.score}
                      </span>:<span style={{color:"#2a4a6a"}}>—</span>}
                    </td>
                    <td style={{padding:"7px 8px"}}>
                      {r.aligned?<span style={{padding:"3px 8px",borderRadius:3,fontSize:10,fontWeight:700,
                        background:direction==="SELL"?"#2a0028":"#002a10",
                        color:direction==="SELL"?"#e040fb":"#00e676",
                        border:`1px solid ${direction==="SELL"?"#e040fb":"#00e676"}`}}>★ {direction} ALL4</span>
                      :r.flipCount>0?<span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:"#1a1400",color:"#ffeb3b",border:"1px solid #ffeb3b"}}>↻{r.flipCount}FLIP</span>
                      :<span style={{color:"#2a4a6a"}}>—</span>}
                    </td>
                    <td style={{padding:"7px 8px",fontSize:9,color:"#3a6e9a",whiteSpace:"nowrap"}}>
                      {r.aligned?<span style={{color:"#ffeb3b",fontWeight:700}}>{lastScan}</span>:"—"}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SHA + HALFTREND MTF SCANNER ──────────────────────────────────────────────
function SHAHTScanner({symbols, pushKey, pushToken, soundOn, onSignal, logVersion, goToChart}){
  const [tf1,setTf1]=useState("1h");
  const [tf2,setTf2]=useState("15m");
  const [tf3,setTf3]=useState("5m");
  const [tf4,setTf4]=useState("1m");
  const [direction,setDirection]=useState("SELL");
  const [results,setResults]=useState([]);
  const [scanning,setScanning]=useState(false);
  const [lastScan,setLastScan]=useState(null);
  const [prog,setProg]=useState({done:0,total:0});
  const [errors,setErrors]=useState([]);
  const [autoOn,setAutoOn]=useState(false);
  const [autoMin,setAutoMin]=useState(5);
  const prevAlignedRef = useRef(new Set());
  const tfs=[tf1,tf2,tf3,tf4];

  const runScan=useCallback(async()=>{
    setScanning(true);setErrors([]);
    const syms=symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    setProg({done:0,total:syms.length});
    const all=[],failed=[];
    const BATCH=10;
    for(let b=0;b<syms.length;b+=BATCH){
      const batch=syms.slice(b,b+BATCH);
      await Promise.all(batch.map(async sym=>{
        try {
          const [r1,r2,r3,r4]=await Promise.all(tfs.map(tf=>analyzeSHAHT(sym,tf)));
          const price=(r1||r2||r3||r4)?.price||"—";
          const isSell=direction==="SELL";
          const shahtResults=[r1,r2,r3,r4];
          const matchCount=shahtResults.filter(r=>r&&(isSell?(r.algo1==="DOWN"&&r.algo2==="DOWN"):(r.algo1==="UP"&&r.algo2==="UP"))).length;
          const totalFetched=shahtResults.filter(Boolean).length;
          const fullyAligned=totalFetched===4&&matchCount===4;
          const flipCount=shahtResults.filter(r=>r&&(isSell?r.htSellSignal:r.htBuySignal)).length;
          const shaFlipCount=shahtResults.filter(r=>r&&r.shaFlipped&&(isSell?!r.isBull:r.isBull)).length;
          if(totalFetched===0) return;
          all.push({symbol:sym,price,r1,r2,r3,r4,fullyAligned,matchCount,totalFetched,flipCount,shaFlipCount});
        } catch(e){failed.push(sym);}
      }));
      setProg({done:Math.min(b+BATCH,syms.length),total:syms.length});
    }
    all.sort((a,b)=>b.matchCount-a.matchCount||b.flipCount-a.flipCount||b.shaFlipCount-a.shaFlipCount);

    // Fire alerts for newly aligned
    const newAligned = all.filter(r=>r.fullyAligned);
    for(const r of newAligned) {
      const key = `${r.symbol}-${direction}`;
      if(!prevAlignedRef.current.has(key)) {
        prevAlignedRef.current.add(key);
        const ts = getETDateTime();
        addSignalLog({symbol:r.symbol,direction,price:r.price,tab:"SHA+HT MTF",timestamp:ts});
        onSignal();
        if(soundOn) playAlertSound("signal");
        if(pushKey&&pushToken) sendPushover(pushKey,pushToken,`🔥 ATM MACHINE ${direction}: ${r.symbol}`,`SHA + HalfTrend ALL 4 TF ALIGNED!\nPrice: $${r.price}\nTF: ${tf1}/${tf2}/${tf3}/${tf4}\n🕐 ${ts}\n💰 YOUR $300 INDICATOR FIRED!`);
      }
    }
    const alignedKeys = new Set(newAligned.map(r=>`${r.symbol}-${direction}`));
    prevAlignedRef.current = alignedKeys;

    setResults(all);setErrors(failed);setScanning(false);setLastScan(getETTime());
  },[symbols,tf1,tf2,tf3,tf4,direction,pushKey,pushToken,soundOn,onSignal]);

  const nextIn = useAutoRefresh(runScan, autoOn, autoMin);
  const fullyAligned=results.filter(r=>r.fullyAligned).length;

  return(
    <div style={{display:"flex",flex:1,minHeight:0,flexDirection:typeof window!=="undefined"&&window.innerWidth<768?"column":"row"}}>
      <MobileSettingsPanel>
        <Section title="4 TIMEFRAMES (type any)">
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <TFInput label="TF1 BIAS" value={tf1} onChange={setTf1}/>
            <TFInput label="TF2 CONFIRM" value={tf2} onChange={setTf2}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <TFInput label="TF3 ENTRY" value={tf3} onChange={setTf3}/>
            <TFInput label="TF4 FINE" value={tf4} onChange={setTf4}/>
          </div>
          <div style={{marginTop:8,padding:"8px",background:"#0d1b2e",borderRadius:4,border:"1px solid #1e3a5a"}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700,letterSpacing:1}}>QUICK PRESETS</div>
            {[["SWING","1h","15m","5m","1m"],["SCALP","5m","2m","30s","15s"],["DAY","4h","1h","15m","5m"]].map(([label,a,b,c,d])=>(
              <button key={label} onClick={()=>{setTf1(a);setTf2(b);setTf3(c);setTf4(d);}}
                style={{width:"100%",padding:"4px",marginBottom:4,background:"#0d1b2e",border:"1px solid #1e3a5a",color:"#3a6e9a",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700}}>
                {label}: {a}/{b}/{c}/{d}
              </button>))}
          </div>
        </Section>
        <Section title="DIRECTION">
          <div style={{display:"flex",gap:6}}>
            {["SELL","BUY"].map(d=><button key={d} onClick={()=>setDirection(d)} style={{flex:1,padding:"8px",
              background:direction===d?(d==="SELL"?"#2a0a0a":"#0a2a0a"):"#0d1b2e",
              border:`1px solid ${direction===d?(d==="SELL"?"#ff1744":"#00e676"):"#1e3a5a"}`,
              color:direction===d?(d==="SELL"?"#ff1744":"#00e676"):"#3a6e9a",
              borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>
              {d==="SELL"?"▼ SELL":"▲ BUY"}
            </button>)}
          </div>
        </Section>
        <Section title="AUTO-REFRESH">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <input type="checkbox" checked={autoOn} onChange={e=>setAutoOn(e.target.checked)} id="sha_auto"/>
            <label htmlFor="sha_auto" style={{fontSize:10,color:"#c9d8e8",cursor:"pointer"}}>⏱ Auto-Refresh</label>
          </div>
          {autoOn&&<>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <input type="number" min={1} max={60} value={autoMin} onChange={e=>setAutoMin(Number(e.target.value))}
                style={{width:50,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:3,color:"#00b4d8",padding:"4px 6px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <span style={{fontSize:10,color:"#3a6e9a"}}>min interval</span>
            </div>
            <div style={{fontSize:10,color:"#ffeb3b",fontWeight:700}}>⏳ Next scan: {nextIn}s</div>
          </>}
        </Section>
        <div style={{padding:"10px",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:6}}>
          <div style={{fontSize:9,color:"#2a5a7a",marginBottom:6,fontWeight:700,letterSpacing:1}}>HOW IT WORKS</div>
          <div style={{fontSize:10,color:"#3a6e9a",lineHeight:1.8}}>
            <span style={{color:"#ff9800",fontWeight:700}}>Algo 1</span> = Smoothed Heikin Ashi<br/>
            <span style={{color:"#00b4d8",fontWeight:700}}>Algo 2</span> = HalfTrend<br/><br/>
            <span style={{color:"#e040fb",fontWeight:700}}>★ SIGNAL</span> = BOTH agree ALL 4 TF<br/><br/>
            💰 Your $300 indicator!
          </div>
        </div>
        <button onClick={runScan} disabled={scanning} style={{width:"100%",padding:"10px",
          background:scanning?"#0d1b2e":`linear-gradient(135deg,${direction==="SELL"?"#3b0d2a,#550a3a":"#0d3b1a,#0a5530"})`,
          border:`1px solid ${scanning?"#1e3a5a":direction==="SELL"?"#e040fb":"#69f0ae"}`,
          color:scanning?"#3a6e9a":direction==="SELL"?"#e040fb":"#69f0ae",
          borderRadius:6,cursor:scanning?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700,letterSpacing:2}}>
          {scanning?`SCANNING ${prog.done}/${prog.total}...`:`▶ SHA+HT ${direction} SCAN`}
        </button>
        {errors.length>0&&<div style={{fontSize:10,color:"#ff5722"}}>Failed: {errors.join(", ")}</div>}
      </MobileSettingsPanel>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <MarketBanner/>
        <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"7px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <Stat label="TOTAL" value={results.length}/>
          <Stat label="★ FULL SIGNAL" value={fullyAligned} color={direction==="SELL"?"#e040fb":"#69f0ae"}/>
          <Stat label="DIRECTION" value={direction} color={direction==="SELL"?"#ff1744":"#00e676"}/>
          {lastScan&&<Stat label="SCANNED @" value={lastScan} color="#3a6e9a"/>}
          {autoOn&&nextIn>0&&<Stat label="NEXT IN" value={`${nextIn}s`} color="#ffeb3b"/>}
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {results.length===0&&!scanning&&<div style={{padding:40,textAlign:"center",color:"#2a5a7a",fontSize:13}}>Press ▶ SHA+HT SCAN to find signals</div>}
          {results.length>0&&(
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead><tr style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a"}}>
                {["SYMBOL","PRICE",`${tf1.toUpperCase()}`,`${tf2.toUpperCase()}`,`${tf3.toUpperCase()}`,`${tf4.toUpperCase()}`,"MATCH","SIGNAL","TIME"].map(h=>
                  <th key={h} style={{padding:"7px 8px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {results.map((r,i)=>{
                  const bg=r.fullyAligned?(direction==="SELL"?"#1a0514":"#051a0a"):r.matchCount>=3?"#110a0e":i%2===0?"#080e1a":"#0a1218";
                  return <tr key={r.symbol} style={{background:bg,borderBottom:"1px solid #0f1e2e"}}>
                    <td style={{padding:"7px 8px",fontWeight:700,color:"#e8f4ff",fontSize:13}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {r.symbol}
                        <button onClick={e=>{e.stopPropagation();goToChart&&goToChart(r.symbol);}} title="View on Chart"
                          style={{padding:"1px 5px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:3,
                          color:"#00b4d8",fontSize:9,cursor:"pointer",fontFamily:"inherit",lineHeight:1.4}}>📈</button>
                      </div>
                    </td>
                    <td style={{padding:"7px 8px",color:"#c9d8e8"}}>{r.price}</td>
                    {[r.r1,r.r2,r.r3,r.r4].map((res,j)=><td key={j} style={{padding:"6px 6px"}}><SHAHTBadge result={res}/></td>)}
                    <td style={{padding:"7px 8px"}}>
                      <span style={{padding:"2px 7px",borderRadius:3,fontSize:10,fontWeight:700,
                        background:r.matchCount===4?(direction==="SELL"?"#2a0028":"#002a10"):"#1a1a05",
                        color:r.matchCount===4?(direction==="SELL"?"#e040fb":"#00e676"):"#ff9800",
                        border:`1px solid ${r.matchCount===4?(direction==="SELL"?"#e040fb":"#00e676"):"#ff9800"}`}}>
                        {r.matchCount}/{r.totalFetched}
                      </span>
                    </td>
                    <td style={{padding:"7px 8px"}}>
                      {r.fullyAligned?(
                        <span style={{padding:"3px 8px",borderRadius:3,fontSize:10,fontWeight:700,
                          background:direction==="SELL"?"#2a0028":"#002a10",
                          color:direction==="SELL"?"#e040fb":"#69f0ae",
                          border:`1px solid ${direction==="SELL"?"#e040fb":"#69f0ae"}`}}>
                          ★ {direction}
                        </span>
                      ):r.flipCount>0||r.shaFlipCount>0?(
                        <span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:"#1a1400",color:"#ffeb3b",border:"1px solid #ffeb3b"}}>↻FLIP</span>
                      ):<span style={{color:"#2a4a6a"}}>—</span>}
                    </td>
                    <td style={{padding:"7px 8px",fontSize:9,color:"#3a6e9a",whiteSpace:"nowrap"}}>
                      {r.fullyAligned?<span style={{color:"#ffeb3b",fontWeight:700}}>{lastScan}</span>:"—"}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── POLYGON LIVE PRE-FILTER ──────────────────────────────────────────────────
async function filterByPriceVolume(symbols, minPrice=20, minVolume=700000, onProgress=null) {
  const syms = symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
  const BATCH = 100; // Polygon snapshot supports up to 100 tickers
  const passing = [];
  for(let b=0; b<syms.length; b+=BATCH){
    const batch = syms.slice(b, b+BATCH);
    try {
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${batch.join(",")}&apiKey=${API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if(json.tickers){
        json.tickers.forEach(t=>{
          const price = t.day?.c || t.prevDay?.c || 0;
          const volume = t.day?.v || t.prevDay?.v || 0;
          if(price >= minPrice && volume >= minVolume) passing.push(t.ticker);
        });
      }
    } catch(e){}
    if(onProgress) onProgress(Math.min(b+BATCH, syms.length), syms.length);
  }
  return passing;
}


// ─── REVERSAL SCANNER ─────────────────────────────────────────────────────────
async function analyzeReversal(symbol, tf) {
  try {
    const c = await fetchCandles(symbol, tf);
    if(!c||c.closes.length<210) return null;

    const closes = c.closes;
    const highs  = c.highs;
    const lows   = c.lows;
    const n      = closes.length;
    const price  = closes[n-1];

    // ── 200 EMA ──
    let ema200 = closes[0];
    const k200 = 2/201;
    for(let i=1;i<n;i++) ema200 = closes[i]*k200 + ema200*(1-k200);

    // ── Distance from 200 EMA ──
    const emaDist200 = parseFloat(((price - ema200)/ema200*100).toFixed(2));
    const absEma200  = Math.abs(emaDist200);

    // Only care if price is stretched >= 2% from 200 EMA
    if(absEma200 < 2) return null;

    // ── HalfTrend signal ──
    const ht = calcHalfTrend(highs, lows, closes);
    if(!ht) return null;

    // ── Gap detection: compare last close to close 3 bars ago ──
    const gapPct = parseFloat(((closes[n-1] - closes[n-4])/closes[n-4]*100).toFixed(2));
    const absGap = Math.abs(gapPct);

    // ── Reversal condition ──
    // Gapped UP (price above 200 EMA) + HalfTrend now SELL = short reversal
    // Gapped DOWN (price below 200 EMA) + HalfTrend now BUY = long reversal
    const gappedUp   = emaDist200 > 2;
    const gappedDown = emaDist200 < -2;
    const htSell     = ht.trend === 1;
    const htBuy      = ht.trend === 0;

    const shortReversal = gappedUp   && htSell; // stretched above, now reversing down
    const longReversal  = gappedDown && htBuy;  // stretched below, now reversing up

    if(!shortReversal && !longReversal) return null;

    const direction = shortReversal ? "SHORT" : "LONG";

    // ── Strength score ──
    const distScore  = absEma200>=5?40:absEma200>=3?25:10;
    const gapScore   = absGap>=3?30:absGap>=1.5?20:10;
    const freshScore = ht.candlesAgo<=2?30:ht.candlesAgo<=5?15:5;
    const score      = distScore + gapScore + freshScore;

    return {
      symbol, price: price.toFixed(2), tf, direction,
      emaDist200, absEma200, ema200: ema200.toFixed(2),
      gapPct, candlesAgo: ht.candlesAgo,
      sellSignal: ht.sellSignal, buySignal: ht.buySignal,
      score, shortReversal, longReversal
    };
  } catch(e){ return null; }
}

function ReversalScanner({symbols, pushKey, pushToken, soundOn, onSignal, logVersion, goToChart}){
  const [tf1,setTf1]     = useState("1h");
  const [tf2,setTf2]     = useState("5m");
  const [tf3,setTf3]     = useState("2m");
  const [minDist,setMinDist] = useState(2);
  const [direction,setDirection] = useState("BOTH");
  const [results,setResults]   = useState([]);
  const [scanning,setScanning] = useState(false);
  const [prog,setProg]         = useState({done:0,total:0});
  const [errors,setErrors]     = useState([]);
  const [lastScan,setLastScan] = useState(null);
  const [autoOn,setAutoOn]     = useState(false);
  const [autoMin,setAutoMin]   = useState(5);
  const prevRef = useRef(new Set());

  const tfs = [tf1,tf2,tf3].filter(Boolean);

  const runScan = useCallback(async()=>{
    setScanning(true); setErrors([]);
    const syms = symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    setProg({done:0,total:syms.length});
    const all=[], failed=[];
    const BATCH=10;
    for(let b=0;b<syms.length;b+=BATCH){
      const batch=syms.slice(b,b+BATCH);
      await Promise.all(batch.map(async sym=>{
        try {
          // Scan across all selected timeframes
          const tfResults = await Promise.all(tfs.map(tf=>analyzeReversal(sym,tf)));
          tfResults.forEach((r,i)=>{
            if(!r) return;
            if(r.absEma200 < minDist) return;
            if(direction==="SHORT" && !r.shortReversal) return;
            if(direction==="LONG"  && !r.longReversal)  return;
            all.push({...r, tf:tfs[i]});
          });
        } catch(e){ failed.push(sym); }
      }));
      setProg({done:Math.min(b+BATCH,syms.length),total:syms.length});
    }
    // Sort by score desc
    all.sort((a,b)=>b.score-a.score||b.absEma200-a.absEma200);

    // Alerts
    all.forEach(r=>{
      const key=`${r.symbol}-${r.tf}-${r.direction}`;
      if(!prevRef.current.has(key)){
        prevRef.current.add(key);
        onSignal && onSignal();
        if(soundOn) playAlertSound("signal");
        if(pushKey&&pushToken) sendPushover(pushKey,pushToken,
          `🎯 REVERSAL: ${r.symbol} ${r.direction}`,
          `TF: ${r.tf} | EMA Dist: ${r.emaDist200}% | Gap: ${r.gapPct}% | Score: ${r.score}`);
      }
    });
    prevRef.current = new Set(all.map(r=>`${r.symbol}-${r.tf}-${r.direction}`));

    setResults(all); setErrors(failed);
    setScanning(false); setLastScan(getETTime());
  },[symbols,tf1,tf2,tf3,direction,minDist,pushKey,pushToken,soundOn,onSignal]);

  const nextIn = useAutoRefresh(runScan, autoOn, autoMin);
  const shorts = results.filter(r=>r.shortReversal).length;
  const longs  = results.filter(r=>r.longReversal).length;

  return(
    <div style={{display:"flex",flex:1,minHeight:0,flexDirection:typeof window!=="undefined"&&window.innerWidth<768?"column":"row"}}>
      {/* LEFT PANEL */}
      <MobileSettingsPanel>
        <Section title="TIMEFRAMES">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <TFInput label="TF1 (Gap chart)" value={tf1} onChange={setTf1}/>
            <TFInput label="TF2 (Entry)" value={tf2} onChange={setTf2}/>
            <TFInput label="TF3 (Fine entry)" value={tf3} onChange={setTf3}/>
          </div>
          <div style={{marginTop:8,padding:"8px",background:"#0d1b2e",borderRadius:4,border:"1px solid #1e3a5a"}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700,letterSpacing:1}}>QUICK PRESETS</div>
            {[["DAY",  "1d","1h","15m"],
              ["SWING","1h","5m","2m"],
              ["SCALP","5m","2m","30s"]].map(([label,a,b,c])=>(
              <button key={label} onClick={()=>{setTf1(a);setTf2(b);setTf3(c);}}
                style={{width:"100%",padding:"4px",marginBottom:4,background:"#0d1b2e",border:"1px solid #1e3a5a",color:"#3a6e9a",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700}}>
                {label}: {a}/{b}/{c}
              </button>))}
          </div>
        </Section>

        <Section title="MIN EMA DISTANCE">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="number" min={1} max={20} step={0.5} value={minDist}
              onChange={e=>setMinDist(parseFloat(e.target.value))}
              style={{width:60,background:"#0d1b2e",border:"1px solid #ffeb3b",borderRadius:4,color:"#ffeb3b",padding:"6px 8px",fontSize:14,fontFamily:"inherit",fontWeight:700,outline:"none",textAlign:"center"}}/>
            <span style={{fontSize:11,color:"#3a6e9a"}}>% from 200 EMA</span>
          </div>
          <div style={{fontSize:9,color:"#2a5a7a",marginTop:4}}>Higher = more stretched = higher risk reversal</div>
        </Section>

        <Section title="DIRECTION">
          <div style={{display:"flex",gap:6,flexDirection:"column"}}>
            {[["BOTH","⇅ BOTH","#ffeb3b"],["SHORT","▼ SHORT REVERSAL","#ff1744"],["LONG","▲ LONG REVERSAL","#00e676"]].map(([d,label,col])=>(
              <button key={d} onClick={()=>setDirection(d)} style={{padding:"8px",
                background:direction===d?"#0d1b2e":"transparent",
                border:`1px solid ${direction===d?col:"#1e3a5a"}`,
                color:direction===d?col:"#3a6e9a",
                borderRadius:4,cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700}}>
                {label}
              </button>))}
          </div>
        </Section>

        <Section title="AUTO-REFRESH">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <input type="checkbox" checked={autoOn} onChange={e=>setAutoOn(e.target.checked)} id="rev_auto"/>
            <label htmlFor="rev_auto" style={{fontSize:10,color:"#c9d8e8",cursor:"pointer"}}>⏱ Auto-Refresh</label>
          </div>
          {autoOn&&<>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <input type="number" min={1} max={60} value={autoMin} onChange={e=>setAutoMin(Number(e.target.value))}
                style={{width:50,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:3,color:"#00b4d8",padding:"4px 6px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <span style={{fontSize:10,color:"#3a6e9a"}}>min interval</span>
            </div>
            {nextIn>0&&<div style={{fontSize:10,color:"#ffeb3b",fontWeight:700}}>⏳ Next: {nextIn}s</div>}
          </>}
        </Section>

        <button onClick={runScan} disabled={scanning} style={{width:"100%",padding:"10px",
          background:scanning?"#0d1b2e":"linear-gradient(135deg,#1a0d00,#2a1500)",
          border:`1px solid ${scanning?"#1e3a5a":"#ff9800"}`,
          color:scanning?"#3a6e9a":"#ff9800",
          borderRadius:6,cursor:scanning?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700,letterSpacing:2}}>
          {scanning?`SCANNING ${prog.done}/${prog.total}...`:"🎯 SCAN REVERSALS"}
        </button>
        {errors.length>0&&<div style={{fontSize:10,color:"#ff5722"}}>Failed: {errors.slice(0,5).join(", ")}</div>}
      </MobileSettingsPanel>

      {/* RIGHT PANEL */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <MarketBanner/>
        {/* Stats bar */}
        <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"7px 14px",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <Stat label="TOTAL" value={results.length}/>
          <Stat label="▼ SHORT" value={shorts} color="#ff1744"/>
          <Stat label="▲ LONG"  value={longs}  color="#00e676"/>
          {lastScan&&<Stat label="SCANNED" value={lastScan} color="#ffeb3b"/>}
          {autoOn&&nextIn>0&&<Stat label="NEXT IN" value={`${nextIn}s`} color="#ffeb3b"/>}
          <div style={{marginLeft:"auto",fontSize:9,color:"#2a5a7a"}}>
            Sorted by Score → EMA Distance
          </div>
        </div>

        {/* Legend */}
        <div style={{background:"#080e1a",borderBottom:"1px solid #0f1e2e",padding:"6px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#3a6e9a"}}>🎯 = Fresh HalfTrend flip</span>
          <span style={{fontSize:9,color:"#ff1744"}}>▼ SHORT = Gapped up + now selling</span>
          <span style={{fontSize:9,color:"#00e676"}}>▲ LONG = Gapped down + now buying</span>
          <span style={{fontSize:9,color:"#ffeb3b"}}>EMA DIST = How far from 200 EMA</span>
        </div>

        <div style={{flex:1,overflowY:"auto"}}>
          {results.length===0&&!scanning&&(
            <div style={{textAlign:"center",padding:"60px",color:"#2a5a7a"}}>
              <div style={{fontSize:40,marginBottom:12}}>🎯</div>
              <div style={{fontSize:14,fontWeight:700,color:"#3a6e9a",marginBottom:8}}>REVERSAL SCANNER</div>
              <div style={{fontSize:11,color:"#2a5a7a",lineHeight:1.8}}>
                Finds stocks that:<br/>
                • Gapped far from 200 EMA<br/>
                • HalfTrend now reversing back<br/>
                • High probability mean reversion trades
              </div>
            </div>
          )}
          {results.length>0&&(
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead>
                <tr style={{background:"#0a1520",position:"sticky",top:0,zIndex:1}}>
                  {["SYMBOL","TF","PRICE","200 EMA","EMA DIST %","GAP %","DIRECTION","CANDLES AGO","SCORE","ACTION"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:8,color:"#2a5a7a",letterSpacing:1,borderBottom:"1px solid #1e3a5a",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r,i)=>{
                  const isShort = r.shortReversal;
                  const col = isShort?"#ff1744":"#00e676";
                  const bg  = i%2===0?"#080e1a":"#0a1218";
                  return(
                    <tr key={`${r.symbol}-${r.tf}-${i}`} style={{background:r.score>=70?(isShort?"#1a0505":"#051a05"):bg,
                      borderBottom:"1px solid #0f1e2e",cursor:"pointer"}}
                      onClick={()=>goToChart&&goToChart(r.symbol)}>
                      <td style={{padding:"8px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:13,fontWeight:700,color:"#e8f4ff"}}>{r.symbol}</span>
                          <button onClick={e=>{e.stopPropagation();goToChart&&goToChart(r.symbol);}}
                            style={{padding:"1px 5px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:3,
                            color:"#00b4d8",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>📈</button>
                        </div>
                      </td>
                      <td style={{padding:"8px 10px"}}>
                        <span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,
                          background:"#0d1b2e",color:"#00b4d8",border:"1px solid #1e5a7a"}}>{r.tf.toUpperCase()}</span>
                      </td>
                      <td style={{padding:"8px 10px",color:"#e8f4ff",fontWeight:700}}>${r.price}</td>
                      <td style={{padding:"8px 10px",color:"#3a6e9a"}}>${r.ema200}</td>
                      <td style={{padding:"8px 10px"}}>
                        <span style={{fontWeight:700,fontSize:12,
                          color:r.absEma200>=5?"#ff1744":r.absEma200>=3?"#ff9800":"#ffeb3b"}}>
                          {r.emaDist200>0?"+":""}{r.emaDist200}%
                        </span>
                      </td>
                      <td style={{padding:"8px 10px"}}>
                        <span style={{fontWeight:700,color:r.gapPct>0?"#ff6b6b":"#69f0ae"}}>
                          {r.gapPct>0?"+":""}{r.gapPct}%
                        </span>
                      </td>
                      <td style={{padding:"8px 10px"}}>
                        <span style={{padding:"3px 8px",borderRadius:3,fontSize:10,fontWeight:700,
                          background:isShort?"#2a0505":"#052a05",
                          color:col,border:`1px solid ${col}`}}>
                          {isShort?"▼ SHORT REV":"▲ LONG REV"}
                        </span>
                      </td>
                      <td style={{padding:"8px 10px",textAlign:"center"}}>
                        <span style={{fontSize:10,fontWeight:700,
                          color:r.candlesAgo===0?"#ff9800":r.candlesAgo<=2?"#00e676":r.candlesAgo<=5?"#ffeb3b":"#3a6e9a"}}>
                          {r.candlesAgo===0?"🔥 NOW":`${r.candlesAgo+1} bars ago`}
                        </span>
                      </td>
                      <td style={{padding:"8px 10px",textAlign:"center"}}>
                        <span style={{padding:"2px 8px",borderRadius:3,fontSize:11,fontWeight:700,
                          background:r.score>=70?(isShort?"#2a0505":"#052a05"):r.score>=40?"#1a1200":"#0d1b2e",
                          color:r.score>=70?col:r.score>=40?"#ffeb3b":"#3a6e9a",
                          border:`1px solid ${r.score>=70?col:r.score>=40?"#ff9800":"#1e3a5a"}`}}>
                          {r.score}
                        </span>
                      </td>
                      <td style={{padding:"8px 10px"}}>
                        <button onClick={e=>{e.stopPropagation();goToChart&&goToChart(r.symbol);}}
                          style={{padding:"5px 10px",background:isShort?"linear-gradient(135deg,#2a0505,#3a0808)":"linear-gradient(135deg,#052a05,#083a08)",
                          border:`1px solid ${col}`,borderRadius:4,color:col,
                          fontSize:9,fontFamily:"inherit",cursor:"pointer",fontWeight:700}}>
                          {isShort?"▼ SHORT":"▲ LONG"} →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [symbols,setSymbols]=useState(()=>{
    try { const s=localStorage.getItem("alo_watchlist"); return s||DEFAULT_SYMBOLS.join(","); }
    catch(e){ return DEFAULT_SYMBOLS.join(","); }
  });

  // ── Purge stale cache on every app load ──
  useEffect(()=>{ purgeOldMetricsCache(); purgeOldCandleCache(); },[]);
  const [activeTab,setActiveTab]=useState(()=>{
    try { return localStorage.getItem("alo_tab")||"ema"; } catch(e){ return "ema"; }
  });
  const [pushKey,setPushKey]=useState(()=>{ try{return localStorage.getItem("alo_push_key")||"";}catch(e){return "";} });
  const [pushToken,setPushToken]=useState(()=>{ try{return localStorage.getItem("alo_push_token")||"";}catch(e){return "";} });
  const [soundOn,setSoundOn]=useState(true);
  const [logVersion,setLogVersion]=useState(0);
  const [flashAlert,setFlashAlert]=useState(null);
  const [chartSym,setChartSym]=useState("SPY");
  const [filtering,setFiltering]=useState(false);
  const [filterProg,setFilterProg]=useState(null);
  const [minPrice,setMinPrice]=useState(20);
  const [minVol,setMinVol]=useState(700000);

  const runFilter = async () => {
    setFiltering(true); setFilterProg("Fetching snapshots...");
    try {
      const passing = await filterByPriceVolume(symbols, minPrice, minVol, (done,total)=>{
        setFilterProg(`Checking ${done}/${total}...`);
      });
      updateSymbols(passing.join(","));
      setFilterProg(`✅ ${passing.length} stocks passed filter`);
      setTimeout(()=>setFilterProg(null), 3000);
    } catch(e){ setFilterProg("❌ Filter failed"); setTimeout(()=>setFilterProg(null),3000); }
    setFiltering(false);
  };

  const updateSymbols=(val)=>{
    setSymbols(val);
    try { localStorage.setItem("alo_watchlist",val); } catch(e){}
  };
  const updateTab=(id)=>{
    setActiveTab(id);
    try { localStorage.setItem("alo_tab",id); } catch(e){}
  };

  const goToChart=(sym)=>{ setChartSym(sym); updateTab("chart"); };

  const handleSignal = useCallback(()=>{
    setLogVersion(n=>n+1);
    // Flash the header
    setFlashAlert(Date.now());
    setTimeout(()=>setFlashAlert(null), 3000);
  },[]);

  const handleTestPush = async()=>{
    playAlertSound("signal");
    return sendPushover(pushKey, pushToken, "🔥 ATM MACHINE TEST", `Signal alert working!\n🕐 ${getETDateTime()}\n💰 Bondo Charity is watching!`);
  };

  const tabs=[
    {id:"ema",label:"📊 EMA",color:"#00b4d8"},
    {id:"ht",label:"★ HALFTREND",color:"#e040fb"},
    {id:"shaht",label:"🔥 SHA+HT",color:"#ff9800"},
    {id:"reversal",label:"🎯 REVERSAL",color:"#ff9800"},
    {id:"pnl",label:"🏦 BONDO FUND",color:"#00e676"},
    {id:"chart",label:"📈 CHART",color:"#ff9800"},
    {id:"pattern",label:"🔍 PATTERN AI",color:"#00e676"},
  ];

  const isMobile = useMobile();
  const scannerProps = {symbols, pushKey, pushToken, soundOn, onSignal:handleSignal, logVersion, goToChart};

  return(
    <div style={{fontFamily:"'Courier New',monospace",background:"#080e1a",minHeight:"100vh",color:"#c9d8e8",display:"flex",flexDirection:"column",maxWidth:"100vw",overflowX:"hidden"}}>
      {/* HEADER */}
      <div style={{background:flashAlert?"linear-gradient(90deg,#1a0a00,#0a1520)":"linear-gradient(90deg,#0d1b2e,#0a1520)",borderBottom:`2px solid ${flashAlert?"#ff9800":"#1e3a5a"}`,padding:isMobile?"8px 10px":"10px 20px",display:"flex",flexDirection:"column",gap:6,transition:"all 0.3s"}}>
        {/* Row 1: Logo */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,background:flashAlert?"#ff9800":"#00e676",boxShadow:`0 0 ${flashAlert?"16px #ff9800":"8px #00e676"}`,transition:"all 0.3s"}}/>
            <span style={{fontSize:isMobile?11:15,fontWeight:700,color:"#e8f4ff",letterSpacing:isMobile?1:2}}>ALO TRADING SCANNER</span>
            <span style={{fontSize:9,color:"#ff9800",padding:"2px 6px",border:"1px solid #ff9800",borderRadius:3,fontWeight:700}}>v6.0 ATM</span>
            {flashAlert&&<span style={{fontSize:10,color:"#ff9800",fontWeight:700}}>🚨 SIGNAL!</span>}
          </div>
        </div>
        {/* Row 2: Watchlist */}
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#2a5a7a",letterSpacing:1,whiteSpace:"nowrap"}}>WATCHLIST</span>
          <select onChange={e=>{if(e.target.value)updateSymbols(WATCHLIST_PRESETS[e.target.value].join(","));e.target.value="";}}
            style={{background:"#0d1b2e",border:"1px solid #1e5a7a",borderRadius:4,color:"#00b4d8",padding:"4px 6px",fontSize:10,fontFamily:"inherit",cursor:"pointer",outline:"none",maxWidth:isMobile?130:200}}>
            <option value="">📋 Preset...</option>
            {Object.keys(WATCHLIST_PRESETS).map(k=><option key={k} value={k}>{k}</option>)}
          </select>
          <input value={symbols} onChange={e=>updateSymbols(e.target.value)}
            style={{flex:1,minWidth:isMobile?80:200,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#8ab4cc",padding:"5px 8px",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
          <span style={{fontSize:9,color:"#3a6e9a",whiteSpace:"nowrap"}}>{symbols.split(",").filter(s=>s.trim()).length}&#x2009;stk</span>
        </div>
        {/* Row 3: Filter */}
        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
          <input type="number" value={minPrice} onChange={e=>setMinPrice(Number(e.target.value))} title="Min Price $"
            style={{width:48,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:3,color:"#ffeb3b",padding:"3px 5px",fontSize:10,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
          <span style={{fontSize:9,color:"#2a5a7a"}}>$min</span>
          <input type="number" value={minVol} onChange={e=>setMinVol(Number(e.target.value))} title="Min Avg Volume"
            style={{width:60,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:3,color:"#ffeb3b",padding:"3px 5px",fontSize:10,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
          <span style={{fontSize:9,color:"#2a5a7a"}}>vol</span>
          <button onClick={runFilter} disabled={filtering}
            style={{padding:"4px 10px",background:filtering?"#0d1b2e":"linear-gradient(135deg,#0d3b1a,#0a4a28)",border:"1px solid #00e676",borderRadius:4,color:"#00e676",fontSize:9,fontFamily:"inherit",cursor:filtering?"not-allowed":"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
            {filtering?"⏳ "+filterProg:"🔍 FILTER"}
          </button>
          {filterProg&&!filtering&&<span style={{fontSize:9,color:"#00e676"}}>{filterProg}</span>}
        </div>
      </div>

      {/* TABS — scrollable on mobile */}
      <div style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a",display:"flex",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>updateTab(tab.id)} style={{
            padding:isMobile?"10px 10px":"10px 18px",
            fontFamily:"inherit",fontSize:isMobile?9:11,fontWeight:700,letterSpacing:isMobile?0:1,
            background:activeTab===tab.id?"#0d1e30":"transparent",
            borderBottom:activeTab===tab.id?`2px solid ${tab.color}`:"2px solid transparent",
            color:activeTab===tab.id?tab.color:"#3a6e9a",
            border:"none",cursor:"pointer",marginBottom:"-2px",whiteSpace:"nowrap",flexShrink:0}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* SCANNER AREA */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          {activeTab==="ema"&&<EMAScanner {...scannerProps}/>}
          {activeTab==="ht"&&<HalfTrendScanner {...scannerProps}/>}
          {activeTab==="shaht"&&<SHAHTScanner {...scannerProps}/>}
          {activeTab==="reversal"&&<ReversalScanner {...scannerProps}/>}
          {activeTab==="pnl"&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <BondoFund/>
            </div>
          )}
          {activeTab==="chart"&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <ChartTab trades={getBondoFundData()} initialSym={chartSym}/>
            </div>
          )}
          {activeTab==="pattern"&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <ChartPatternAnalyzer/>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR — hidden on mobile (AlertSettings accessible via scanner settings) */}
        {!isMobile&&(
        <div style={{width:220,minWidth:220,background:"#080e1a",borderLeft:"1px solid #1e3a5a",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <AlertSettings
            pushKey={pushKey} setPushKey={setPushKey}
            pushToken={pushToken} setPushToken={setPushToken}
            soundOn={soundOn} setSoundOn={setSoundOn}
            onTest={handleTestPush}
          />
          <SignalLogPanel logVersion={logVersion}/>
        </div>
        )}
      </div>

      <style>{`
        tbody tr:hover{background:#0d2233 !important;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:#080e1a;}
        ::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:3px;}
        input[type=range]{height:4px;}
        @keyframes pulse{0%{opacity:1;}50%{opacity:0.4;}100%{opacity:1;}}
        /* hide scrollbar on tab bar */
        div::-webkit-scrollbar:horizontal{height:0;}
      `}</style>
    </div>
  );
}
