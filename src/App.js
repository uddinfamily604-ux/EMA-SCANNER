import { useState, useCallback, useEffect, useRef } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";
const BASE_URL = "https://api.polygon.io";
const DEFAULT_SYMBOLS = ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","SOFI","PLTR","MARA","COIN","RIVN","BABA","BAC","JPM","GS","IWM"];

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
  SIGNAL_LOG = [entry, ...SIGNAL_LOG].slice(0,100);
  try { localStorage.setItem("alo_signal_log", JSON.stringify(SIGNAL_LOG)); } catch(e){}
}
function clearSignalLog() {
  SIGNAL_LOG = [];
  try { localStorage.removeItem("alo_signal_log"); } catch(e){}
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
    const from = new Date(now);
    from.setDate(from.getDate() - daysBack(timespan));
    const fromStr = from.toISOString().split("T")[0];
    const toStr = now.toISOString().split("T")[0];
    const url = `${BASE_URL}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return {
      closes: data.results.map(r => r.c),
      opens:  data.results.map(r => r.o),
      highs:  data.results.map(r => r.h),
      lows:   data.results.map(r => r.l),
    };
  } catch(e) { return null; }
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
  return {...ht, price:c.closes[c.closes.length-1].toFixed(2)};
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
  const [,forceUpdate] = useState(0);
  const handleClear = ()=>{ clearSignalLog(); forceUpdate(n=>n+1); };
  return (
    <div style={{borderTop:"1px solid #1e3a5a",padding:"8px 12px"}}>
      <button onClick={()=>setShow(s=>!s)} style={{width:"100%",padding:"6px",background:"#080e1a",border:"1px solid #1e3a5a",borderRadius:4,color:"#ffeb3b",fontSize:10,fontFamily:"inherit",fontWeight:700,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>📋 SIGNAL LOG ({SIGNAL_LOG.length})</span>
        <span>{show?"▲":"▼"}</span>
      </button>
      {show&&(
        <div style={{maxHeight:220,overflowY:"auto",marginTop:6}}>
          <button onClick={handleClear} style={{width:"100%",padding:"4px",marginBottom:6,background:"#1a0a00",border:"1px solid #ff5722",borderRadius:3,color:"#ff5722",fontSize:9,fontFamily:"inherit",cursor:"pointer"}}>🗑 CLEAR LOG</button>
          {SIGNAL_LOG.length===0&&<div style={{fontSize:10,color:"#2a5a7a",textAlign:"center",padding:10}}>No signals yet</div>}
          {SIGNAL_LOG.map((s,i)=>(
            <div key={i} style={{padding:"6px 8px",marginBottom:4,background:s.direction==="SELL"?"#1a050a":"#051a0a",border:`1px solid ${s.direction==="SELL"?"#ff1744":"#00e676"}`,borderRadius:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:"#e8f4ff"}}>{s.symbol}</span>
                <span style={{fontSize:9,color:s.direction==="SELL"?"#ff1744":"#00e676",fontWeight:700}}>★ {s.direction}</span>
              </div>
              <div style={{fontSize:9,color:"#3a6e9a",marginTop:2}}>{s.tab} · ${s.price}</div>
              <div style={{fontSize:9,color:"#ffeb3b",marginTop:2}}>🕐 {s.timestamp}</div>
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

function calcFundStats(trades) {
  const closed = trades.filter(t=>t.pnl!==null);
  const open = trades.filter(t=>t.pnl===null);
  const totalPnl = closed.reduce((a,t)=>a+parseFloat(t.pnl),0);
  const nav = STARTING_BALANCE + totalPnl;
  const roi = (totalPnl/STARTING_BALANCE)*100;
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
  return {totalPnl,nav,roi,wins:wins.length,losses:losses.length,winRate,avgWin,avgLoss,profitFactor,maxDD,maxDDPct,bondo,sharpe,closed:closed.length,openCount:open.length};
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
  const symDebounceRef = useRef(null);
  const priceTimerRef = useRef({});

  const s = calcFundStats(trades);
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

  // ── Auto-refresh open position prices every 30s ──
  useEffect(()=>{
    const refresh = async () => {
      for(const t of openTrades){
        try {
          const res = await fetch(`https://api.polygon.io/v2/last/trade/${t.symbol}?apiKey=${API_KEY}`);
          const json = await res.json();
          if(json.results?.p) setClosingPrices(p=>({...p,[t.id]:json.results.p.toFixed(2)}));
        } catch(e){}
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return ()=>clearInterval(timer);
  }, [trades]);

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
            <div style={{fontSize:12,color:roiColor,fontWeight:700}}>{s.roi>=0?"+":""}{s.roi.toFixed(2)}% ROI · {s.totalPnl>=0?"+":""}${s.totalPnl.toFixed(2)} P&L</div>
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

                {/* CLOSE POSITION */}
                <div style={{background:"#080e1a",borderRadius:6,padding:"10px",border:"1px solid #1e5a3a"}}>
                  <div style={{fontSize:9,color:"#00e676",fontWeight:700,marginBottom:8}}>CLOSE POSITION</div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input
                      value={closingPrices[t.id]||""}
                      onChange={e=>setClosingPrices(p=>({...p,[t.id]:e.target.value}))}
                      placeholder="Exit price"
                      style={{flex:1,background:"#0d1b2e",border:"1px solid #00e676",borderRadius:4,
                        color:"#00e676",padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none",fontWeight:700}}
                    />
                    <button onClick={()=>fetchClosePrice(t.id,t.symbol)}
                      style={{padding:"8px 10px",background:"#0d3b5e",border:"1px solid #00b4d8",borderRadius:4,
                        color:"#00b4d8",fontSize:9,fontFamily:"inherit",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                      {fetchingClose[t.id]?"⟳":"📡 LIVE"}
                    </button>
                    <button onClick={()=>closePosition(t.id)}
                      disabled={!closingPrices[t.id]}
                      style={{padding:"8px 14px",
                        background:closingPrices[t.id]?"linear-gradient(135deg,#0d3b1a,#0a5530)":"#0d1b2e",
                        border:`1px solid ${closingPrices[t.id]?"#00e676":"#1e3a5a"}`,
                        borderRadius:4,color:closingPrices[t.id]?"#00e676":"#2a5a7a",
                        fontSize:11,fontFamily:"inherit",cursor:closingPrices[t.id]?"pointer":"not-allowed",fontWeight:700}}>
                      ✓ CLOSE
                    </button>
                  </div>
                  {/* Preview P&L on close */}
                  {closingPrices[t.id]&&(()=>{
                    const preview = calcPnl(t.direction,t.type,t.entry,closingPrices[t.id],t.qty);
                    const col = preview>=0?"#00e676":"#ff1744";
                    return (
                      <div style={{marginTop:6,display:"flex",gap:12}}>
                        <span style={{fontSize:12,fontWeight:700,color:col}}>{preview>=0?"+":""}${preview.toFixed(2)}</span>
                        <span style={{fontSize:9,color:"#00e676"}}>🙏 Bondo: ${Math.max(0,preview*0.2).toFixed(2)}</span>
                      </div>
                    );
                  })()}
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
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

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
        <div style={{width:250,minWidth:250,background:"#080e1a",borderLeft:"1px solid #1e3a5a",display:"flex",flexDirection:"column",overflow:"hidden"}}>

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
    for(let i=0;i<syms.length;i++){
      const r=await analyzeEMA(syms[i],ema1,ema2,ema3,tf,minSlope);
      if(r)all.push(r);else failed.push(syms[i]);
      setProg({done:i+1,total:syms.length});
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
    <div style={{display:"flex",flex:1,minHeight:0}}>
      <div style={{width:250,minWidth:250,background:"#0a1520",borderRight:"1px solid #1e3a5a",padding:"14px 12px",display:"flex",flexDirection:"column",gap:13,overflowY:"auto"}}>
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
      </div>
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
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
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
            </table>
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
  const prevAlignedRef = useRef(new Set());
  const tfs=[tf1,tf2,tf3,tf4];

  const runScan=useCallback(async()=>{
    setScanning(true);setErrors([]);
    const syms=symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    setProg({done:0,total:syms.length});
    const all=[],failed=[];
    for(let i=0;i<syms.length;i++){
      const sym=syms[i];
      try {
        const [r1,r2,r3,r4]=await Promise.all(tfs.map(tf=>analyzeHTOnly(sym,tf)));
        const price=(r1||r2||r3||r4)?.price||"—";
        const isSell=direction==="SELL";
        const htResults=[r1,r2,r3,r4];
        const matchCount=htResults.filter(r=>r&&(isSell?r.trend===1:r.trend===0)).length;
        const totalFetched=htResults.filter(Boolean).length;
        const aligned=totalFetched===4&&matchCount===4;
        const flipCount=htResults.filter(r=>r&&(isSell?r.sellSignal:r.buySignal)).length;
        if(totalFetched===0) continue;
        all.push({symbol:sym,price,r1,r2,r3,r4,aligned,matchCount,totalFetched,flipCount});
      } catch(e){failed.push(sym);}
      setProg({done:i+1,total:syms.length});
    }
    all.sort((a,b)=>b.matchCount-a.matchCount||b.flipCount-a.flipCount);

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
  },[symbols,tf1,tf2,tf3,tf4,direction,pushKey,pushToken,soundOn,onSignal]);

  const nextIn = useAutoRefresh(runScan, autoOn, autoMin);
  const fullyAligned=results.filter(r=>r.aligned).length;

  return(
    <div style={{display:"flex",flex:1,minHeight:0}}>
      <div style={{width:250,minWidth:250,background:"#0a1520",borderRight:"1px solid #1e3a5a",padding:"14px 12px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
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
      </div>
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
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a"}}>
                {["SYMBOL","PRICE",`${tf1.toUpperCase()} BIAS`,`${tf2.toUpperCase()} CONFIRM`,`${tf3.toUpperCase()} ENTRY`,`${tf4.toUpperCase()} FINE`,"MATCH","SIGNAL","TIME"].map(h=>
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
                    {[r.r1,r.r2,r.r3,r.r4].map((ht,j)=><td key={j} style={{padding:"7px 8px"}}><HTBadge result={ht}/></td>)}
                    <td style={{padding:"7px 8px"}}>
                      <span style={{padding:"2px 7px",borderRadius:3,fontSize:10,fontWeight:700,
                        background:r.matchCount===4?(direction==="SELL"?"#3a0505":"#053a05"):"#1a1a05",
                        color:r.matchCount===4?(direction==="SELL"?"#ff1744":"#00e676"):"#ff9800",
                        border:`1px solid ${r.matchCount===4?(direction==="SELL"?"#ff1744":"#00e676"):"#ff9800"}`}}>
                        {r.matchCount}/{r.totalFetched}
                      </span>
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
            </table>
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
    for(let i=0;i<syms.length;i++){
      const sym=syms[i];
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
        if(totalFetched===0) continue;
        all.push({symbol:sym,price,r1,r2,r3,r4,fullyAligned,matchCount,totalFetched,flipCount,shaFlipCount});
      } catch(e){failed.push(sym);}
      setProg({done:i+1,total:syms.length});
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
    <div style={{display:"flex",flex:1,minHeight:0}}>
      <div style={{width:250,minWidth:250,background:"#0a1520",borderRight:"1px solid #1e3a5a",padding:"14px 12px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
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
      </div>
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
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
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
            </table>
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
  const [activeTab,setActiveTab]=useState(()=>{
    try { return localStorage.getItem("alo_tab")||"ema"; } catch(e){ return "ema"; }
  });
  const [pushKey,setPushKey]=useState(()=>{ try{return localStorage.getItem("alo_push_key")||"";}catch(e){return "";} });
  const [pushToken,setPushToken]=useState(()=>{ try{return localStorage.getItem("alo_push_token")||"";}catch(e){return "";} });
  const [soundOn,setSoundOn]=useState(true);
  const [logVersion,setLogVersion]=useState(0);
  const [flashAlert,setFlashAlert]=useState(null);
  const [chartSym,setChartSym]=useState("SPY");

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
    {id:"pnl",label:"🏦 BONDO FUND",color:"#00e676"},
    {id:"chart",label:"📈 CHART",color:"#ff9800"},
  ];

  const scannerProps = {symbols, pushKey, pushToken, soundOn, onSignal:handleSignal, logVersion, goToChart};

  return(
    <div style={{fontFamily:"'Courier New',monospace",background:"#080e1a",minHeight:"100vh",color:"#c9d8e8",display:"flex",flexDirection:"column"}}>
      {/* HEADER */}
      <div style={{background:flashAlert?"linear-gradient(90deg,#1a0a00,#0a1520)":"linear-gradient(90deg,#0d1b2e,#0a1520)",borderBottom:`2px solid ${flashAlert?"#ff9800":"#1e3a5a"}`,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,transition:"all 0.3s"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:flashAlert?"#ff9800":"#00e676",boxShadow:`0 0 ${flashAlert?"16px #ff9800":"8px #00e676"}`,transition:"all 0.3s"}}/>
          <span style={{fontSize:15,fontWeight:700,color:"#e8f4ff",letterSpacing:2}}>ALO TRADING SCANNER</span>
          <span style={{fontSize:10,color:"#ff9800",padding:"2px 8px",border:"1px solid #ff9800",borderRadius:3,fontWeight:700}}>v6.0 ATM</span>
          {flashAlert&&<span style={{fontSize:11,color:"#ff9800",fontWeight:700,animation:"pulse 0.5s infinite"}}>🚨 SIGNAL FIRED!</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,maxWidth:600}}>
          <span style={{fontSize:9,color:"#2a5a7a",letterSpacing:1,whiteSpace:"nowrap"}}>WATCHLIST</span>
          <input value={symbols} onChange={e=>updateSymbols(e.target.value)}
            style={{flex:1,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#8ab4cc",padding:"5px 10px",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a",display:"flex"}}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>updateTab(tab.id)} style={{padding:"10px 18px",fontFamily:"inherit",fontSize:11,fontWeight:700,letterSpacing:1,
            background:activeTab===tab.id?"#0d1e30":"transparent",
            borderBottom:activeTab===tab.id?`2px solid ${tab.color}`:"2px solid transparent",
            color:activeTab===tab.id?tab.color:"#3a6e9a",border:"none",cursor:"pointer",marginBottom:"-2px",whiteSpace:"nowrap"}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* LEFT RAIL — Alert settings + Signal Log (always visible) */}
        {activeTab!=="pnl"&&(
          <div style={{width:0,minWidth:0,display:"none"}}/>
        )}

        {/* SCANNER AREA */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {activeTab==="ema"&&<EMAScanner {...scannerProps}/>}
          {activeTab==="ht"&&<HalfTrendScanner {...scannerProps}/>}
          {activeTab==="shaht"&&<SHAHTScanner {...scannerProps}/>}
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
        </div>

        {/* RIGHT SIDEBAR — Always visible */}
        <div style={{width:220,minWidth:220,background:"#080e1a",borderLeft:"1px solid #1e3a5a",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <AlertSettings
            pushKey={pushKey} setPushKey={setPushKey}
            pushToken={pushToken} setPushToken={setPushToken}
            soundOn={soundOn} setSoundOn={setSoundOn}
            onTest={handleTestPush}
          />
          <SignalLogPanel logVersion={logVersion}/>
        </div>
      </div>

      <style>{`
        tbody tr:hover{background:#0d2233 !important;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:#080e1a;}
        ::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:3px;}
        input[type=range]{height:4px;}
        @keyframes pulse{0%{opacity:1;}50%{opacity:0.4;}100%{opacity:1;}}
      `}</style>
    </div>
  );
}
