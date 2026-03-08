// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © Electrified (electrifiedtrading)

//@version=5
indicator("MTF Screener Heikin and .. Trend", overlay = true)


amplitude = input(title='Amplitude', defval=2)
channelDeviation = input(title='Channel Deviation', defval=2)
showArrows = input(title='Show Arrows', defval=true)
showChannels = input(title='Show Channels', defval=true)

var int trend = 0
var int nextTrend = 0
var float maxLowPrice = nz(low[1], low)
var float minHighPrice = nz(high[1], high)

var float up = 0.0
var float down = 0.0
float atrHigh = 0.0
float atrLow = 0.0
float arrowUp = na
float arrowDown = na

atr2 = ta.atr(100) / 2
dev = channelDeviation * atr2

highPrice = high[math.abs(ta.highestbars(amplitude))]
lowPrice = low[math.abs(ta.lowestbars(amplitude))]
highma = ta.sma(high, amplitude)
lowma = ta.sma(low, amplitude)

if nextTrend == 1
    maxLowPrice := math.max(lowPrice, maxLowPrice)

    if highma < maxLowPrice and close < nz(low[1], low)
        trend := 1
        nextTrend := 0
        minHighPrice := highPrice
        minHighPrice
else
    minHighPrice := math.min(highPrice, minHighPrice)

    if lowma > minHighPrice and close > nz(high[1], high)
        trend := 0
        nextTrend := 1
        maxLowPrice := lowPrice
        maxLowPrice

if trend == 0
    if not na(trend[1]) and trend[1] != 0
        up := na(down[1]) ? down : down[1]
        arrowUp := up - atr2
        arrowUp
    else
        up := na(up[1]) ? maxLowPrice : math.max(maxLowPrice, up[1])
        up
    atrHigh := up + dev
    atrLow := up - dev
    atrLow
else
    if not na(trend[1]) and trend[1] != 1
        down := na(up[1]) ? up : up[1]
        arrowDown := down + atr2
        arrowDown
    else
        down := na(down[1]) ? minHighPrice : math.min(minHighPrice, down[1])
        down
    atrHigh := down + dev
    atrLow := down - dev
    atrLow

ht = trend == 0 ? up : down

var color buyColor = color.blue
var color sellColor = color.red

htColor = trend == 0 ? buyColor : sellColor

////////////////////////////////////////////////////////////////////////////////////////
g_TimeframeSettings = 'Display & Timeframe Settings'
time_frame = input.timeframe(title='Timeframe for HA candle calculation', defval='', group=g_TimeframeSettings)
colorBullish = input.color(title='Color for bullish candle (Close > Open)', defval=color.rgb(255, 255, 255, 0))
colorBearish = input.color(title='Color for bearish candle (Close < Open)', defval=color.rgb(255, 0, 255, 0))
showWicks = input.bool(title="Show Wicks", defval=true, group=g_TimeframeSettings)

g_SmoothedHASettings = 'Smoothed HA Settings'
smoothedHALength = input.int(title='HA Price Input Smoothing Length', minval=1, maxval=500, step=1, defval=10, group=g_SmoothedHASettings)
smoothedMAType = input.string(title='Moving Average Calculation', group=g_SmoothedHASettings, 
 options=['Exponential', 'Simple', 'Smoothed', 'Weighted', 'Linear', 'Hull', 'Arnaud Legoux'], defval='Exponential')
smoothedHAalmaSigma = input.float(title="ALMA Sigma", defval=6, minval=0, maxval=100, step=0.1, group=g_SmoothedHASettings)
smoothedHAalmaOffset = input.float(title="ALMA Offset", defval=0.85, minval=0, maxval=1, step=0.01, group=g_SmoothedHASettings)

// Inputs group 3 - Double-smooth settings
g_DoubleSmoothingSettings = 'Double-smoothed HA Settings'
doDoubleSmoothing = input.bool(title='Enable double-smoothing', defval=true, group=g_DoubleSmoothingSettings)
doubleSmoothedHALength = input.int(title='HA Second Smoothing Length', minval=1, maxval=500, step=1, defval=10, group=g_DoubleSmoothingSettings)
doubleSmoothedMAType = input.string(title='Double-Smoothing Moving Average Calculation', group=g_DoubleSmoothingSettings, 
 options=['Exponential', 'Simple', 'Smoothed', 'Weighted', 'Linear', 'Hull', 'Arnaud Legoux'], defval='Exponential')
doubleSmoothedHAalmaSigma = input.float(title="ALMA Sigma", defval=6, minval=0, maxval=100, step=0.1, group=g_DoubleSmoothingSettings)
doubleSmoothedHAalmaOffset = input.float(title="ALMA Offset", defval=0.85, minval=0, maxval=1, step=0.01, group=g_DoubleSmoothingSettings)
                 
smoothedMovingAvg(src, len) => 
	smma = 0.0
	smma := na(smma[1]) ? ta.sma(src, len) : (smma[1] * (len - 1) + src) / len 
	smma

getHAOpen(prevOpen, prevClose) =>
    haOpen = 0.0
    haOpen := ((prevOpen + prevClose)/2)
    haOpen

getHAHigh(o, h, c) =>
    haHigh = 0.0
    haHigh := math.max(h, o, c)
    haHigh

getHALow(o, l, c) =>
    haLow = 0.0
    haLow := math.min(o, l, c)
    haLow

getHAClose(o, h, l, c) =>
    haClose = 0.0
    haClose := ((o + h + l + c)/4)
    haClose
	
getMAValue(src, len, type, isDoubleSmooth) =>
	maValue = 0.0
	if (type == 'Exponential')
		maValue := ta.ema(source=src, length=len)
	else if (type == 'Simple')
		maValue := ta.sma(source=src, length=len)
	else if (type == 'Smoothed')
		maValue := smoothedMovingAvg(src=src, len=len)
	else if (type == 'Weighted')
		maValue := ta.wma(source=src, length=len)
	else if (type == 'Linear')
		maValue := ta.linreg(source=src, length=len, offset=0)
	else if (type == 'Hull')
		maValue := ta.hma(source=src, length=len)
	else if (type == 'Arnaud Legoux')
		maValue := ta.alma(series=src, length=len, offset=(isDoubleSmooth ? doubleSmoothedHAalmaOffset : smoothedHAalmaOffset), sigma=(isDoubleSmooth ? doubleSmoothedHAalmaSigma : smoothedHAalmaSigma))
	else 
		maValue := na
	maValue
realPriceTicker = ticker.new(prefix=syminfo.prefix, ticker=syminfo.ticker)


actualOpen = request.security(symbol=realPriceTicker, timeframe=time_frame, expression=open, gaps=barmerge.gaps_off, lookahead=barmerge.lookahead_off)
actualHigh = request.security(symbol=realPriceTicker, timeframe=time_frame, expression=high, gaps=barmerge.gaps_off, lookahead=barmerge.lookahead_off)
actualLow = request.security(symbol=realPriceTicker, timeframe=time_frame, expression=low, gaps=barmerge.gaps_off, lookahead=barmerge.lookahead_off)
actualClose = request.security(symbol=realPriceTicker, timeframe=time_frame, expression=close, gaps=barmerge.gaps_off, lookahead=barmerge.lookahead_off)

// Get the MA values from actual price
smoothedMA1open = getMAValue(actualOpen, smoothedHALength, smoothedMAType, false) 
smoothedMA1high = getMAValue(actualHigh, smoothedHALength, smoothedMAType, false) 
smoothedMA1low = getMAValue(actualLow, smoothedHALength, smoothedMAType, false) 
smoothedMA1close = getMAValue(actualClose, smoothedHALength, smoothedMAType, false)

smoothedHAClose = getHAClose(smoothedMA1open, smoothedMA1high, smoothedMA1low, smoothedMA1close)

smoothedHAOpen = smoothedMA1open
smoothedHAOpen := na(smoothedHAOpen[1]) ? smoothedMA1open : getHAOpen(smoothedHAOpen[1], smoothedHAClose[1])

smoothedHAHigh = getHAHigh(smoothedHAOpen, smoothedMA1high, smoothedHAClose)

smoothedHALow =  getHALow(smoothedHAOpen, smoothedMA1low, smoothedHAClose)


openToPlot = smoothedHAOpen
closeToPlot = smoothedHAClose
highToPlot = smoothedHAHigh
lowToPlot = smoothedHALow

if (doDoubleSmoothing)
    openToPlot := getMAValue(smoothedHAOpen, doubleSmoothedHALength, doubleSmoothedMAType, true)
    closeToPlot := getMAValue(smoothedHAClose, doubleSmoothedHALength, doubleSmoothedMAType, true)
    highToPlot := getMAValue(smoothedHAHigh, doubleSmoothedHALength, doubleSmoothedMAType, true)
    lowToPlot := getMAValue(smoothedHALow, doubleSmoothedHALength, doubleSmoothedMAType, true)

else
    na


candleColor = color.rgb(0, 0, 0, 100)
candleColor := (closeToPlot > openToPlot) ? colorBullish : 
     (closeToPlot < openToPlot) ? colorBearish : candleColor[1]

tf1 = input.timeframe("15", "TF 1", group = "========== Timeframe ==========")
tf2 = input.timeframe("30", "TF 2", group = "========== Timeframe ==========")
tf3 = input.timeframe("D", "TF 3", group = "========== Timeframe ==========")
tf4 = input.timeframe("1W", "TF 4", group = "========== Timeframe ==========")
tf5 = input.timeframe("2W", "TF 5", group = "========== Timeframe ==========")

tableTheme = "========= Table Theme ========="
frameColor = input.color(#0044ff, "Frame", group = tableTheme, inline = "table")
borderColor = input.color(color.rgb(0, 0, 0), "Border", group = tableTheme, inline = "table")
textColor = input.color(color.rgb(0, 0, 0), "Text", group = tableTheme, inline = "table")
cellColor = input.color(color.rgb(255, 255, 255), "Defaul Cell", group = tableTheme, inline = "candle")
bullColor = input.color(color.green, "Bullish", group = tableTheme, inline = "candle")
bearColor = input.color(color.red, "Bearish", group = tableTheme, inline = "candle")


textSize = switch input.string("Auto", "Size", options = ['Auto', 'Tiny', 'Small', 'Normal', 'Large', 'Huge'], group = tableTheme)
    "Auto" => size.auto
    "Tiny" => size.tiny
    "Small" => size.small
    "Normal" => size.normal
    "Large" => size.large
    "Huge" => size.huge

location = switch input.string("Bottom Right", "Location", 
 options = ['Top Right', 'Top Center', 'Top Left', 'Middle Right', 'Middle Center', 'Middle Left', 'Bottom Right', 'Bottom Center', 'Bottom Left'], group = tableTheme)
    "Top Right" => position.top_right
    "Top Center" => position.top_center
    "Top Left" => position.top_left
    "Middle Right" => position.middle_right
    "Middle Center" => position.middle_center
    "Middle Left" => position.middle_left
    "Bottom Right" => position.bottom_right
    "Bottom Center" => position.bottom_center
    "Bottom Left" => position.bottom_left

gticker = '=============== Watchlist ==============='
symbol1 = input.symbol(defval = "BINANCE:BTCUSDT", title="Symbol1", group=gticker)
symbol2 = input.symbol(defval = "BINANCE:XRPUSDT", title="Symbol2", group=gticker)
symbol3 = input.symbol(defval = "BINANCE:DOGEUSDT", title="Symbol3", group=gticker)
symbol4 = input.symbol(defval = "BINANCE:BNBUSDT", title="Symbol4", group=gticker)
symbol5 = input.symbol(defval = "BINANCE:ETHUSDT", title="Symbol5", group=gticker)
symbol6 = input.symbol(defval = "BINANCE:ADAUSDT", title="Symbol6", group=gticker)
symbol7 = input.symbol(defval = "BINANCE:ZILUSDT", title="Symbol7", group=gticker)
symbol8 = input.symbol(defval = "BINANCE:CHRUSDT", title="Symbol8", group=gticker)

/////////////////////////// UDF to get signal ///////////////////////

getSignal(sym, tf)=>
    [algo1_signal, algo1_color, algo2_signal, algo2_color, Close] = request.security(sym, tf, [candleColor == colorBullish ? "UP": "DOWN", candleColor == colorBullish ? bullColor: bearColor, trend == 0 ? "UP" : "DOWN", trend == 0 ? bullColor : bearColor, close])

///////////////////////////////////

getTF(tf)=>
    if str.endswith(tf, "D") or str.endswith(tf, "D") or str.endswith(tf, "W") or str.endswith(tf, "M") or str.endswith(tf, "S")
        tf
    else
        num = str.tonumber(tf)
        if num % 60 == 0
            str.tostring(num / 60) + "H"
        else
            str.tostring(num) + "m"

createDashboardCell(row, col, algo, tf, tableID) =>
    tableID.cell(row, col, text = algo, bgcolor = frameColor, text_size = textSize, text_color = textColor)
    tableID.merge_cells(row, col, row + 4, col)
    for i = 0 to 4
        tableID.cell(row + i, col + 1, text = getTF(tf.get(i)), bgcolor = frameColor, text_size = textSize, text_color = textColor)



timeframes = array.from(tf1, tf2, tf3, tf4, tf5)

getSym(sym)=>
    str.tostring(array.get(str.split(sym, ":"), 1))

addRow(sym, row, tableID)=>
    // TF 1
    [algo1_signal_tf1, algo1_color_tf1, algo2_signal_tf1, algo2_color_tf1, CLOSE_tf1] = getSignal(sym, tf1)

    // TF 2
    [algo1_signal_tf2, algo1_color_tf2, algo2_signal_tf2, algo2_color_tf2, CLOSE_tf2] = getSignal(sym, tf2)

    // TF 3
    [algo1_signal_tf3, algo1_color_tf3, algo2_signal_tf3, algo2_color_tf3, CLOSE_tf3] = getSignal(sym, tf3)

    // TF 4
    [algo1_signal_tf4, algo1_color_tf4, algo2_signal_tf4, algo2_color_tf4, CLOSE_tf4] = getSignal(sym, tf4)

    // TF 5
    [algo1_signal_tf5, algo1_color_tf5, algo2_signal_tf5, algo2_color_tf5, CLOSE_tf5] = getSignal(sym, tf5)

    signal = algo1_signal_tf1 == "UP" and algo2_signal_tf1 == "UP" and
     algo1_signal_tf2 == "UP" and algo2_signal_tf2 == "UP" and
     algo1_signal_tf3 == "UP" and algo2_signal_tf3 == "UP" and
     algo1_signal_tf4 == "UP" and algo2_signal_tf4 == "UP" and
     algo1_signal_tf5 == "UP" and algo2_signal_tf5 == "UP" ? "BUY" : 
     algo1_signal_tf1 == "DOWN" and algo2_signal_tf1 == "DOWN" and
     algo1_signal_tf2 == "DOWN" and algo2_signal_tf2 == "DOWN" and
     algo1_signal_tf3 == "DOWN" and algo2_signal_tf3 == "DOWN" and
     algo1_signal_tf4 == "DOWN" and algo2_signal_tf4 == "DOWN" and
     algo1_signal_tf5 == "DOWN" and algo2_signal_tf5 == "DOWN" ? "SELL" : "No Signal"
    signalColor = signal == "BUY" ? bullColor : signal == "SELL" ? bearColor : color.yellow
    if signal == "BUY"
        alert("Buy in : " + sym, alert.freq_once_per_bar_close)
    if signal == "SELL"
        alert("Sell in : " + sym, alert.freq_once_per_bar_close)
    // Algo 1
    tableID.cell(1, row, text = str.tostring(CLOSE_tf1, format.mintick), bgcolor = cellColor, text_size = textSize, text_color = textColor)
    tableID.cell(2, row, text = algo1_signal_tf1, bgcolor = algo1_color_tf1, text_size = textSize, text_color = textColor)
    tableID.cell(3, row, text = algo1_signal_tf2, bgcolor = algo1_color_tf2, text_size = textSize, text_color = textColor)
    tableID.cell(4, row, text = algo1_signal_tf3, bgcolor = algo1_color_tf3, text_size = textSize, text_color = textColor)
    tableID.cell(5, row, text = algo1_signal_tf4, bgcolor = algo1_color_tf4, text_size = textSize, text_color = textColor)
    tableID.cell(6, row, text = algo1_signal_tf5, bgcolor = algo1_color_tf5, text_size = textSize, text_color = textColor)
    tableID.cell(7, row, text = algo2_signal_tf1, bgcolor = algo2_color_tf1, text_size = textSize, text_color = textColor)
    tableID.cell(8, row, text = algo2_signal_tf2, bgcolor = algo2_color_tf2, text_size = textSize, text_color = textColor)
    tableID.cell(9, row, text = algo2_signal_tf3, bgcolor = algo2_color_tf3, text_size = textSize, text_color = textColor)
    tableID.cell(10, row, text = algo2_signal_tf4, bgcolor = algo2_color_tf4, text_size = textSize, text_color = textColor)
    tableID.cell(11, row, text = algo2_signal_tf5, bgcolor = algo2_color_tf5, text_size = textSize, text_color = textColor)
    tableID.cell(12, row, text = signal, bgcolor = signalColor, text_size = textSize, text_color = textColor)

createSignalCell(row, sym, tableID)=>
    tableID.cell(0, row, text = getSym(sym), bgcolor = frameColor, text_size = textSize, text_color = textColor)
    addRow(sym, row, tableID)


if barstate.islast or barstate.islastconfirmedhistory
    dashboard = table.new(location, 21, 20, border_color = borderColor, border_width = 1)
    dashboard.cell(0, 0, text = "Symbol", bgcolor = frameColor, text_size = textSize, text_color = textColor)
    dashboard.merge_cells(0, 0, 0, 1)
    dashboard.cell(1, 0, text = "Price", bgcolor = frameColor, text_size = textSize, text_color = textColor)
    dashboard.merge_cells(1, 0, 1, 1)

    createDashboardCell(2, 0, "Algo 1", timeframes, dashboard)
    createDashboardCell(7, 0, "Algo 2", timeframes, dashboard)
    dashboard.merge_cells(12, 0, 12, 1)
    dashboard.cell(12, 0, text = "Signal", 
     bgcolor = frameColor, text_size = textSize, text_color = textColor)
    createSignalCell(2, symbol1, dashboard)
    createSignalCell(3, symbol2, dashboard)
    createSignalCell(4, symbol3, dashboard)
    createSignalCell(5, symbol4, dashboard)
    createSignalCell(6, symbol5, dashboard)
    createSignalCell(7, symbol6, dashboard)
    createSignalCell(8, symbol7, dashboard)
