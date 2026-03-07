import { useState, useCallback } from "react";

const API_KEY = "FIQhyE6XxRGLucP_Du2har6r4oHZsca3";
const BASE_URL = "https://api.polygon.io";
const TIMEFRAMES = ["1m","5m","15m","30m","1h","4h","1D","1W"];
const TF_MAP = {
  "1m":{multiplier:1,timespan:"minute"},
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

function calcSlope(prices, period = 5) {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const n = slice.length;
  const xMean = (n - 1) / 2;
  const yMean = slice.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (slice[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

async function fetchCandles(symbol, tf) {
  const { multiplier, timespan } = TF_MAP[tf];
  const now = new Date();
  const from = new Date(now);
  const daysBack = timespan==="minute"?5:timespan==="hour"?30:timespan==="day"?400:800;
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().split("T")[0];
  const to
