import { useState, useEffect, useRef, useCallback } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";

const TIMEFRAMES = [
  { label: "5 MIN",  multiplier: 5,  timespan: "minute", required: true  },
  { label: "2 MIN",  multiplier: 2,  timespan: "minute", required: true  },
  { label: "30 SEC", multiplier: 30, timespan: "second", required: false },
  { label: "15 SEC", multiplier: 15, timespan: "second", required: false },
];

function calcSHA(candles) {
  var smooth = 3;
  if (candles.length < smooth + 2) return [];
  var k = 2 / (smooth + 1);
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

function calcHT(candles) {
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
  var atrVal = trs.slice(0, atrLen).reduce(function(a,b){return a+b;},0) / atrLen;
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

function getSignal(candles) {
  if (!candles || candles.length < 20) return null;
  var sha = calcSHA(candles);
  var ht  = calcHT(candles);
  if (!sha.length || !ht.length) return null;
  var s = sha[sha.length - 1];
  var h = ht[ht.length - 1];
  if (!s || !h) return null;
  if (s.bullish && h.bullish)    return "BUY";
  if (!s.bullish && !h.bullish)  return "SELL";
  return "NEUTRAL";
}

async function loadCandles(symbol, multiplier, timespan) {
  var to   = new Date();
  var from = new Date(to.getTime() - 2 * 60 * 60 * 1000);
  var url = "https://api.polygon.io/v2/aggs/ticker/" + symbol
    + "/range/" + multiplier + "/" + timespan + "/"
    + from.toISOString().split(".")[0] + "Z" + "/"
    + to.toISOString().split(".")[0] + "Z"
    + "?adjusted=true&sort=asc&limit=200&apiKey=" + API_KEY;
  var res  = await fetch(url);
  var data = await res.json();
  if (!data.results) return [];
  return data.results.map(function(r) {
    return { o: r.o, h: r.h, l: r.l, c: r.c, t: r.t };
  });
}

export default function ScalpingTab() {
  var [symbol,      setSymbol]      = useState("SPY");
  var [inputSym,    setInputSym]    = useState("SPY");
  var [candles,     setCandles]     = useState({});
  var [signals,     setSignals]     = useState({});
  var [flash,       setFlash]       = useState(null);
  var [lastUpdate,  setLastUpdate]  = useState(null);
  var [loading,     setLoading]     = useState(false);
  var prevRef   = useRef({});
  var flashRef  = useRef(null);

  var fetchAll = useCallback(async function(sym) {
    setLoading(true);
    try {
      var results = await Promise.all(
        TIMEFRAMES.map(function(tf) {
          return loadCandles(sym, tf.multiplier, tf.timespan);
        })
      );
      var nc = {}, ns = {};
      results.forEach(function(c, i) { nc[i] = c; ns[i] = getSignal(c); });
      setCandles(nc);
      setSignals(ns);
      setLastUpdate(new Date().toLocaleTimeString());

      var s5  = ns[0], s2 = ns[1], s30 = ns[2], s15 = ns[3];
      var longFull  = s5==="BUY"  && s2==="BUY"  && s30==="BUY"  && s15==="BUY";
      var shortFull = s5==="SELL" && s2==="SELL" && s30==="SELL" && s15==="SELL";

      if (longFull  && !prevRef.current.longFull)  doFlash("BUY");
      if (shortFull && !prevRef.current.shortFull) doFlash("SELL");
      if (prevRef.current.longFull  && s15==="SELL") doFlash("SELL");
      if (prevRef.current.shortFull && s15==="BUY")  doFlash("BUY");

      prevRef.current = { longFull: longFull, shortFull: shortFull };
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  function doFlash(type) {
    setFlash(type);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(function() { setFlash(null); }, 3000);
  }

  useEffect(function() {
    fetchAll(symbol);
    var t = setInterval(function() { fetchAll(symbol); }, 10000);
    return function() { clearInterval(t); };
  }, [symbol, fetchAll]);

  var s5  = signals[0], s2 = signals[1], s30 = signals[2], s15 = signals[3];
  var longReady  = s5==="BUY"  && s2==="BUY";
  var shortReady = s5==="SELL" && s2==="SELL";
  var longFull   = longReady  && s30==="BUY"  && s15==="BUY";
  var shortFull  = shortReady && s30==="SELL" && s15==="SELL";
  var exitL = longReady  && s15==="SELL";
  var exitS = shortReady && s15==="BUY";

  var stText =
    exitL      ? "EXIT LONG — 15s SELL" :
    exitS      ? "EXIT SHORT — 15s BUY" :
    longFull   ? "FULL LONG — BUY NOW" :
    shortFull  ? "FULL SHORT — SELL NOW" :
    longReady  ? "5m+2m BULL — WAIT 15s" :
    shortReady ? "5m+2m BEAR — WAIT 15s" :
    "WAITING FOR SETUP";

  var stIcon =
    (exitL||exitS) ? "EXIT" :
    longFull   ? "BUY" :
    shortFull  ? "SELL" :
    longReady  ? "WAIT" :
    shortReady ? "WAIT" : "WAIT";

  var stColor =
    (exitL||exitS) ? "#ff3c3c" :
    longFull   ? "#00e87a" :
    shortFull  ? "#ff3c3c" :
    longReady  ? "#f0c040" :
    shortReady ? "#ff9800" : "#555577";

  return (
    <div style={{minHeight:"100vh",background:"#07070f",fontFamily:"'Courier New',monospace",padding:"20px 16px"}}>
      <style>{`
        @keyframes flashPulse{from{opacity:.7}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      {flash && (
        <div style={{
          position:"fixed",inset:0,zIndex:9999,pointerEvents:"none",
          backgroundColor: flash==="BUY" ? "rgba(0,232,122,.18)" : "rgba(255,60,60,.18)",
          border: "4px solid " + (flash==="BUY" ? "#00e87a" : "#ff3c3c"),
          animation:"flashPulse .4s ease-in-out infinite alternate"
        }}/>
      )}

      <div style={{maxWidth:1100,margin:"0 auto"}}>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:"#00e87a",letterSpacing:4,marginBottom:4}}>ATM MACHINE — SCALP</div>
          <div style={{fontSize:22,fontWeight:700,color:"#e0e0ff",letterSpacing:2}}>MULTI-TF SCANNER</div>
          <div style={{fontSize:10,color:"#333355",marginTop:4}}>SHA + HALFTREND · LONG AND SHORT · 5M/2M/30S/15S</div>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
          <input value={inputSym}
            onChange={function(e){setInputSym(e.target.value.toUpperCase());}}
            onKeyDown={function(e){if(e.key==="Enter"){var s=inputSym.trim().toUpperCase();if(s)setSymbol(s);}}}
            style={{width:130,background:"#0e0e1a",border:"2px solid #2a2a4a",borderRadius:8,
              padding:"9px 14px",color:"#00e87a",fontFamily:"inherit",fontSize:16,fontWeight:700,outline:"none"}}/>
          <button onClick={function(){var s=inputSym.trim().toUpperCase();if(s)setSymbol(s);}}
            style={{background:"#00e87a",border:"none",borderRadius:8,padding:"9px 20px",
              color:"#07070f",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            LOAD
          </button>
          <button onClick={function(){fetchAll(symbol);}}
            style={{background:"transparent",border:"2px solid #2a2a4a",borderRadius:8,
              padding:"9px 16px",color:"#888",fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>
            {loading?"...":"REFRESH"}
          </button>
          <div style={{marginLeft:"auto",fontSize:10,color:"#333355"}}>
            {lastUpdate?"LAST: "+lastUpdate:""}<br/>AUTO 10s
          </div>
        </div>

        <div style={{
          background:"#0e0e1a",border:"2px solid "+stColor,borderRadius:12,
          padding:"13px 18px",marginBottom:18,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          boxShadow:"0 0 24px "+stColor+"33",
          animation:(longFull||shortFull||exitL||exitS)?"pulse 1s infinite":"none"
        }}>
          <div style={{fontSize:15,fontWeight:700,color:stColor,letterSpacing:1}}>
            {stIcon==="BUY"?"🟢":stIcon==="SELL"?"🔴":stIcon==="EXIT"?"⚡":"⏳"} {stText}
          </div>
          <div style={{display:"flex",gap:6}}>
            {[0,1,2,3].map(function(i){
              var sig=signals[i];
              var bc=sig==="BUY"?"#00e87a":sig==="SELL"?"#ff3c3c":"#2a2a3a";
              return(
                <div key={i} style={{width:26,height:26,borderRadius:5,
                  background:sig==="BUY"?"#00e87a22":sig==="SELL"?"#ff3c3c22":"#fff1",
                  border:"2px solid "+bc,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:10,
                  color:sig==="BUY"?"#00e87a":sig==="SELL"?"#ff3c3c":"#444",fontWeight:700}}>
                  {sig==="BUY"?"▲":sig==="SELL"?"▼":"—"}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          {TIMEFRAMES.map(function(tf, i){
            var sig    = signals[i];
            var cands  = candles[i];
            var isBuy  = sig==="BUY";
            var isSell = sig==="SELL";
            var bc     = isBuy?"#00e87a":isSell?"#ff3c3c":"#2a2a3a";
            var sc     = isBuy?"#00e87a":isSell?"#ff4444":"#555577";
            var bg     = isBuy?"linear-gradient(135deg,#0a1f14,#0d2e1a)"
                        :isSell?"linear-gradient(135deg,#1f0a0a,#2e0d0d)"
                        :"linear-gradient(135deg,#0e0e14,#14141e)";

            var shaArr = cands && cands.length>=20 ? calcSHA(cands) : [];
            var htArr  = cands && cands.length>=20 ? calcHT(cands)  : [];
            var shaL   = shaArr.length>0 ? shaArr[shaArr.length-1] : null;
            var htL    = htArr.length >0 ? htArr[htArr.length -1]  : null;

            return (
              <div key={i} style={{
                background:bg,border:"2px solid "+bc,borderRadius:12,
                padding:"16px 14px",flex:1,minWidth:160,
                display:"flex",flexDirection:"column",gap:8,
                boxShadow:(isBuy||isSell)?"0 0 20px "+bc+"44":"none",
                position:"relative",overflow:"hidden"
              }}>
                <div style={{position:"absolute",top:8,right:8,fontSize:9,
                  color:tf.required?"#f0c040":"#444",
                  background:tf.required?"#2a2010":"#111118",
                  border:"1px solid "+(tf.required?"#f0c04066":"#222230"),
                  borderRadius:4,padding:"2px 5px"}}>
                  {tf.required?"REQUIRED":"CONFIRM"}
                </div>
                <div style={{fontSize:20,fontWeight:700,color:"#e0e0ff"}}>{tf.label}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:sc,flexShrink:0}}/>
                  <div style={{fontSize:24,fontWeight:700,color:sc}}>{sig||"—"}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    background:"#fff1",borderRadius:5,padding:"3px 8px"}}>
                    <span style={{fontSize:9,color:"#888"}}>SHA</span>
                    <span style={{fontSize:10,fontWeight:700,
                      color:shaL===null?"#444":shaL.bullish?"#00e87a":"#ff4444"}}>
                      {shaL===null?"—":shaL.bullish?"▲ BULL":"▼ BEAR"}
                    </span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",
                    background:"#fff1",borderRadius:5,padding:"3px 8px"}}>
                    <span style={{fontSize:9,color:"#888"}}>HT</span>
                    <span style={{fontSize:10,fontWeight:700,
                      color:htL===null?"#444":htL.bullish?"#00e87a":"#ff4444"}}>
                      {htL===null?"—":htL.bullish?"▲ BULL":"▼ BEAR"}
                    </span>
                  </div>
                </div>
                <div style={{fontSize:9,color:"#33334a",marginTop:"auto"}}>
                  {cands?cands.length+" candles":"loading..."}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{background:"#0a0a14",border:"1px solid #1a1a2a",
          borderRadius:10,padding:"12px 16px",
          display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {i:"🟢",t:"5m+2m BUY = LONG READY"},
            {i:"🔴",t:"5m+2m SELL = SHORT READY"},
            {i:"⚡",t:"ALL 4 AGREE = ENTER NOW"},
            {i:"🚪",t:"15s SELL flip = EXIT LONG"},
            {i:"🚪",t:"15s BUY flip = EXIT SHORT"},
            {i:"🔄",t:"Next signal = RE-ENTER"},
          ].map(function(r,i){
            return(
              <div key={i} style={{display:"flex",gap:6,fontSize:10,color:"#555577",lineHeight:1.5}}>
                <span>{r.i}</span><span>{r.t}</span>
              </div>
            );
          })}
        </div>

        <div style={{textAlign:"center",marginTop:14,fontSize:10,color:"#222233"}}>
          {symbol} · POLYGON.IO REAL-TIME
        </div>
      </div>
    </div>
  );
}
