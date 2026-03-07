import { useState, useCallback } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";
const BASE_URL = "https://api.polygon.io";

const DEFAULT_SYMBOLS = ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","SOFI","PLTR","MARA","COIN","RIVN","BABA","BAC","JPM","GS","IWM"];

// Parse timeframe string like "30s", "1m", "2m", "1h", "1D", "1W"
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

// ─── FETCH ───────────────────────────────────────────────────────────────────
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

// ─── EMA UTILS ───────────────────────────────────────────────────────────────
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
function slopeToStrength(slope,price){
  if(!price) return 0;
  return Math.min(100,Math.round(Math.abs(slope)/price*10000*80));
}
function getSlopeLabel(s){return s>=80?"EXTREME":s>=60?"STRONG":s>=40?"MODERATE":s>=20?"WEAK":"FLAT";}
function getSlopeColor(s){return s>=80?"#ff1744":s>=60?"#ff5722":s>=40?"#ff9800":s>=20?"#ffeb3b":"#546e7a";}

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

// ─── HALFTREND ENGINE ────────────────────────────────────────────────────────
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

function calcHalfTrend(highs,lows,closes,amplitude=2,channelDeviation=2){
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
    const atr2=atrFull[ai]/2;
    const hb=Math.max(0,i-amplitude+1),lb=Math.max(0,i-amplitude+1);
    const highPrice=highestIn(highs,hb,i);
    const lowPrice=lowestIn(lows,lb,i);
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
      if(prev!==0) up=down;
      else up=Math.max(maxLowPrice,up||maxLowPrice);
    } else {
      const prev=trends.length>0?trends[trends.length-1]:1;
      if(prev!==1) down=up;
      else down=Math.min(minHighPrice,down||minHighPrice);
    }
    trends.push(trend);
  }
  const cur=trends[trends.length-1];
  const prev=trends.length>1?trends[trends.length-2]:cur;
  return {
    trend:cur,
    sellSignal:cur===1&&prev===0,
    buySignal:cur===0&&prev===1,
    direction:cur===0?"BULL":"BEAR",
  };
}

async function analyzeHT(symbol,tf){
  const c=await fetchCandles(symbol,tf);
  if(!c||c.closes.length<120) return null;
  const ht=calcHalfTrend(c.highs,c.lows,c.closes);
  if(!ht) return null;
  return {...ht,price:c.closes[c.closes.length-1].toFixed(2)};
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
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
    <input
      value={value}
      onChange={e=>onChange(e.target.value)}
      placeholder="e.g. 5m"
      style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#00b4d8",padding:"6px 4px",fontSize:13,fontFamily:"inherit",fontWeight:700,outline:"none",boxSizing:"border-box",textAlign:"center"}}
    />
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

// ─── EMA SCANNER COMPONENT ───────────────────────────────────────────────────
function EMAScanner({symbols}){
  const [ema1,setEma1]=useState(50),[ema2,setEma2]=useState(100),[ema3,setEma3]=useState(200);
  const [tf,setTf]=useState("1h"),[maxSpread,setMaxSpread]=useState(1.5);
  const [minSlope,setMinSlope]=useState(0),[filterMode,setFilterMode]=useState("ALL");
  const [results,setResults]=useState([]),[scanning,setScanning]=useState(false);
  const [sortBy,setSortBy]=useState("score"),[selRow,setSelRow]=useState(null);
  const [lastScan,setLastScan]=useState(null),[prog,setProg]=useState({done:0,total:0});
  const [errors,setErrors]=useState([]);

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
    setResults(filtered);setErrors(failed);setScanning(false);setLastScan(new Date().toLocaleTimeString());
  },[ema1,ema2,ema3,tf,maxSpread,filterMode,symbols,sortBy,minSlope]);

  const sel=selRow!==null?results[selRow]:null;

  return(
    <div style={{display:"flex",flex:1,minHeight:0}}>
      {/* Sidebar */}
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
          <div style={{fontSize:9,color:"#2a4a6a",marginTop:5}}>15s · 30s · 1m · 2m · 3m · 5m · 15m · 30m · 1h · 4h · 1D</div>
        </Section>

        <Section title="MIN SLOPE STRENGTH">
          <span style={{fontSize:10,color:"#3a6e9a"}}>Min: <span style={{color:getSlopeColor(minSlope),fontWeight:700}}>{minSlope}% — {getSlopeLabel(minSlope)}</span></span>
          <input type="range" min={0} max={90} step={5} value={minSlope} onChange={e=>setMinSlope(Number(e.target.value))}
            style={{width:"100%",accentColor:getSlopeColor(minSlope),cursor:"pointer",marginTop:5}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#2a4a6a"}}>
            <span>ANY</span><span>WEAK</span><span>MOD</span><span>STR</span><span>XTR</span>
          </div>
        </Section>

        <Section title="FILTER">
          {["ALL","BEARISH","BULLISH","COMPRESSED","SWING SIGNAL"].map(m=>(
            <button key={m} onClick={()=>setFilterMode(m)} style={{width:"100%",padding:"5px",marginBottom:4,
              background:filterMode===m?(m==="BEARISH"?"#2a0a0a":m==="BULLISH"?"#0a2a0a":m==="SWING SIGNAL"?"#1a0a2a":"#0d2a3a"):"#0d1b2e",
              border:`1px solid ${filterMode===m?(m==="BEARISH"?"#ff1744":m==="BULLISH"?"#00e676":m==="SWING SIGNAL"?"#e040fb":"#00b4d8"):"#1e3a5a"}`,
              color:filterMode===m?(m==="BEARISH"?"#ff1744":m==="BULLISH"?"#00e676":m==="SWING SIGNAL"?"#e040fb":"#00b4d8"):"#3a6e9a",
              borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700}}>{m}</button>
          ))}
          {filterMode==="COMPRESSED"&&<div style={{marginTop:5}}>
            <div style={{fontSize:10,color:"#3a6e9a",marginBottom:3}}>MAX SPREAD %</div>
            <input type="number" step={0.1} min={0.1} max={10} value={maxSpread} onChange={e=>setMaxSpread(Number(e.target.value))}
              style={{width:"100%",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#00b4d8",padding:"5px 8px",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          </div>}
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

      {/* Table area */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"7px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <Stat label="TOTAL" value={results.length}/>
          <Stat label="BEARISH" value={results.filter(r=>r.allSlopingDown).length} color="#ff1744"/>
          <Stat label="BULLISH" value={results.filter(r=>r.allSlopingUp).length} color="#00e676"/>
          <Stat label="COMPRESSED" value={results.filter(r=>r.compressed).length} color="#ff9800"/>
          <Stat label="SWING★" value={results.filter(r=>r.swingSignal).length} color="#e040fb"/>
          <Stat label="TF" value={tf.toUpperCase()} color="#00b4d8"/>
          {lastScan&&<Stat label="SCANNED" value={lastScan} color="#3a6e9a"/>}
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {results.length===0&&!scanning&&<div style={{padding:40,textAlign:"center",color:"#2a5a7a",fontSize:13}}>
            {lastScan?"No results matched filter.":"Press ▶ RUN EMA SCAN"}
          </div>}
          {results.length>0&&(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a"}}>
                {["SYMBOL","PRICE","EMA1","EMA2","EMA3","SPREAD%","SLOPE","STRENGTH","BOUNCE","REJECT","SWING★","TREND","SCORE"].map(h=>
                  <th key={h} style={{padding:"7px 7px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {results.map((r,i)=>{
                  const isSel=selRow===i;
                  const bg=isSel?"#0d2a3e":r.swingSignal?"#1a0a1a":r.allSlopingDown&&r.compressed?"#1a0a0a":r.allSlopingUp&&r.compressed?"#0a1a0a":i%2===0?"#080e1a":"#0a1218";
                  return <tr key={r.symbol} onClick={()=>setSelRow(isSel?null:i)} style={{background:bg,borderBottom:"1px solid #0f1e2e",cursor:"pointer"}}>
                    <td style={{padding:"6px 7px",fontWeight:700,color:"#e8f4ff",fontSize:12}}>{r.symbol}</td>
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
                    <span style={{fontSize:10,color:"#3a6e9a"}}>{l}</span>
                    <span style={{fontSize:10,color:"#00b4d8",fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div><div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700}}>SLOPE STRENGTH</div>
                {[["EMA1",sel.strength1],["EMA2",sel.strength2],["EMA3",sel.strength3]].map(([l,s])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:10,color:"#3a6e9a",minWidth:40}}>{l}</span><StrengthBar strength={s}/>
                  </div>
                ))}
              </div>
              <div><div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700}}>SIGNALS</div>
                {[["Bounce?",sel.bounceDetected?`YES +${sel.bounceUp}%`:"No",sel.bounceDetected?"#ffeb3b":"#3a6e9a"],
                  ["Red Reject?",sel.redRejection?"YES":"No",sel.redRejection?"#ff1744":"#3a6e9a"],
                  ["Swing★?",sel.swingSignal?"★ SELL SETUP!":"No",sel.swingSignal?"#e040fb":"#3a6e9a"]
                ].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:3}}>
                    <span style={{fontSize:10,color:"#3a6e9a"}}>{l}</span>
                    <span style={{fontSize:10,color:c,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700}}>SCORE</div>
                <ScoreBar score={sel.score}/>
                {sel.swingSignal&&<div style={{padding:"5px 8px",background:"#1a0028",border:"1px solid #e040fb",borderRadius:4,fontSize:10,color:"#e040fb",fontWeight:700}}>★ SWING SELL SETUP</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HALFTREND MTF SCANNER ───────────────────────────────────────────────────
function HalfTrendScanner({symbols}){
  // 4 custom timeframe inputs
  const [tf1,setTf1]=useState("1h");
  const [tf2,setTf2]=useState("15m");
  const [tf3,setTf3]=useState("5m");
  const [tf4,setTf4]=useState("1m");
  const [direction,setDirection]=useState("SELL");
  const [results,setResults]=useState([]),[scanning,setScanning]=useState(false);
  const [lastScan,setLastScan]=useState(null),[prog,setProg]=useState({done:0,total:0});
  const [errors,setErrors]=useState([]);

  const tfs=[tf1,tf2,tf3,tf4];

  const runScan=useCallback(async()=>{
    setScanning(true);setErrors([]);
    const syms=symbols.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    setProg({done:0,total:syms.length});
    const all=[],failed=[];
    for(let i=0;i<syms.length;i++){
      const sym=syms[i];
      try {
        // Fetch all 4 timeframes in parallel
        const [r1,r2,r3,r4]=await Promise.all(tfs.map(tf=>analyzeHT(sym,tf)));
        const price=(r1||r2||r3||r4)?.price||"—";

        // Check alignment: all non-null TFs match direction
        const htResults=[r1,r2,r3,r4];
        const isSell = direction==="SELL";
        const aligned = htResults.filter(Boolean).every(r=> isSell ? r.trend===1 : r.trend===0);
        const matchCount = htResults.filter(r=>r && (isSell ? r.trend===1 : r.trend===0)).length;
        const totalFetched = htResults.filter(Boolean).length;
        const flipCount = htResults.filter(r=>r && (isSell ? r.sellSignal : r.buySignal)).length;

        all.push({symbol:sym,price,r1,r2,r3,r4,aligned,matchCount,totalFetched,flipCount});
      } catch(e){ failed.push(sym); }
      setProg({done:i+1,total:syms.length});
    }
    // Sort: fully aligned first, then by matchCount
    all.sort((a,b)=>b.matchCount-a.matchCount||b.flipCount-a.flipCount);
    setResults(all);setErrors(failed);setScanning(false);setLastScan(new Date().toLocaleTimeString());
  },[symbols,tf1,tf2,tf3,tf4,direction]);

  const fullyAligned=results.filter(r=>r.aligned).length;
  const partial=results.filter(r=>!r.aligned&&r.matchCount>0).length;

  return(
    <div style={{display:"flex",flex:1,minHeight:0}}>
      {/* Sidebar */}
      <div style={{width:250,minWidth:250,background:"#0a1520",borderRight:"1px solid #1e3a5a",padding:"14px 12px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>

        <Section title="4 TIMEFRAMES (type any)">
          <div style={{display:"flex",gap:8,marginBottom:6}}>
            <TFInput label="TF 1 (Bias)" value={tf1} onChange={setTf1}/>
            <TFInput label="TF 2 (Confirm)" value={tf2} onChange={setTf2}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <TFInput label="TF 3 (Entry)" value={tf3} onChange={setTf3}/>
            <TFInput label="TF 4 (Fine)" value={tf4} onChange={setTf4}/>
          </div>
          <div style={{fontSize:9,color:"#2a4a6a",marginTop:8,lineHeight:1.6}}>
            Type any timeframe: 15s · 30s · 1m · 2m · 3m · 5m · 15m · 30m · 1h · 4h · 1D
          </div>
          <div style={{marginTop:8,padding:"8px",background:"#0d1b2e",borderRadius:4,border:"1px solid #1e3a5a"}}>
            <div style={{fontSize:9,color:"#2a5a7a",marginBottom:5,fontWeight:700,letterSpacing:1}}>QUICK PRESETS</div>
            {[
              ["SWING","1h","15m","5m","1m"],
              ["SCALP","5m","2m","30s","15s"],
              ["DAY","4h","1h","15m","5m"],
            ].map(([label,a,b,c,d])=>(
              <button key={label} onClick={()=>{setTf1(a);setTf2(b);setTf3(c);setTf4(d);}}
                style={{width:"100%",padding:"4px",marginBottom:4,background:"#0d1b2e",border:"1px solid #1e3a5a",color:"#3a6e9a",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700}}>
                {label}: {a} / {b} / {c} / {d}
              </button>
            ))}
          </div>
        </Section>

        <Section title="SCAN DIRECTION">
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setDirection("SELL")} style={{flex:1,padding:"8px",
              background:direction==="SELL"?"#2a0a0a":"#0d1b2e",
              border:`1px solid ${direction==="SELL"?"#ff1744":"#1e3a5a"}`,
              color:direction==="SELL"?"#ff1744":"#3a6e9a",
              borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>
              ▼ SELL
            </button>
            <button onClick={()=>setDirection("BUY")} style={{flex:1,padding:"8px",
              background:direction==="BUY"?"#0a2a0a":"#0d1b2e",
              border:`1px solid ${direction==="BUY"?"#00e676":"#1e3a5a"}`,
              color:direction==="BUY"?"#00e676":"#3a6e9a",
              borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>
              ▲ BUY
            </button>
          </div>
          <div style={{fontSize:9,color:"#2a4a6a",marginTop:6,lineHeight:1.6}}>
            SELL = HalfTrend RED on all TFs<br/>BUY = HalfTrend BLUE on all TFs
          </div>
        </Section>

        <div style={{padding:"10px",background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:6}}>
          <div style={{fontSize:9,color:"#2a5a7a",marginBottom:6,fontWeight:700,letterSpacing:1}}>HOW IT WORKS</div>
          <div style={{fontSize:10,color:"#3a6e9a",lineHeight:1.7}}>
            Scans all stocks for HalfTrend direction on each of your 4 timeframes.<br/><br/>
            <span style={{color:"#e040fb",fontWeight:700}}>★ FULL ALIGN</span> = all 4 TFs agree<br/>
            <span style={{color:"#ff9800",fontWeight:700}}>3/4</span> = strong setup<br/>
            <span style={{color:"#ffeb3b",fontWeight:700}}>FLIP</span> = just crossed signal
          </div>
        </div>

        <button onClick={runScan} disabled={scanning} style={{width:"100%",padding:"10px",
          background:scanning?"#0d1b2e":`linear-gradient(135deg,${direction==="SELL"?"#3b0d0d,#550a0a":"#0d3b0d,#0a550a"})`,
          border:`1px solid ${scanning?"#1e3a5a":direction==="SELL"?"#ff1744":"#00e676"}`,
          color:scanning?"#3a6e9a":direction==="SELL"?"#ff6b6b":"#69f0ae",
          borderRadius:6,cursor:scanning?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700,letterSpacing:2}}>
          {scanning?`SCANNING ${prog.done}/${prog.total}...`:`▶ SCAN ${direction} SIGNALS`}
        </button>
        {errors.length>0&&<div style={{fontSize:10,color:"#ff5722"}}>Failed: {errors.join(", ")}</div>}
      </div>

      {/* Results table */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{background:"#0a1520",borderBottom:"1px solid #1e3a5a",padding:"7px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <Stat label="TOTAL" value={results.length}/>
          <Stat label="FULL ALIGN ★" value={fullyAligned} color={direction==="SELL"?"#ff1744":"#00e676"}/>
          <Stat label="PARTIAL" value={partial} color="#ff9800"/>
          <Stat label="DIRECTION" value={direction} color={direction==="SELL"?"#ff1744":"#00e676"}/>
          {lastScan&&<Stat label="SCANNED" value={lastScan} color="#3a6e9a"/>}
        </div>

        <div style={{overflowY:"auto",flex:1}}>
          {results.length===0&&!scanning&&<div style={{padding:40,textAlign:"center",color:"#2a5a7a",fontSize:13}}>
            Press ▶ SCAN to find HalfTrend signals
          </div>}
          {results.length>0&&(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a"}}>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1}}>SYMBOL</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1}}>PRICE</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{tf1.toUpperCase()} (BIAS)</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{tf2.toUpperCase()} (CONFIRM)</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{tf3.toUpperCase()} (ENTRY)</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{tf4.toUpperCase()} (FINE)</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1}}>MATCH</th>
                <th style={{padding:"7px 10px",textAlign:"left",color:"#2a6e9a",fontSize:9,fontWeight:700,letterSpacing:1}}>SIGNAL</th>
              </tr></thead>
              <tbody>
                {results.map((r,i)=>{
                  const bg=r.aligned?(direction==="SELL"?"#1a0505":"#051a05"):r.matchCount>=3?"#110a05":i%2===0?"#080e1a":"#0a1218";
                  const htArr=[r.r1,r.r2,r.r3,r.r4];
                  return <tr key={r.symbol} style={{background:bg,borderBottom:"1px solid #0f1e2e"}}>
                    <td style={{padding:"7px 10px",fontWeight:700,color:"#e8f4ff",fontSize:13}}>{r.symbol}</td>
                    <td style={{padding:"7px 10px",color:"#c9d8e8"}}>{r.price}</td>
                    {htArr.map((ht,j)=><td key={j} style={{padding:"7px 8px"}}><HTBadge result={ht}/></td>)}
                    <td style={{padding:"7px 10px"}}>
                      <span style={{padding:"2px 7px",borderRadius:3,fontSize:10,fontWeight:700,
                        background:r.matchCount===4?(direction==="SELL"?"#3a0505":"#053a05"):"#1a1a05",
                        color:r.matchCount===4?(direction==="SELL"?"#ff1744":"#00e676"):"#ff9800",
                        border:`1px solid ${r.matchCount===4?(direction==="SELL"?"#ff1744":"#00e676"):"#ff9800"}`}}>
                        {r.matchCount}/{r.totalFetched}
                      </span>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      {r.aligned?(
                        <span style={{padding:"3px 8px",borderRadius:3,fontSize:10,fontWeight:700,
                          background:direction==="SELL"?"#2a0028":"#002a10",
                          color:direction==="SELL"?"#e040fb":"#00e676",
                          border:`1px solid ${direction==="SELL"?"#e040fb":"#00e676"}`}}>
                          ★ {direction} ALL 4
                        </span>
                      ):r.flipCount>0?(
                        <span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:"#1a1400",color:"#ffeb3b",border:"1px solid #ffeb3b"}}>
                          ↻ {r.flipCount} FLIP
                        </span>
                      ):<span style={{color:"#2a4a6a",fontSize:10}}>—</span>}
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

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App(){
  const [symbols,setSymbols]=useState(DEFAULT_SYMBOLS.join(","));
  const [activeTab,setActiveTab]=useState("ema");

  return(
    <div style={{fontFamily:"'Courier New',monospace",background:"#080e1a",minHeight:"100vh",color:"#c9d8e8",display:"flex",flexDirection:"column"}}>
      {/* TOP HEADER */}
      <div style={{background:"linear-gradient(90deg,#0d1b2e,#0a1520)",borderBottom:"1px solid #1e3a5a",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#00e676",boxShadow:"0 0 8px #00e676"}}/>
          <span style={{fontSize:16,fontWeight:700,color:"#e8f4ff",letterSpacing:2}}>EMA + HALFTREND SCANNER</span>
          <span style={{fontSize:10,color:"#00b4d8",padding:"2px 8px",border:"1px solid #1e3a5a",borderRadius:3}}>v4.0</span>
        </div>
        {/* Watchlist */}
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,maxWidth:600}}>
          <span style={{fontSize:9,color:"#2a5a7a",letterSpacing:1,whiteSpace:"nowrap"}}>WATCHLIST</span>
          <input value={symbols} onChange={e=>setSymbols(e.target.value)}
            style={{flex:1,background:"#0d1b2e",border:"1px solid #1e3a5a",borderRadius:4,color:"#8ab4cc",padding:"5px 10px",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"#0a1520",borderBottom:"2px solid #1e3a5a",display:"flex"}}>
        <button onClick={()=>setActiveTab("ema")} style={{padding:"10px 24px",fontFamily:"inherit",fontSize:12,fontWeight:700,letterSpacing:1,
          background:activeTab==="ema"?"#0d2a3e":"transparent",
          borderBottom:activeTab==="ema"?"2px solid #00b4d8":"2px solid transparent",
          color:activeTab==="ema"?"#00b4d8":"#3a6e9a",border:"none",cursor:"pointer",marginBottom:"-2px"}}>
          📊 EMA COMPRESSION
        </button>
        <button onClick={()=>setActiveTab("ht")} style={{padding:"10px 24px",fontFamily:"inherit",fontSize:12,fontWeight:700,letterSpacing:1,
          background:activeTab==="ht"?"#1a0a1a":"transparent",
          borderBottom:activeTab==="ht"?"2px solid #e040fb":"2px solid transparent",
          color:activeTab==="ht"?"#e040fb":"#3a6e9a",border:"none",cursor:"pointer",marginBottom:"-2px"}}>
          ★ HALFTREND MTF
        </button>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {activeTab==="ema"&&<EMAScanner symbols={symbols}/>}
        {activeTab==="ht"&&<HalfTrendScanner symbols={symbols}/>}
      </div>

      <style>{`
        tbody tr:hover{background:#0d2233 !important;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:#080e1a;}
        ::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:3px;}
        input[type=range]{height:4px;}
      `}</style>
    </div>
  );
}
