// ==========================================================================
// SKFX SIGNALS APP - APPLICATION ENGINE
// Replicates Pine Script Logic for multi-asset scanning and confirmation signals
// Sourced from Yahoo Finance API via CORS proxies
// ==========================================================================

// --- CONFIG & CONSTANTS ---
const SYMBOLS = [
    { id: 'XAUUSD=X', name: 'XAUUSD', type: 'commodities' },
    { id: 'BTC-USD', name: 'BTCUSD', type: 'crypto' },
    { id: 'ETH-USD', name: 'ETHUSD', type: 'crypto' },
    { id: 'EURUSD=X', name: 'EURUSD', type: 'forex' },
    { id: 'GBPUSD=X', name: 'GBPUSD', type: 'forex' },
    { id: 'USDJPY=X', name: 'USDJPY', type: 'forex' },
    { id: 'AUDUSD=X', name: 'AUDUSD', type: 'forex' },
    { id: 'USDCAD=X', name: 'USDCAD', type: 'forex' },
    { id: 'USDCHF=X', name: 'USDCHF', type: 'forex' },
    { id: 'NZDUSD=X', name: 'NZDUSD', type: 'forex' },
    { id: 'EURGBP=X', name: 'EURGBP', type: 'forex' },
    { id: 'EURJPY=X', name: 'EURJPY', type: 'forex' },
    { id: 'GBPJPY=X', name: 'GBPJPY', type: 'forex' },
    { id: 'AUDJPY=X', name: 'AUDJPY', type: 'forex' },
    { id: 'CHFJPY=X', name: 'CHFJPY', type: 'forex' },
    { id: 'CADJPY=X', name: 'CADJPY', type: 'forex' },
    { id: 'NZDJPY=X', name: 'NZDJPY', type: 'forex' },
    { id: 'EURAUD=X', name: 'EURAUD', type: 'forex' },
    { id: 'GBPAUD=X', name: 'GBPAUD', type: 'forex' },
    { id: 'EURNZD=X', name: 'EURNZD', type: 'forex' },
    { id: 'GBPNZD=X', name: 'GBPNZD', type: 'forex' },
    { id: 'EURCAD=X', name: 'EURCAD', type: 'forex' },
    { id: 'GBPCAD=X', name: 'GBPCAD', type: 'forex' },
    { id: 'AUDCAD=X', name: 'AUDCAD', type: 'forex' },
    { id: 'NZDCAD=X', name: 'NZDCAD', type: 'forex' },
    { id: 'AUDNZD=X', name: 'AUDNZD', type: 'forex' },
    { id: 'EURCHF=X', name: 'EURCHF', type: 'forex' },
    { id: 'GBPCHF=X', name: 'GBPCHF', type: 'forex' },
    { id: 'AUDCHF=X', name: 'AUDCHF', type: 'forex' },
    { id: 'CADCHF=X', name: 'CADCHF', type: 'forex' },
    { id: 'NZDCHF=X', name: 'NZDCHF', type: 'forex' },
    { id: 'NQ=F', name: 'NASDAQ', type: 'indices' },
    { id: 'YM=F', name: 'US30', type: 'indices' },
    { id: 'XAGUSD=X', name: 'XAGUSD', type: 'commodities' }
];

const TIMEFRAMES = [
    { id: '5m', name: 'M5', interval: '5m', range: '5d' },
    { id: '15m', name: 'M15', interval: '15m', range: '5d' },
    { id: '30m', name: 'M30', interval: '30m', range: '5d' },
    { id: '1h', name: 'H1', interval: '60m', range: '30d' },
    { id: '4h', name: 'H4', interval: '60m', range: '30d' }, // Constructed from H1
    { id: '1d', name: 'D', interval: '1d', range: '1y' },
    { id: '1wk', name: 'W', interval: '1wk', range: '5y' },
    { id: '1mo', name: 'M', interval: '1mo', range: 'max' }
];

// Default configurations
let config = {
    pivotLookback: 10,
    bodyBreak: true,
    soundAlerts: true,
    enabledSymbols: ['XAUUSD=X', 'BTC-USD', 'ETH-USD', 'EURUSD=X', 'GBPUSD=X', 'NQ=F', 'YM=F', 'XAGUSD=X'],
    enabledTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d', '1wk', '1mo']
};

// State Store
let appState = {
    selectedSymbol: 'XAUUSD=X',
    selectedTimeframe: '15m',
    currentFilter: 'all',
    activeTab: 'all',
    tvWidget: null,
    fetchQueue: [],
    isFetching: false,
    matrixData: {}, // Key: symbol_tf, Value: analysis results
    alertLogs: [],
    activeTrades: [],
    historyTrades: [],
    trackerTab: 'active'
};

// --- DATA FETCHING & PROXY SERVICE ---
async function fetchWithProxy(url) {
    const proxies = [
        target => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
        target => `https://corsproxy.io/?${encodeURIComponent(target)}`
    ];
    
    let lastError = null;
    for (let proxyFn of proxies) {
        try {
            const proxyUrl = proxyFn(url);
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return await res.json();
        } catch (e) {
            lastError = e;
            console.warn(`Proxy failed, trying next... Url: ${url}`, e);
        }
    }
    
    // Direct fetch fallback in case CORS policies permit it or headers are relaxed
    try {
        console.log(`Attempting direct fetch fallback for: ${url}`);
        const res = await fetch(url);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`Direct fetch fallback failed for: ${url}`, e);
    }
    
    throw lastError || new Error("Failed to fetch via all proxy endpoints.");
}

function getBinanceInterval(tfId) {
    if (tfId === '5m') return '5m';
    if (tfId === '15m') return '15m';
    if (tfId === '30m') return '30m';
    if (tfId === '1h') return '1h';
    if (tfId === '4h') return '4h';
    if (tfId === '1d') return '1d';
    if (tfId === '1wk') return '1w';
    if (tfId === '1mo') return '1M';
    return '15m';
}

async function fetchCandleData(symbol, tfObj) {
    // 1. Direct Binance Fetch for Crypto (Fast & Real-time)
    if (symbol === 'BTC-USD' || symbol === 'ETH-USD') {
        const bSymbol = symbol.replace('-USD', 'USDT');
        const bInterval = getBinanceInterval(tfObj.id);
        const bUrl = `https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${bInterval}&limit=150`;
        
        try {
            const res = await fetch(bUrl);
            if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
            const klines = await res.json();
            
            const candles = klines.map(k => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
            
            return candles;
        } catch (e) {
            console.warn(`Binance direct fetch failed for ${symbol}, falling back to Yahoo Finance:`, e);
        }
    }
    
    // 2. Yahoo Finance Fetch with Proxy and Cache Buster
    const isH4 = tfObj.id === '4h';
    const interval = isH4 ? '60m' : tfObj.interval;
    const range = tfObj.range;
    
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&_=${Date.now()}`;
    
    try {
        const data = await fetchWithProxy(yUrl);
        if (!data?.chart?.result?.[0]) return null;
        
        const result = data.chart.result[0];
        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};
        
        let candles = [];
        for (let k = 0; k < timestamps.length; k++) {
            if (quotes.open?.[k] !== null && quotes.high?.[k] !== null && 
                quotes.low?.[k] !== null && quotes.close?.[k] !== null) {
                candles.push({
                    time: timestamps[k] * 1000,
                    open: quotes.open[k],
                    high: quotes.high[k],
                    low: quotes.low[k],
                    close: quotes.close[k],
                    volume: quotes.volume?.[k] || 0
                });
            }
        }
        
        if (isH4) {
            candles = aggregateH1toH4(candles);
        }
        
        return candles;
    } catch (e) {
        console.error(`Error fetching data for ${symbol} on ${tfObj.name}:`, e);
        return null;
    }
}

function aggregateH1toH4(candles) {
    const h4Candles = [];
    let currentH4 = null;
    
    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const date = new Date(c.time);
        const hour = date.getUTCHours();
        const h4StartHour = Math.floor(hour / 4) * 4;
        
        if (!currentH4 || currentH4.startHour !== h4StartHour || (c.time - currentH4.time) > 4 * 60 * 60 * 1000) {
            if (currentH4) {
                h4Candles.push({
                    time: currentH4.time,
                    open: currentH4.open,
                    high: currentH4.high,
                    low: currentH4.low,
                    close: currentH4.close,
                    volume: currentH4.volume
                });
            }
            currentH4 = {
                time: c.time,
                startHour: h4StartHour,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
            };
        } else {
            currentH4.high = Math.max(currentH4.high, c.high);
            currentH4.low = Math.min(currentH4.low, c.low);
            currentH4.close = c.close;
            currentH4.volume += c.volume;
        }
    }
    if (currentH4) {
        h4Candles.push({
            time: currentH4.time,
            open: currentH4.open,
            high: currentH4.high,
            low: currentH4.low,
            close: currentH4.close,
            volume: currentH4.volume
        });
    }
    return h4Candles;
}

// --- PINE SCRIPT MATHEMATICAL LOGIC TRANSLATIONS ---

function calculateATR(candles, period = 14) {
    if (candles.length < period) return Array(candles.length).fill(0);
    const tr = [];
    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            tr.push(candles[i].high - candles[i].low);
        } else {
            tr.push(Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i-1].close),
                Math.abs(candles[i].low - candles[i-1].close)
            ));
        }
    }
    
    const atr = Array(candles.length).fill(0);
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += tr[i];
    }
    atr[period - 1] = sum / period;
    
    for (let i = period; i < candles.length; i++) {
        atr[i] = (atr[i-1] * (period - 1) + tr[i]) / period;
    }
    return atr;
}

function calculateStructOTE(candles, pLook, bodyBreak) {
    let sHigh = candles[0].high;
    let sLow = candles[0].low;
    let sDir = 0; // 0=neutral, 1=bear, 2=bull
    
    for (let i = pLook; i < candles.length; i++) {
        // Calculate pivot lookback high/low offsets
        let hIdx = i;
        let highest = candles[i].high;
        for (let j = 1; j < pLook; j++) {
            if (candles[i-j].high > highest) {
                highest = candles[i-j].high;
                hIdx = i-j;
            }
        }
        
        let lIdx = i;
        let lowest = candles[i].low;
        for (let j = 1; j < pLook; j++) {
            if (candles[i-j].low < lowest) {
                lowest = candles[i-j].low;
                lIdx = i-j;
            }
        }
        
        const brkLow = bodyBreak ? candles[i].close : candles[i].low;
        const brkHigh = bodyBreak ? candles[i].close : candles[i].high;
        
        if (brkLow < sLow) {
            sDir = 1;
            sHigh = candles[hIdx].high;
            sLow = candles[i].low;
        } else if (brkHigh > sHigh) {
            sDir = 2;
            sHigh = candles[i].high;
            sLow = candles[lIdx].low;
        } else {
            if (sDir === 0 || sDir === 2) {
                if (candles[i].high > sHigh) sHigh = candles[i].high;
            }
            if (sDir === 0 || sDir === 1) {
                if (candles[i].low < sLow) sLow = candles[i].low;
            }
        }
    }
    
    // Calculate Fibonacci levels on last candle
    const sRange = sHigh - sLow;
    let f618, f786, f705;
    
    if (sDir === 1) { // Bearish
        f618 = sLow + sRange * 0.618;
        f786 = sLow + sRange * 0.786;
        f705 = sLow + sRange * 0.705;
    } else { // Bullish / Neutral
        f618 = sHigh - sRange * 0.618;
        f786 = sHigh - sRange * 0.786;
        f705 = sHigh - sRange * 0.705;
    }
    
    const zU = Math.max(f618, f786);
    const zL = Math.min(f618, f786);
    let ote = 0;
    
    const close = candles[candles.length - 1].close;
    if (close <= zU && close >= zL) {
        const d618 = Math.abs(close - f618);
        const d705 = Math.abs(close - f705);
        const d786 = Math.abs(close - f786);
        
        if (d618 < d705 && d618 < d786) ote = 1;
        else if (d705 < d618 && d705 < d786) ote = 2;
        else ote = 3;
    }
    
    return { sDir, sHigh, sLow, ote, f618, f705, f786 };
}

function calculateOB(candles) {
    const N = candles.length;
    if (N < 6) return 0;
    
    let activeBullOB = null;
    let activeBearOB = null;
    
    // Scan up to second-to-last candle to find active, unmitigated order blocks
    for (let i = 2; i < N - 1; i++) {
        // Bullish OB: Bearish down candle followed by immediate bullish expansion
        const isBullishExpansion = candles[i+1].close > candles[i].high && candles[i].close < candles[i].open;
        if (isBullishExpansion) {
            activeBullOB = { top: candles[i].high, bottom: candles[i].low, index: i };
        }
        
        // Bearish OB: Bullish up candle followed by immediate bearish expansion
        const isBearishExpansion = candles[i+1].close < candles[i].low && candles[i].close > candles[i].open;
        if (isBearishExpansion) {
            activeBearOB = { top: candles[i].high, bottom: candles[i].low, index: i };
        }
        
        // Check mitigation by subsequent candles before the current candle
        if (activeBullOB && i > activeBullOB.index) {
            if (candles[i].close < activeBullOB.bottom) {
                activeBullOB = null;
            }
        }
        if (activeBearOB && i > activeBearOB.index) {
            if (candles[i].close > activeBearOB.top) {
                activeBearOB = null;
            }
        }
    }
    
    const current = candles[N-1];
    let obStatus = 0;
    
    // Check if the current candle trades into or touches the unmitigated zone
    if (activeBullOB) {
        if (current.low <= activeBullOB.top && current.close >= activeBullOB.bottom) {
            obStatus = 3; // Demand OB Touch
        } else {
            obStatus = 1; // Demand OB Active
        }
    }
    if (activeBearOB) {
        if (current.high >= activeBearOB.bottom && current.close <= activeBearOB.top) {
            obStatus = 4; // Supply OB Touch
        } else {
            obStatus = 2; // Supply OB Active
        }
    }
    
    return obStatus;
}

function calculateFVG(candles, atrArray) {
    const N = candles.length;
    if (N < 6) return 0;
    
    let activeBullFVG = null;
    let activeBearFVG = null;
    
    // Scan up to second-to-last candle to find active, unfilled FVGs
    for (let i = 2; i < N - 1; i++) {
        const atr = atrArray[i];
        
        // Bullish FVG: Low of candle i is above high of candle i-2
        if (candles[i].low > candles[i-2].high && (candles[i].low - candles[i-2].high) >= atr * 0.2) {
            activeBullFVG = { top: candles[i].low, bottom: candles[i-2].high, index: i };
        }
        
        // Bearish FVG: High of candle i is below low of candle i-2
        if (candles[i].high < candles[i-2].low && (candles[i-2].low - candles[i].high) >= atr * 0.2) {
            activeBearFVG = { top: candles[i-2].low, bottom: candles[i].high, index: i };
        }
        
        // Check mitigation by subsequent candles
        if (activeBullFVG && i > activeBullFVG.index) {
            if (candles[i].low <= activeBullFVG.bottom) {
                activeBullFVG = null;
            }
        }
        if (activeBearFVG && i > activeBearFVG.index) {
            if (candles[i].high >= activeBearFVG.top) {
                activeBearFVG = null;
            }
        }
    }
    
    const current = candles[N-1];
    let fvgStatus = 0;
    let isBullHit = false;
    let isBearHit = false;
    
    if (activeBullFVG) {
        if (current.low <= activeBullFVG.top && current.close >= activeBullFVG.bottom) {
            isBullHit = true;
        }
    }
    if (activeBearFVG) {
        if (current.high >= activeBearFVG.bottom && current.close <= activeBearFVG.top) {
            isBearHit = true;
        }
    }
    
    if (isBullHit && isBearHit) fvgStatus = 3;
    else if (isBullHit) fvgStatus = 1;
    else if (isBearHit) fvgStatus = 2;
    
    return fvgStatus;
}

function calculateSweep(candles) {
    const N = candles.length;
    if (N < 3) return 1; // Neutral
    
    const isBull = candles[N-1].low < candles[N-2].low && 
                   candles[N-1].close > candles[N-2].low && 
                   candles[N-1].close >= Math.min(candles[N-2].open, candles[N-2].close);
                   
    const isBear = candles[N-1].high > candles[N-2].high && 
                   candles[N-1].close < candles[N-2].high && 
                   candles[N-1].close <= Math.max(candles[N-2].open, candles[N-2].close);
                   
    if (isBull) return 2; // Bull Sweep
    if (isBear) return 0; // Bear Sweep
    return 1; // Neutral
}

// --- ENTRY SIGNAL CONFIRMATION SCANNER ---
// Checks for Hammer, Engulfing, or Sweeps inside OB, OTE, or FVG zones
function scanConfirmationPatterns(candles, struct, ob, fvg, sweep) {
    const N = candles.length;
    if (N < 4) return { signal: 'none', pattern: '-' };
    
    // Check Candlestick Reversals
    // 1. Hammer / Pin Bar
    const body = Math.abs(candles[N-1].close - candles[N-1].open);
    const lowerShadow = Math.min(candles[N-1].open, candles[N-1].close) - candles[N-1].low;
    const upperShadow = candles[N-1].high - Math.max(candles[N-1].open, candles[N-1].close);
    const totalRange = candles[N-1].high - candles[N-1].low;
    
    const isHammer = lowerShadow >= 2 * body && upperShadow <= 0.5 * body && body > 0;
    const isShootingStar = upperShadow >= 2 * body && lowerShadow <= 0.5 * body && body > 0;
    
    // 2. Engulfings
    const isBullEngulfing = candles[N-1].close > candles[N-1].open && 
                            candles[N-2].close < candles[N-2].open && 
                            candles[N-1].close >= candles[N-2].open && 
                            candles[N-1].open <= candles[N-2].close;
                            
    const isBearEngulfing = candles[N-1].close < candles[N-1].open && 
                            candles[N-2].close > candles[N-2].open && 
                            candles[N-1].close <= candles[N-2].open && 
                            candles[N-1].open >= candles[N-2].close;
                            
    // ZONES CHECK
    const isBullZone = (struct.sDir === 2 && struct.ote > 0) || (ob === 1 || ob === 3) || (fvg === 1 || fvg === 3);
    const isBearZone = (struct.sDir === 1 && struct.ote > 0) || (ob === 2 || ob === 4) || (fvg === 2 || fvg === 3);
    
    // CHECK PATTERNS INSIDE ZONES
    if (isBullZone) {
        if (isBullEngulfing) return { signal: 'BUY', pattern: 'Bullish Engulfing' };
        if (isHammer) return { signal: 'BUY', pattern: 'Hammer / Pin Bar' };
        if (sweep === 2) return { signal: 'BUY', pattern: 'Bullish Sweep' };
        if (ob === 3) return { signal: 'BUY', pattern: 'Demand OB Mitigation' };
        if (fvg === 1 || fvg === 3) return { signal: 'BUY', pattern: 'Bullish FVG Touch' };
    }
    
    if (isBearZone) {
        if (isBearEngulfing) return { signal: 'SELL', pattern: 'Bearish Engulfing' };
        if (isShootingStar) return { signal: 'SELL', pattern: 'Shooting Star / Pin Bar' };
        if (sweep === 0) return { signal: 'SELL', pattern: 'Bearish Sweep' };
        if (ob === 4) return { signal: 'SELL', pattern: 'Supply OB Mitigation' };
        if (fvg === 2 || fvg === 3) return { signal: 'SELL', pattern: 'Bearish FVG Touch' };
    }
    
    return { signal: 'none', pattern: '-' };
}

// --- ANALYSIS CONTROLLER ---
function analyzeAsset(candles) {
    if (!candles || candles.length < config.pivotLookback + 5) return null;
    
    // Slice out the current live incomplete candle so all calculations run ONLY on closed candles
    const closedCandles = candles.slice(0, candles.length - 1);
    const N = closedCandles.length;
    if (N < config.pivotLookback + 4) return null;
    
    const atrArray = calculateATR(closedCandles, 14);
    const struct = calculateStructOTE(closedCandles, config.pivotLookback, config.bodyBreak);
    const ob = calculateOB(closedCandles);
    const fvg = calculateFVG(closedCandles, atrArray);
    const sweep = calculateSweep(closedCandles);
    
    const confirm = scanConfirmationPatterns(closedCandles, struct, ob, fvg, sweep);
    
    // Daily/Weekly Trend Bias calculation
    // Bullish structure = BULL, Bearish structure = BEAR. Neutral structure falls back to 20 SMA.
    let bias = 'NEUTRAL';
    const closeVal = closedCandles[N-1].close;
    if (struct.sDir === 2) {
        bias = 'BULL';
    } else if (struct.sDir === 1) {
        bias = 'BEAR';
    } else {
        if (N >= 20) {
            let sum = 0;
            for (let j = N - 20; j < N; j++) {
                sum += closedCandles[j].close;
            }
            const sma20 = sum / 20;
            bias = closeVal >= sma20 ? 'BULL' : 'BEAR';
        } else {
            bias = closeVal >= closedCandles[0].close ? 'BULL' : 'BEAR';
        }
    }
    
    return {
        candles: closedCandles,
        struct,
        ob,
        fvg,
        sweep,
        signal: confirm.signal,
        pattern: confirm.pattern,
        close: closedCandles[N - 1].close,
        bias: bias
    };
}

// --- QUEUE & CONTROLLER ---
function addToFetchQueue(symbolId, tfId) {
    const key = `${symbolId}_${tfId}`;
    if (!appState.fetchQueue.includes(key)) {
        appState.fetchQueue.push(key);
        processQueue();
    }
}

async function processQueue() {
    if (appState.isFetching || appState.fetchQueue.length === 0) return;
    
    appState.isFetching = true;
    document.getElementById('status-pulse').className = 'pulse-dot red';
    document.getElementById('connection-status').innerText = `Syncing (${appState.fetchQueue.length} remaining)...`;
    
    const key = appState.fetchQueue.shift();
    const [symbolId, tfId] = key.split('_');
    
    const symObj = SYMBOLS.find(s => s.id === symbolId);
    const tfObj = TIMEFRAMES.find(t => t.id === tfId);
    
    if (symObj && tfObj) {
        const candles = await fetchCandleData(symbolId, tfObj);
        if (candles) {
            const result = analyzeAsset(candles);
            if (result) {
                const oldResult = appState.matrixData[key];
                appState.matrixData[key] = result;
                
                // Run session killzone sweep detection (uses the 1h / current TF candles)
                if (tfObj.id === '1h' || tfObj.id === '15m') {
                    runSessionAnalysis(symObj, candles);
                }
                
                // Update active positions monitoring
                evaluateActivePositions(symbolId, tfId, result);
                
                // 1. Entry Signal change detection for alerts
                if (result.signal !== 'none' && (!oldResult || oldResult.signal !== result.signal)) {
                    triggerAlert(symObj, tfObj, result, 'entry');
                }
                
                // 2. Pure Sweep change detection for alerts (independent of zones)
                if ((result.sweep === 2 || result.sweep === 0) && (!oldResult || oldResult.sweep !== result.sweep)) {
                    triggerAlert(symObj, tfObj, result, 'sweep');
                }
                
                updateMatrixCell(symbolId, tfId);
                
                // If it is the selected asset, sync detailed view
                if (appState.selectedSymbol === symbolId && appState.selectedTimeframe === tfId) {
                    updateDetailPanel();
                }
            }
        }
    }
    
    appState.isFetching = false;
    if (appState.fetchQueue.length > 0) {
        // Fetch delay to prevent API throttling
        setTimeout(processQueue, 300);
    } else {
        document.getElementById('status-pulse').className = 'pulse-dot green';
        document.getElementById('connection-status').innerText = 'Dashboard Synced';
    }
}

// Start queue cycle for active components
function queueFullScan() {
    config.enabledSymbols.forEach(symId => {
        config.enabledTimeframes.forEach(tfId => {
            addToFetchQueue(symId, tfId);
        });
    });
}

// ==========================================================================
// SESSION KILLZONE ENGINE (NY TIMEZONE BASIS)
// Tracks Asia, London, NY, London Close, and CBDR sessions in America/New_York time.
// Detects liquidity sweeps of inactive session highs/lows.
// ==========================================================================

const SESSION_KILLZONES = {
    asian:       { startM: 1200, endM: 1440, name: 'Asia',         chipId: 'session-asian' },         // 20:00 - 00:00 (8:00 PM - 12:00 AM NY)
    london:      { startM: 120,  endM: 300,  name: 'London',       chipId: 'session-london' },        // 02:00 - 05:00 (2:00 AM - 5:00 AM NY)
    ny:          { startM: 420,  endM: 600,  name: 'New York',     chipId: 'session-ny' },            // 07:00 - 10:00 (7:00 AM - 10:00 AM NY)
    londonClose: { startM: 600,  endM: 720,  name: 'London Close', chipId: 'session-london-close' },  // 10:00 - 12:00 (10:00 AM - 12:00 PM NY)
    cbdr:        { startM: 810,  endM: 1200, name: 'CBDR',         chipId: 'session-cbdr' }           // 13:30 - 20:00 (1:30 PM - 8:00 PM NY)
};

// Tracks active/inactive session levels: { [symId]: { [sessionKey]: { h, l, date } } }
let sessionLevels = {};
let sessionSweepFired = {}; // key: `${symId}_${session}_${h|l}_${date}`

function getNyTime() {
    const optionsDate = { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" };
    const optionsTime = { timeZone: "America/New_York", hour: "numeric", minute: "numeric", second: "numeric", hour12: false };
    
    const dStr = new Intl.DateTimeFormat("en-US", optionsDate).format(new Date());
    const tStr = new Intl.DateTimeFormat("en-US", optionsTime).format(new Date());
    
    const [month, day, year] = dStr.split('/');
    const [hour, min, sec] = tStr.split(':').map(Number);
    
    return {
        hour,
        min,
        sec,
        dateKey: `${year}-${month}-${day}`,
        minutesFromMidnight: hour * 60 + min
    };
}

function updateSessionBar() {
    const ny = getNyTime();
    
    // Update NY clock
    const nyClockEl = document.getElementById('ny-clock');
    if (nyClockEl) {
        nyClockEl.innerText = `${String(ny.hour).padStart(2,'0')}:${String(ny.min).padStart(2,'0')}:${String(ny.sec).padStart(2,'0')}`;
    }
    
    // Update UTC clock
    const utcClockEl = document.getElementById('utc-clock');
    if (utcClockEl) {
        const now = new Date();
        utcClockEl.innerText = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}`;
    }

    // Toggle active session chips
    Object.keys(SESSION_KILLZONES).forEach(key => {
        const s = SESSION_KILLZONES[key];
        const chip = document.getElementById(s.chipId);
        if (!chip) return;
        
        const active = ny.minutesFromMidnight >= s.startM && ny.minutesFromMidnight < s.endM;
        if (active) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
            // Do not clear sweep-detected status automatically unless user refreshes or session starts
        }
    });
}

function detectSessionSweep(symObj, high, low, close) {
    const symId = symObj.id;
    if (!sessionLevels[symId]) return;

    const ny = getNyTime();
    let sweepCount = 0;

    Object.keys(SESSION_KILLZONES).forEach(sessionKey => {
        const sl = sessionLevels[symId][sessionKey];
        if (!sl || !sl.h || !sl.l) return;

        // Liquidity Sweep is only valid if that session is NOT currently active
        const isSessionActive = ny.minutesFromMidnight >= SESSION_KILLZONES[sessionKey].startM && ny.minutesFromMidnight < SESSION_KILLZONES[sessionKey].endM;
        if (isSessionActive && sl.date === ny.dateKey) return;

        const sessionName = SESSION_KILLZONES[sessionKey].name;
        const dec = symObj.type === 'crypto' ? 2 : 5;

        // High Sweep: price wicked above the session high but closed below it
        const hiKey = `${symId}_${sessionKey}_hi_${sl.h.toFixed(5)}_${sl.date}`;
        if (high > sl.h && close < sl.h && !sessionSweepFired[hiKey]) {
            sessionSweepFired[hiKey] = true;
            sweepCount++;
            const alertObj = {
                time: new Date().toLocaleTimeString(),
                symbol: symObj.name,
                timeframe: 'Live',
                kind: 'session',
                type: 'BEAR SWEEP',
                pattern: `${sessionName} Session High Sweep (${sl.h.toFixed(dec)})`,
                price: high.toFixed(dec),
                validity: 0,
                sessionName: sessionName
            };
            appState.alertLogs.unshift(alertObj);
            playChime('bearish');
            
            const chip = document.getElementById(SESSION_KILLZONES[sessionKey].chipId);
            if (chip) chip.classList.add('sweep-detected');
            renderAlertLogs();
        }

        // Low Sweep: price wicked below session low but closed above it
        const loKey = `${symId}_${sessionKey}_lo_${sl.l.toFixed(5)}_${sl.date}`;
        if (low < sl.l && close > sl.l && !sessionSweepFired[loKey]) {
            sessionSweepFired[loKey] = true;
            sweepCount++;
            const alertObj = {
                time: new Date().toLocaleTimeString(),
                symbol: symObj.name,
                timeframe: 'Live',
                kind: 'session',
                type: 'BULL SWEEP',
                pattern: `${sessionName} Session Low Sweep (${sl.l.toFixed(dec)})`,
                price: low.toFixed(dec),
                validity: 0,
                sessionName: sessionName
            };
            appState.alertLogs.unshift(alertObj);
            playChime('bullish');
            
            const chip = document.getElementById(SESSION_KILLZONES[sessionKey].chipId);
            if (chip) chip.classList.add('sweep-detected');
            renderAlertLogs();
        }
    });

    // Update sweep count badge
    const totalSessionSweeps = appState.alertLogs.filter(l => l.kind === 'session').length;
    const badge = document.getElementById('session-sweep-count');
    if (badge) {
        if (totalSessionSweeps > 0) {
            badge.style.display = 'block';
            badge.innerText = `⚡ ${totalSessionSweeps} Session Sweep${totalSessionSweeps > 1 ? 's' : ''} Today`;
        } else {
            badge.style.display = 'none';
        }
    }
}

function runSessionAnalysis(symObj, candles) {
    if (!candles || candles.length === 0) return;
    const symId = symObj.id;

    if (!sessionLevels[symId]) {
        sessionLevels[symId] = {};
    }

    // Process last 40 candles to reconstruct session High/Low zones in NY time
    const lookbackCandles = candles.slice(-40);
    lookbackCandles.forEach(candle => {
        const candleTime = candle.time;
        if (!candleTime) return;
        
        const d = new Date(candleTime);
        const optionsDate = { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" };
        const optionsTime = { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false };
        
        const dStr = new Intl.DateTimeFormat("en-US", optionsDate).format(d);
        const tStr = new Intl.DateTimeFormat("en-US", optionsTime).format(d);
        
        const [month, day, year] = dStr.split('/');
        const [hour, min] = tStr.split(':').map(Number);
        
        const cDateKey = `${year}-${month}-${day}`;
        const cMin = hour * 60 + min;

        Object.keys(SESSION_KILLZONES).forEach(key => {
            const s = SESSION_KILLZONES[key];
            const active = cMin >= s.startM && cMin < s.endM;
            
            if (active) {
                if (!sessionLevels[symId][key] || sessionLevels[symId][key].date !== cDateKey) {
                    sessionLevels[symId][key] = { h: candle.high, l: candle.low, date: cDateKey };
                } else {
                    const sl = sessionLevels[symId][key];
                    if (candle.high > sl.h) sl.h = candle.high;
                    if (candle.low < sl.l) sl.l = candle.low;
                }
            }
        });
    });

    // Detect sweeps on the latest candle
    const last = candles[candles.length - 1];
    detectSessionSweep(symObj, last.high, last.low, last.close);
}

// Start live clocks ticker
setInterval(updateSessionBar, 1000);


// --- ALERTS ENGINE ---
// --- PREMIUM SYNTHESIZED SOUNDS ---
let synthAudioCtx = null;

function playChime(type) {
    if (!config.soundAlerts) return;
    try {
        if (!synthAudioCtx) {
            synthAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (synthAudioCtx.state === 'suspended') {
            synthAudioCtx.resume();
        }
        const now = synthAudioCtx.currentTime;
        if (type === 'bullish') {
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = synthAudioCtx.createOscillator();
                const gain = synthAudioCtx.createGain();
                osc.connect(gain);
                gain.connect(synthAudioCtx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                gain.gain.setValueAtTime(0, now + idx * 0.1);
                gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.4);
            });
        } else if (type === 'bearish') {
            const notes = [783.99, 659.25, 523.25, 392.00]; // G5, E5, C5, G4
            notes.forEach((freq, idx) => {
                const osc = synthAudioCtx.createOscillator();
                const gain = synthAudioCtx.createGain();
                osc.connect(gain);
                gain.connect(synthAudioCtx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                gain.gain.setValueAtTime(0, now + idx * 0.1);
                gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.4);
            });
        } else if (type === 'win') {
            const notes = [587.33, 659.25, 880.00, 1046.50]; // D5, E5, A5, C6
            notes.forEach((freq, idx) => {
                const osc = synthAudioCtx.createOscillator();
                const gain = synthAudioCtx.createGain();
                osc.connect(gain);
                gain.connect(synthAudioCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                gain.gain.setValueAtTime(0, now + idx * 0.08);
                gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.08 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.35);
            });
        } else if (type === 'loss') {
            const notes = [329.63, 293.66, 261.63, 220.00]; // E4, D4, C4, A3
            notes.forEach((freq, idx) => {
                const osc = synthAudioCtx.createOscillator();
                const gain = synthAudioCtx.createGain();
                osc.connect(gain);
                gain.connect(synthAudioCtx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                gain.gain.setValueAtTime(0, now + idx * 0.12);
                gain.gain.linearRampToValueAtTime(0.05, now + idx * 0.12 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 0.45);
            });
        }
    } catch(e) {
        console.error("Audio failed:", e);
    }
}

// --- CONFLUENCE VALIDITY SCANNER ---
function calculateValidity(result) {
    if (result.signal === 'none') return 0;
    
    let score = 40; // Base pattern confirmation score
    
    if (result.signal === 'BUY') {
        if (result.struct.sDir === 2) score += 20; // Struct match
        if (result.struct.ote > 0) score += 15;     // OTE zone
        if (result.ob === 1 || result.ob === 3) score += 15; // OB touch
        if (result.fvg === 1 || result.fvg === 3) score += 10; // FVG hit
    } else if (result.signal === 'SELL') {
        if (result.struct.sDir === 1) score += 20;
        if (result.struct.ote > 0) score += 15;
        if (result.ob === 2 || result.ob === 4) score += 15;
        if (result.fvg === 2 || result.fvg === 3) score += 10;
    }
    
    return score;
}

// --- ALERTS ENGINE ---
function triggerAlert(symObj, tfObj, result, alertKind = 'entry') {
    const validity = calculateValidity(result);
    
    const alert = {
        time: new Date().toLocaleTimeString(),
        symbol: symObj.name,
        timeframe: tfObj.name,
        kind: alertKind, // 'entry' or 'sweep'
        type: alertKind === 'entry' ? result.signal : (result.sweep === 2 ? 'BULL SWEEP' : 'BEAR SWEEP'),
        pattern: alertKind === 'entry' ? result.pattern : (result.sweep === 2 ? 'Bullish Liquidity Sweep' : 'Bearish Liquidity Sweep'),
        price: result.close.toFixed(symObj.type === 'crypto' ? 2 : 5),
        validity: validity
    };
    
    appState.alertLogs.unshift(alert);
    
    // Play Web Audio Chime and execute trade if it's an entry signal
    if (alertKind === 'entry') {
        playChime(result.signal === 'BUY' ? 'bullish' : 'bearish');
        openTrackedPosition(symObj, tfObj, result, validity);
    } else {
        playChime(result.sweep === 2 ? 'bullish' : 'bearish');
    }
    
    // Render Alert Log
    renderAlertLogs();
}

function openTrackedPosition(symObj, tfObj, result, validity) {
    const duplicate = appState.activeTrades.find(t => t.symbolId === symObj.id && t.tfId === tfObj.id && t.direction === result.signal);
    if (duplicate) return;
    
    const entry = result.close;
    const atr = result.candles.length > 14 ? calculateATR(result.candles, 14)[result.candles.length - 1] : entry * 0.001;
    
    let sl = 0;
    let tp1 = 0;
    let tp2 = 0;
    
    if (result.signal === 'BUY') {
        sl = Math.min(result.struct.sLow, entry - 1.5 * atr);
        const risk = entry - sl;
        tp1 = entry + 2 * risk;
        tp2 = entry + 3 * risk;
    } else {
        sl = Math.max(result.struct.sHigh, entry + 1.5 * atr);
        const risk = sl - entry;
        tp1 = entry - 2 * risk;
        tp2 = entry - 3 * risk;
    }
    
    const newTrade = {
        id: 'trade_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        symbolId: symObj.id,
        symbol: symObj.name,
        tfId: tfObj.id,
        timeframe: tfObj.name,
        direction: result.signal,
        entry: entry,
        sl: sl,
        tp1: tp1,
        tp2: tp2,
        validity: validity,
        pattern: result.pattern,
        time: new Date().toLocaleTimeString(),
        status: 'active',
        pnl: 0,
        symType: symObj.type
    };
    
    appState.activeTrades.unshift(newTrade);
    saveTrades();
    renderTradeTracker();
}

function evaluateActivePositions(symbolId, tfId, result) {
    const currentPrice = result.close;
    let updated = false;
    
    appState.activeTrades = appState.activeTrades.filter(trade => {
        if (trade.symbolId !== symbolId || trade.tfId !== tfId) return true;
        
        let closed = false;
        let outcome = '';
        
        if (trade.direction === 'BUY') {
            if (currentPrice >= trade.tp2) {
                closed = true;
                outcome = 'WIN (1:3 TP2)';
            } else if (currentPrice >= trade.tp1) {
                closed = true;
                outcome = 'WIN (1:2 TP1)';
            } else if (currentPrice <= trade.sl) {
                closed = true;
                outcome = 'LOSS (SL)';
            }
        } else { // SELL
            if (currentPrice <= trade.tp2) {
                closed = true;
                outcome = 'WIN (1:3 TP2)';
            } else if (currentPrice <= trade.tp1) {
                closed = true;
                outcome = 'WIN (1:2 TP1)';
            } else if (currentPrice >= trade.sl) {
                closed = true;
                outcome = 'LOSS (SL)';
            }
        }
        
        if (closed) {
            trade.status = outcome;
            trade.exitPrice = currentPrice;
            trade.exitTime = new Date().toLocaleTimeString();
            appState.historyTrades.unshift(trade);
            playChime(outcome.startsWith('WIN') ? 'win' : 'loss');
            updated = true;
            return false;
        } else {
            trade.currentPrice = currentPrice;
            trade.pnl = trade.direction === 'BUY' ? (currentPrice - trade.entry) : (trade.entry - currentPrice);
            updated = true;
            return true;
        }
    });
    
    if (updated) {
        saveTrades();
        renderTradeTracker();
    }
}

function saveTrades() {
    localStorage.setItem('skfx_active_trades', JSON.stringify(appState.activeTrades));
    localStorage.setItem('skfx_history_trades', JSON.stringify(appState.historyTrades));
}

function loadTrades() {
    const active = localStorage.getItem('skfx_active_trades');
    const history = localStorage.getItem('skfx_history_trades');
    if (active) {
        try { appState.activeTrades = JSON.parse(active); } catch(e) {}
    }
    if (history) {
        try { appState.historyTrades = JSON.parse(history); } catch(e) {}
    }
}

function renderTradeTracker() {
    const listContainer = document.getElementById('tracker-list');
    const tabActive = document.getElementById('tab-active-trades');
    const tabHistory = document.getElementById('tab-history-trades');
    const statsEl = document.getElementById('history-stats');
    
    if (!listContainer || !tabActive || !tabHistory) return;
    
    tabActive.innerText = `Active (${appState.activeTrades.length})`;
    tabHistory.innerText = `History (${appState.historyTrades.length})`;
    
    const totalHistory = appState.historyTrades.length;
    if (totalHistory > 0) {
        const wins = appState.historyTrades.filter(t => t.status.startsWith('WIN')).length;
        const rate = ((wins / totalHistory) * 100).toFixed(0);
        statsEl.innerText = `Win Rate: ${rate}% (${wins}/${totalHistory})`;
    } else {
        statsEl.innerText = 'Win Rate: 0%';
    }
    
    if (appState.trackerTab === 'active') {
        tabActive.className = 'tracker-tab-btn active';
        tabHistory.className = 'tracker-tab-btn';
        
        if (appState.activeTrades.length === 0) {
            listContainer.innerHTML = '<div class="no-trades" style="color: var(--color-text-muted); font-size: 12px; text-align: center; padding: 20px;">No active trade positions tracked yet.</div>';
            return;
        }
        
        listContainer.innerHTML = appState.activeTrades.map(t => {
            const dec = t.symType === 'crypto' ? 2 : 5;
            const pnlVal = t.pnl || 0;
            const isProfit = pnlVal >= 0;
            const pnlClass = isProfit ? 'bull' : 'bear';
            const pnlSign = isProfit ? '+' : '';
            
            return `
                <div class="trade-card" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: white; font-size: 13px;">${t.symbol}</strong>
                            <span style="font-size: 11px; color: var(--color-text-muted); margin-left: 5px;">[${t.timeframe}]</span>
                            <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: 5px; background: ${t.direction === 'BUY' ? 'var(--color-bull-bg)' : 'var(--color-bear-bg)'}; color: ${t.direction === 'BUY' ? 'var(--color-bull)' : 'var(--color-bear)'};">${t.direction}</span>
                        </div>
                        <div style="font-size: 11px; font-weight: 700; background: rgba(101, 31, 255, 0.15); border: 1px solid var(--color-accent); color: #c09fff; padding: 2px 6px; border-radius: 4px;">
                            ${t.validity}% Valid
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center; font-size: 10px;">
                        <div>
                            <div style="color: var(--color-text-muted);">Entry</div>
                            <div style="color: white; font-weight:600;">${t.entry.toFixed(dec)}</div>
                        </div>
                        <div>
                            <div style="color: var(--color-text-muted);">SL</div>
                            <div style="color: var(--color-bear); font-weight:600;">${t.sl.toFixed(dec)}</div>
                        </div>
                        <div>
                            <div style="color: var(--color-text-muted);">TP1 (1:2)</div>
                            <div style="color: var(--color-bull); font-weight:600;">${t.tp1.toFixed(dec)}</div>
                        </div>
                        <div>
                            <div style="color: var(--color-text-muted);">TP2 (1:3)</div>
                            <div style="color: var(--color-bull); font-weight:600;">${t.tp2.toFixed(dec)}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 6px; font-size: 11px;">
                        <div style="color: var(--color-text-secondary);">Live: <strong style="color: white;">${(t.currentPrice || t.entry).toFixed(dec)}</strong></div>
                        <div class="value ${pnlClass}" style="font-weight: 800;">
                            PnL: ${pnlSign}${pnlVal.toFixed(dec)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        tabActive.className = 'tracker-tab-btn';
        tabHistory.className = 'tracker-tab-btn active';
        
        if (appState.historyTrades.length === 0) {
            listContainer.innerHTML = '<div class="no-trades" style="color: var(--color-text-muted); font-size: 12px; text-align: center; padding: 20px;">No trade history logged yet.</div>';
            return;
        }
        
        listContainer.innerHTML = appState.historyTrades.map(t => {
            const dec = t.symType === 'crypto' ? 2 : 5;
            const isWin = t.status.startsWith('WIN');
            const outcomeClass = isWin ? 'bull' : 'bear';
            
            return `
                <div class="trade-card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px; margin-bottom: 8px; font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: white;">${t.symbol}</strong>
                            <span style="font-size: 10px; color: var(--color-text-muted);">[${t.timeframe}]</span>
                            <span style="font-size: 9px; padding: 1px 4px; border-radius: 3px; background: ${t.direction === 'BUY' ? 'var(--color-bull-bg)' : 'var(--color-bear-bg)'}; color: ${t.direction === 'BUY' ? 'var(--color-bull)' : 'var(--color-bear)'};">${t.direction}</span>
                        </div>
                        <strong class="value ${outcomeClass}" style="font-size: 11px; text-transform: uppercase;">
                            ${t.status}
                        </strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: 10px;">
                        <span>Entry: <strong style="color: white;">${t.entry.toFixed(dec)}</strong></span>
                        <span>Exit: <strong style="color: white;">${t.exitPrice.toFixed(dec)}</strong></span>
                        <span>Val: <strong style="color: #c09fff;">${t.validity}%</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: 9px; border-top: 1px solid rgba(255,255,255,0.02); padding-top: 4px;">
                        <span>${t.pattern}</span>
                        <span>Exit Time: ${t.exitTime}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderAlertLogs() {
    const container = document.getElementById('alerts-log');
    const filter = document.getElementById('alert-type-filter')?.value || 'all';
    const selectedOnly = document.getElementById('alert-selected-only')?.checked || false;
    
    // Find current active symbol name (e.g. BTCUSD, XAUUSD)
    const activeSymObj = SYMBOLS.find(s => s.id === appState.selectedSymbol);
    const activeName = activeSymObj ? activeSymObj.name : '';
    
    const filteredLogs = appState.alertLogs.filter(log => {
        if (selectedOnly && log.symbol !== activeName) return false;
        if (filter === 'all') return true;
        if (filter === 'entries') return log.kind === 'entry';
        if (filter === 'sweeps') return log.kind === 'sweep';
        if (filter === 'session') return log.kind === 'session';
        return true;
    });
    
    if (filteredLogs.length === 0) {
        container.innerHTML = '<div class="no-alerts">No active signals match the selected filter. Scanning markets...</div>';
        return;
    }
    
    container.innerHTML = filteredLogs.map(log => {
        const isBullish = log.type === 'BUY' || log.type === 'BULL SWEEP';
        const isSessionSweep = log.kind === 'session';
        const itemClass = isSessionSweep ? 'session-sweep' : (isBullish ? 'bullish' : 'bearish');
        
        let headerText = '';
        if (isSessionSweep) {
            const sweepIcon = isBullish ? '▲' : '▼';
            headerText = `<strong style="color: #f59e0b;">${sweepIcon} ${log.type}</strong>
                <span style="font-size:10px; font-weight:700; color:#f59e0b; margin-left:6px; padding:1px 6px; border: 1px solid rgba(245,158,11,0.4); border-radius:3px; background:rgba(245,158,11,0.1);">
                    ⚡ ${log.sessionName} SESSION
                </span>`;
        } else if (log.kind === 'entry') {
            headerText = `<strong>${log.type} Entry <span style="font-size:10px; font-weight:700; color:#c09fff; margin-left:4px; padding:1px 4px; border: 1px solid rgba(192,159,255,0.3); border-radius:3px; background:rgba(101,31,255,0.1);">${log.validity}% Valid</span></strong>`;
        } else {
            headerText = `<strong style="background: rgba(101, 31, 255, 0.15); border: 1px solid var(--color-accent); color: #c09fff; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${log.type}</strong>`;
        }
        
        return `
            <div class="alert-item ${itemClass}">
                <div class="alert-details">
                    <div class="alert-main ${isBullish ? '' : 'bearish'}">
                        <span class="sym">${log.symbol}</span>
                        <span>[${log.timeframe}]</span>
                        ${headerText}
                    </div>
                    <div class="alert-sub">
                        ${log.pattern} at price ${log.price}
                    </div>
                </div>
                <div class="alert-time">${log.time}</div>
            </div>
        `;
    }).join('');
}

// --- UI SYNC & RENDERERS ---

function updateBiasDisplay(symbolId) {
    const cell = document.getElementById(`bias_${symbolId}`);
    if (!cell) return;
    
    const dailyData = appState.matrixData[`${symbolId}_1d`];
    const weeklyData = appState.matrixData[`${symbolId}_1wk`];
    
    let dText = 'D: -';
    let dStyle = 'color: var(--color-text-muted); background: rgba(255,255,255,0.03); border: 1px solid transparent;';
    if (dailyData && dailyData.bias) {
        const isBull = dailyData.bias === 'BULL';
        dText = `D: ${dailyData.bias === 'BULL' ? 'BULL' : 'BEAR'}`;
        dStyle = isBull ? 'color: var(--color-bull); background: var(--color-bull-bg); border: 1px solid rgba(0,230,118,0.25);' : 'color: var(--color-bear); background: var(--color-bear-bg); border: 1px solid rgba(255,23,68,0.25);';
    }
    
    let wText = 'W: -';
    let wStyle = 'color: var(--color-text-muted); background: rgba(255,255,255,0.03); border: 1px solid transparent;';
    if (weeklyData && weeklyData.bias) {
        const isBull = weeklyData.bias === 'BULL';
        wText = `W: ${weeklyData.bias === 'BULL' ? 'BULL' : 'BEAR'}`;
        wStyle = isBull ? 'color: var(--color-bull); background: var(--color-bull-bg); border: 1px solid rgba(0,230,118,0.25);' : 'color: var(--color-bear); background: var(--color-bear-bg); border: 1px solid rgba(255,23,68,0.25);';
    }
    
    cell.innerHTML = `
        <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
            <span style="padding:2px 6px; border-radius:4px; font-weight:800; font-size:10px; ${dStyle}">${dText}</span>
            <span style="padding:2px 6px; border-radius:4px; font-weight:800; font-size:10px; ${wStyle}">${wText}</span>
        </div>
    `;
}

function initializeMatrixTable() {
    const header = document.getElementById('matrix-header');
    const tbody = document.getElementById('matrix-body');
    
    // Injects headers including Bias column
    header.innerHTML = '<th>Asset</th><th style="text-align:center">HTF Bias</th>' + TIMEFRAMES.filter(t => config.enabledTimeframes.includes(t.id)).map(t => `
        <th style="text-align:center">${t.name}</th>
    `).join('');
    
    // Injects rows based on active symbols and category tabs
    const filteredSymbols = SYMBOLS.filter(s => {
        if (!config.enabledSymbols.includes(s.id)) return false;
        if (appState.activeTab === 'all') return true;
        return s.type === appState.activeTab;
    });
    
    tbody.innerHTML = filteredSymbols.map(s => {
        const tfCells = TIMEFRAMES.filter(t => config.enabledTimeframes.includes(t.id)).map(t => {
            const key = `${s.id}_${t.id}`;
            return `
                <td class="grid-cell-state" data-symbol="${s.id}" data-tf="${t.id}" id="cell_${key}">
                    <div class="cell-inner">
                        <span class="cell-tf-label">${t.name}</span>
                        <span class="cell-signal-text">-</span>
                        <div class="dot-indicators">
                            <span class="indicator-dot"></span>
                            <span class="indicator-dot"></span>
                            <span class="indicator-dot"></span>
                            <span class="indicator-dot"></span>
                        </div>
                    </div>
                </td>
            `;
        }).join('');
        
        return `
            <tr id="row_${s.id}">
                <td>
                    <div class="asset-cell-name" onclick="selectAsset('${s.id}')">
                        ${s.name}
                        <span class="asset-type-badge badge-${s.type}">${s.type}</span>
                    </div>
                </td>
                <td id="bias_${s.id}" style="text-align:center; padding: 12px 6px;">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                        <span style="padding:2px 6px; border-radius:4px; font-weight:800; font-size:10px; color: var(--color-text-muted); background: rgba(255,255,255,0.03);">D: -</span>
                        <span style="padding:2px 6px; border-radius:4px; font-weight:800; font-size:10px; color: var(--color-text-muted); background: rgba(255,255,255,0.03);">W: -</span>
                    </div>
                </td>
                ${tfCells}
            </tr>
        `;
    }).join('');
    
    // Add Click listener to all cells
    document.querySelectorAll('.grid-cell-state').forEach(cell => {
        cell.addEventListener('click', () => {
            const sym = cell.getAttribute('data-symbol');
            const tf = cell.getAttribute('data-tf');
            selectCell(sym, tf);
        });
    });
    
    // Populate with cached data
    filteredSymbols.forEach(s => {
        updateBiasDisplay(s.id);
        TIMEFRAMES.filter(t => config.enabledTimeframes.includes(t.id)).forEach(t => {
            updateMatrixCell(s.id, t.id);
        });
    });
}

function updateMatrixCell(symbolId, tfId) {
    const key = `${symbolId}_${tfId}`;
    const cell = document.getElementById(`cell_${key}`);
    if (!cell) return;
    
    const data = appState.matrixData[key];
    const inner = cell.querySelector('.cell-inner');
    const signalText = cell.querySelector('.cell-signal-text');
    const dots = cell.querySelectorAll('.indicator-dot');
    
    if (tfId === '1d' || tfId === '1wk') {
        updateBiasDisplay(symbolId);
    }
    
    if (!data) {
        inner.className = 'cell-inner';
        signalText.innerText = '-';
        return;
    }
    
    // Reset Classes
    inner.className = 'cell-inner';
    
    // Render signal status
    if (data.signal === 'BUY') {
        inner.classList.add('state-bull-signal');
        signalText.innerText = 'BUY';
    } else if (data.signal === 'SELL') {
        inner.classList.add('state-bear-signal');
        signalText.innerText = 'SELL';
    } else {
        signalText.innerText = 'WAIT';
    }
    
    // Small indicators dots mapping
    // Dot 0: Structure direction (2=bull, 1=bear)
    if (data.struct.sDir === 2) {
        dots[0].className = 'indicator-dot active-bull';
    } else if (data.struct.sDir === 1) {
        dots[0].className = 'indicator-dot active-bear';
    } else {
        dots[0].className = 'indicator-dot';
    }
    
    // Dot 1: OTE Retracement (active if ote > 0)
    if (data.struct.ote > 0) {
        dots[1].className = 'indicator-dot active-touch';
    } else {
        dots[1].className = 'indicator-dot';
    }
    
    // Dot 2: Order Block (1/3=bullish, 2/4=bearish)
    if (data.ob === 1 || data.ob === 3) {
        dots[2].className = 'indicator-dot active-bull';
    } else if (data.ob === 2 || data.ob === 4) {
        dots[2].className = 'indicator-dot active-bear';
    } else {
        dots[2].className = 'indicator-dot';
    }
    
    // Dot 3: Fair Value Gap (1=buy, 2=sell, 3=both)
    if (data.fvg === 1) {
        dots[3].className = 'indicator-dot active-bull';
    } else if (data.fvg === 2) {
        dots[3].className = 'indicator-dot active-bear';
    } else if (data.fvg === 3) {
        dots[3].className = 'indicator-dot active-touch';
    } else {
        dots[3].className = 'indicator-dot';
    }
}

function updateDetailPanel() {
    const symbolId = appState.selectedSymbol;
    const tfId = appState.selectedTimeframe;
    const key = `${symbolId}_${tfId}`;
    
    const symObj = SYMBOLS.find(s => s.id === symbolId);
    const tfObj = TIMEFRAMES.find(t => t.id === tfId);
    
    document.getElementById('selected-asset-badge').innerText = `${symObj.name} ${tfObj.name}`;
    
    const data = appState.matrixData[key];
    
    // Elements references
    const priceEl = document.getElementById('metric-price').querySelector('.value');
    const structEl = document.getElementById('metric-structure').querySelector('.value');
    const oteEl = document.getElementById('metric-ote').querySelector('.value');
    const obEl = document.getElementById('metric-ob').querySelector('.value');
    const fvgEl = document.getElementById('metric-fvg').querySelector('.value');
    const sweepEl = document.getElementById('metric-sweep').querySelector('.value');
    const patternEl = document.getElementById('metric-pattern').querySelector('.value');
    const dValEl = document.getElementById('metric-daily-bias').querySelector('.value');
    const wValEl = document.getElementById('metric-weekly-bias').querySelector('.value');
    
    // Sync Higher Timeframe Bias
    const dailyData = appState.matrixData[`${symbolId}_1d`];
    const weeklyData = appState.matrixData[`${symbolId}_1wk`];
    
    if (dailyData && dailyData.bias) {
        dValEl.innerText = dailyData.bias === 'BULL' ? 'BULLISH' : 'BEARISH';
        dValEl.className = dailyData.bias === 'BULL' ? 'value bull' : 'value bear';
    } else {
        dValEl.innerText = 'NO DATA';
        dValEl.className = 'value neutral';
    }
    
    if (weeklyData && weeklyData.bias) {
        wValEl.innerText = weeklyData.bias === 'BULL' ? 'BULLISH' : 'BEARISH';
        wValEl.className = weeklyData.bias === 'BULL' ? 'value bull' : 'value bear';
    } else {
        wValEl.innerText = 'NO DATA';
        wValEl.className = 'value neutral';
    }
    
    if (!data) {
        priceEl.innerText = '-';
        [structEl, oteEl, obEl, fvgEl, sweepEl, patternEl].forEach(el => {
            el.innerText = 'NO DATA';
            el.className = 'value neutral';
        });
        return;
    }
    
    // Price UI Sync
    priceEl.innerText = data.close.toFixed(symObj.type === 'crypto' ? 2 : 5);
    
    // Structure UI Sync
    if (data.struct.sDir === 2) {
        structEl.innerText = 'BULLISH';
        structEl.className = 'value bull';
    } else if (data.struct.sDir === 1) {
        structEl.innerText = 'BEARISH';
        structEl.className = 'value bear';
    } else {
        structEl.innerText = '-';
        structEl.className = 'value neutral';
    }
    
    // OTE UI Sync
    if (data.struct.ote === 1) {
        oteEl.innerText = '0.618 ZONE';
        oteEl.className = 'value bull';
    } else if (data.struct.ote === 2) {
        oteEl.innerText = '0.705 ZONE';
        oteEl.className = 'value bull';
    } else if (data.struct.ote === 3) {
        oteEl.innerText = '0.786 ZONE';
        oteEl.className = 'value bull';
    } else {
        oteEl.innerText = 'NONE';
        oteEl.className = 'value neutral';
    }
    
    // OB UI Sync
    if (data.ob === 1) {
        obEl.innerText = 'DEMAND OB';
        obEl.className = 'value bull';
    } else if (data.ob === 2) {
        obEl.innerText = 'SUPPLY OB';
        obEl.className = 'value bear';
    } else if (data.ob === 3) {
        obEl.innerText = 'DEMAND TOUCH';
        obEl.className = 'value touch';
    } else if (data.ob === 4) {
        obEl.innerText = 'SUPPLY TOUCH';
        obEl.className = 'value touch';
    } else {
        obEl.innerText = 'NONE';
        obEl.className = 'value neutral';
    }
    
    // FVG UI Sync
    if (data.fvg === 1) {
        fvgEl.innerText = 'BUY FVG HIT';
        fvgEl.className = 'value bull';
    } else if (data.fvg === 2) {
        fvgEl.innerText = 'SELL FVG HIT';
        fvgEl.className = 'value bear';
    } else if (data.fvg === 3) {
        fvgEl.innerText = 'BOTH FVG';
        fvgEl.className = 'value touch';
    } else {
        fvgEl.innerText = 'NONE';
        fvgEl.className = 'value neutral';
    }
    
    // Sweep UI Sync
    if (data.sweep === 2) {
        sweepEl.innerText = 'BULL SWEEP';
        sweepEl.className = 'value bull';
    } else if (data.sweep === 0) {
        sweepEl.innerText = 'BEAR SWEEP';
        sweepEl.className = 'value bear';
    } else {
        sweepEl.innerText = 'NONE';
        sweepEl.className = 'value neutral';
    }
    
    // Pattern UI Sync
    if (data.signal !== 'none') {
        patternEl.innerText = `${data.signal}: ${data.pattern}`;
        patternEl.className = data.signal === 'BUY' ? 'value bull' : 'value bear';
    } else {
        patternEl.innerText = 'NONE';
        patternEl.className = 'value neutral';
    }
}

// --- TRADINGVIEW CHART SYNC ---
function selectCell(symbolId, tfId) {
    appState.selectedSymbol = symbolId;
    appState.selectedTimeframe = tfId;
    
    // Add border focus to cell
    document.querySelectorAll('.grid-cell-state').forEach(c => c.classList.remove('selected-focus'));
    const cell = document.getElementById(`cell_${symbolId}_${tfId}`);
    if (cell) cell.classList.add('selected-focus');
    
    // Update external link
    const tvSym = getTradingViewSymbol(symbolId);
    const tvTf = getTradingViewTimeframe(tfId);
    const extLink = document.getElementById('chart-external');
    if (extLink) {
        extLink.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}&interval=${tvTf}`;
    }
    
    updateDetailPanel();
    loadTradingViewWidget(symbolId, tfId);
    renderAlertLogs(); // Update the alerts view if filtering active pair
}

function selectAsset(symbolId) {
    selectCell(symbolId, appState.selectedTimeframe);
}

function getTradingViewSymbol(symbolId) {
    if (symbolId === 'XAUUSD=X') return 'OANDA:XAUUSD';
    if (symbolId === 'XAGUSD=X') return 'OANDA:XAGUSD';
    if (symbolId === 'BTC-USD') return 'BINANCE:BTCUSDT';
    if (symbolId === 'ETH-USD') return 'BINANCE:ETHUSDT';
    if (symbolId.endsWith('=X')) {
        const pair = symbolId.replace('=X', '');
        return `FX:${pair}`;
    }
    if (symbolId === 'NQ=F') return 'CME_MINI:NQ1!';
    if (symbolId === 'YM=F') return 'CBOT:YM1!';
    return symbolId;
}

function getTradingViewTimeframe(tfId) {
    if (tfId === '5m') return '5';
    if (tfId === '15m') return '15';
    if (tfId === '30m') return '30';
    if (tfId === '1h') return '60';
    if (tfId === '4h') return '240';
    if (tfId === '1d') return 'D';
    if (tfId === '1wk') return 'W';
    if (tfId === '1mo') return 'M';
    return '15';
}

function loadTradingViewWidget(symbolId, tfId) {
    let tvSym = getTradingViewSymbol(symbolId);
    const tvTf = getTradingViewTimeframe(tfId);
    
    // Explicit safety override: Gold must always be OANDA feed
    if (symbolId === 'XAUUSD=X') tvSym = 'OANDA:XAUUSD';
    if (symbolId === 'XAGUSD=X') tvSym = 'OANDA:XAGUSD';
    
    // Clean widget container first
    document.getElementById('tv-chart-container').innerHTML = '<div id="tv-widget-box" style="height:100%;width:100%"></div>';
    
    try {
        appState.tvWidget = new TradingView.widget({
            "autosize": true,
            "symbol": tvSym,
            "interval": tvTf,
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#0d121c",
            "enable_publishing": false,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "container_id": "tv-widget-box",
            "withdateranges": true,
            "show_popup_button": true,
            "studies": [] // Clean start so users can search & add any indicators
        });
    } catch (e) {
        console.error("TradingView widget load failed:", e);
    }
}

// --- SETTINGS DRAWER CONTROLLERS ---

function loadSettings() {
    const saved = localStorage.getItem('skm_dashboard_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            config = { ...config, ...parsed };
        } catch(e) {
            console.error("Config load error:", e);
        }
    }
    // Always guarantee XAUUSD is included and at the top of enabledSymbols
    if (!config.enabledSymbols.includes('XAUUSD=X')) {
        config.enabledSymbols.unshift('XAUUSD=X');
    } else {
        // Move it to first position
        config.enabledSymbols = ['XAUUSD=X', ...config.enabledSymbols.filter(s => s !== 'XAUUSD=X')];
    }
    // Always start on XAUUSD
    appState.selectedSymbol = 'XAUUSD=X';
}

function saveSettings() {
    localStorage.setItem('skm_dashboard_config', JSON.stringify(config));
}

function setupSettingsUI() {
    // Populate form fields
    document.getElementById('pivot-lookback').value = config.pivotLookback;
    document.getElementById('body-break').checked = config.bodyBreak;
    document.getElementById('sound-alerts-enabled').checked = config.soundAlerts;
    
    // Render Timeframe checklists
    const tfCont = document.getElementById('timeframes-container');
    if (tfCont) {
        tfCont.innerHTML = TIMEFRAMES.map(t => {
            const checked = config.enabledTimeframes.includes(t.id) ? 'checked' : '';
            return `
                <label>
                    <input type="checkbox" name="timeframes-check" value="${t.id}" ${checked}>
                    ${t.name}
                </label>
            `;
        }).join('');
    }
    
    // Render Symbol checklists
    const cryptoCont = document.getElementById('symbols-crypto-container');
    const forexCont = document.getElementById('symbols-forex-container');
    const indicesCont = document.getElementById('symbols-indices-container');
    
    cryptoCont.innerHTML = '';
    forexCont.innerHTML = '';
    indicesCont.innerHTML = '';
    
    SYMBOLS.forEach(s => {
        const checked = config.enabledSymbols.includes(s.id) ? 'checked' : '';
        const itemHtml = `
            <label>
                <input type="checkbox" name="symbols-check" value="${s.id}" ${checked}>
                ${s.name}
            </label>
        `;
        
        if (s.type === 'crypto') cryptoCont.insertAdjacentHTML('beforeend', itemHtml);
        else if (s.type === 'forex') forexCont.insertAdjacentHTML('beforeend', itemHtml);
        else indicesCont.insertAdjacentHTML('beforeend', itemHtml);
    });
}

function applyFormSettings(e) {
    e.preventDefault();
    
    config.pivotLookback = parseInt(document.getElementById('pivot-lookback').value) || 10;
    config.bodyBreak = document.getElementById('body-break').checked;
    config.soundAlerts = document.getElementById('sound-alerts-enabled').checked;
    
    // Collect Checked Symbols
    const symChecks = document.querySelectorAll('input[name="symbols-check"]:checked');
    config.enabledSymbols = Array.from(symChecks).map(c => c.value);
    
    // Collect Checked Timeframes
    const tfChecks = document.querySelectorAll('input[name="timeframes-check"]:checked');
    config.enabledTimeframes = Array.from(tfChecks).map(c => c.value);
    
    saveSettings();
    closeSettings();
    
    // Reinitialize and Scan
    initializeMatrixTable();
    queueFullScan();
}

// Drawer Open/Close
function openSettings() {
    document.getElementById('settings-drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
}

function closeSettings() {
    document.getElementById('settings-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
}

// --- EVENT BINDINGS & INIT ---

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadTrades();
    setupSettingsUI();
    initializeMatrixTable();
    renderTradeTracker();
    
    // Button bindings
    document.getElementById('settings-toggle').addEventListener('click', openSettings);
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('drawer-overlay').addEventListener('click', closeSettings);
    document.getElementById('settings-form').addEventListener('submit', applyFormSettings);
    
    // Position Tracker Tab bindings
    const activeTabBtn = document.getElementById('tab-active-trades');
    const historyTabBtn = document.getElementById('tab-history-trades');
    if (activeTabBtn && historyTabBtn) {
        activeTabBtn.addEventListener('click', () => {
            appState.trackerTab = 'active';
            renderTradeTracker();
        });
        historyTabBtn.addEventListener('click', () => {
            appState.trackerTab = 'history';
            renderTradeTracker();
        });
    }

    // Full screen chart button binding
    const fsBtn = document.getElementById('chart-fullscreen');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            const chartCard = document.getElementById('chart-card-element');
            if (!document.fullscreenElement) {
                chartCard.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Keep fullscreen button icon in sync
    document.addEventListener('fullscreenchange', () => {
        const btn = document.getElementById('chart-fullscreen');
        if (btn) {
            if (document.fullscreenElement) {
                btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            } else {
                btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            }
        }
    });
    
    document.getElementById('clear-alerts').addEventListener('click', () => {
        appState.alertLogs = [];
        renderAlertLogs();
    });
    
    const alertFilter = document.getElementById('alert-type-filter');
    if (alertFilter) {
        alertFilter.addEventListener('change', renderAlertLogs);
    }
    
    const selectedOnlyFilter = document.getElementById('alert-selected-only');
    if (selectedOnlyFilter) {
        selectedOnlyFilter.addEventListener('change', renderAlertLogs);
    }
    
    document.getElementById('sound-toggle').addEventListener('click', () => {
        config.soundAlerts = !config.soundAlerts;
        document.getElementById('sound-alerts-enabled').checked = config.soundAlerts;
        saveSettings();
        
        const btn = document.getElementById('sound-toggle');
        if (config.soundAlerts) {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btn.classList.add('active');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btn.classList.remove('active');
        }
    });
    
    // Tab filters
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.activeTab = btn.getAttribute('data-filter');
            initializeMatrixTable();
        });
    });
    
    // Sound Button Initial State
    if (config.soundAlerts) {
        document.getElementById('sound-toggle').classList.add('active');
    } else {
        document.getElementById('sound-toggle').innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
    
    // Select default active asset on launch
    selectCell(appState.selectedSymbol, appState.selectedTimeframe);
    
    // Initial fetch scan
    queueFullScan();
    
    // Interval schedules (Refreshes grid active items every 30 seconds)
    setInterval(() => {
        queueFullScan();
    }, 30000);
});
