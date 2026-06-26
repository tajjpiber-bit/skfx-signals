// ==========================================================================
// SKFX SIGNALS APP - APPLICATION ENGINE
// Replicates Pine Script Logic for multi-asset scanning and confirmation signals
// Sourced from Yahoo Finance API via CORS proxies
// ==========================================================================

// --- CONFIG & CONSTANTS ---
const SYMBOLS = [
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
    { id: 'XAUUSD=X', name: 'XAUUSD', type: 'commodities' },
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
    enabledSymbols: ['BTC-USD', 'ETH-USD', 'EURUSD=X', 'GBPUSD=X', 'NQ=F', 'YM=F', 'XAUUSD=X', 'XAGUSD=X'],
    enabledTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d', '1wk', '1mo']
};

// State Store
let appState = {
    selectedSymbol: 'BTC-USD',
    selectedTimeframe: '15m',
    currentFilter: 'all',
    activeTab: 'all',
    tvWidget: null,
    fetchQueue: [],
    isFetching: false,
    matrixData: {}, // Key: symbol_tf, Value: analysis results
    alertLogs: []
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
    throw lastError || new Error("Failed to fetch via all proxy endpoints.");
}

async function fetchCandleData(symbol, tfObj) {
    const isH4 = tfObj.id === '4h';
    const interval = isH4 ? '60m' : tfObj.interval;
    const range = tfObj.range;
    
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    
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
    
    // Bullish OB: low[3] < low[4] and low[3] < low[2] and close > high[3]
    const isBullOB = candles[N-4].low < candles[N-5].low && 
                     candles[N-4].low < candles[N-3].low && 
                     candles[N-1].close > candles[N-4].high;
                     
    // Bearish OB: high[3] > high[4] and high[3] > high[2] and close < low[3]
    const isBearOB = candles[N-4].high > candles[N-5].high && 
                     candles[N-4].high > candles[N-3].high && 
                     candles[N-1].close < candles[N-4].low;
                     
    // Touches OB range check
    const isTouchBull = isBullOB && candles[N-1].close >= candles[N-4].low && candles[N-1].close <= candles[N-4].high;
    const isTouchBear = isBearOB && candles[N-1].close >= candles[N-4].low && candles[N-1].close <= candles[N-4].high;
    
    if (isTouchBull) return 3;
    if (isTouchBear) return 4;
    if (isBullOB) return 1;
    if (isBearOB) return 2;
    return 0;
}

function calculateFVG(candles, atrArray) {
    const N = candles.length;
    if (N < 6) return 0;
    const atr = atrArray[N-1];
    
    let bHit = false;
    let sHit = false;
    
    // Bullish Gaps
    if (candles[N-2].low > candles[N-4].high && (candles[N-2].low - candles[N-4].high) >= atr * 0.5) {
        if (candles[N-1].close >= candles[N-4].high && candles[N-1].close <= candles[N-2].low) {
            bHit = true;
        }
    }
    if (candles[N-3].low > candles[N-5].high && (candles[N-3].low - candles[N-5].high) >= atr * 0.5) {
        if (candles[N-1].close >= candles[N-5].high && candles[N-1].close <= candles[N-3].low) {
            bHit = true;
        }
    }
    
    // Bearish Gaps
    if (candles[N-2].high < candles[N-4].low && (candles[N-4].low - candles[N-2].high) >= atr * 0.5) {
        if (candles[N-1].close <= candles[N-4].low && candles[N-1].close >= candles[N-2].high) {
            sHit = true;
        }
    }
    if (candles[N-3].high < candles[N-5].low && (candles[N-5].low - candles[N-3].high) >= atr * 0.5) {
        if (candles[N-1].close <= candles[N-5].low && candles[N-1].close >= candles[N-3].high) {
            sHit = true;
        }
    }
    
    if (bHit && sHit) return 3;
    if (bHit) return 1;
    if (sHit) return 2;
    return 0;
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
    }
    
    if (isBearZone) {
        if (isBearEngulfing) return { signal: 'SELL', pattern: 'Bearish Engulfing' };
        if (isShootingStar) return { signal: 'SELL', pattern: 'Shooting Star / Pin Bar' };
        if (sweep === 0) return { signal: 'SELL', pattern: 'Bearish Sweep' };
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
    
    return {
        candles: closedCandles,
        struct,
        ob,
        fvg,
        sweep,
        signal: confirm.signal,
        pattern: confirm.pattern,
        close: closedCandles[N - 1].close
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

// --- ALERTS ENGINE ---
function triggerAlert(symObj, tfObj, result, alertKind = 'entry') {
    const alert = {
        time: new Date().toLocaleTimeString(),
        symbol: symObj.name,
        timeframe: tfObj.name,
        kind: alertKind, // 'entry' or 'sweep'
        type: alertKind === 'entry' ? result.signal : (result.sweep === 2 ? 'BULL SWEEP' : 'BEAR SWEEP'),
        pattern: alertKind === 'entry' ? result.pattern : (result.sweep === 2 ? 'Bullish Liquidity Sweep' : 'Bearish Liquidity Sweep'),
        price: result.close.toFixed(symObj.type === 'crypto' ? 2 : 5)
    };
    
    appState.alertLogs.unshift(alert);
    
    // Play Web Audio Sound
    const isBullish = alert.type === 'BUY' || alert.type === 'BULL SWEEP';
    playSignalSound(isBullish);
    
    // Render Alert Log
    renderAlertLogs();
}

function renderAlertLogs() {
    const container = document.getElementById('alerts-log');
    const filter = document.getElementById('alert-type-filter')?.value || 'all';
    
    const filteredLogs = appState.alertLogs.filter(log => {
        if (filter === 'all') return true;
        if (filter === 'entries') return log.kind === 'entry';
        if (filter === 'sweeps') return log.kind === 'sweep';
        return true;
    });
    
    if (filteredLogs.length === 0) {
        container.innerHTML = '<div class="no-alerts">No active signals match the selected filter. Scanning markets...</div>';
        return;
    }
    
    container.innerHTML = filteredLogs.map(log => {
        const isBullish = log.type === 'BUY' || log.type === 'BULL SWEEP';
        const itemClass = isBullish ? 'bullish' : 'bearish';
        
        let headerText = '';
        if (log.kind === 'entry') {
            headerText = `<strong>${log.type} Entry</strong>`;
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

function initializeMatrixTable() {
    const header = document.getElementById('matrix-header');
    const tbody = document.getElementById('matrix-body');
    
    // Injects headers
    header.innerHTML = '<th>Asset</th>' + TIMEFRAMES.filter(t => config.enabledTimeframes.includes(t.id)).map(t => `
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
    const structEl = document.getElementById('metric-structure').querySelector('.value');
    const oteEl = document.getElementById('metric-ote').querySelector('.value');
    const obEl = document.getElementById('metric-ob').querySelector('.value');
    const fvgEl = document.getElementById('metric-fvg').querySelector('.value');
    const sweepEl = document.getElementById('metric-sweep').querySelector('.value');
    const patternEl = document.getElementById('metric-pattern').querySelector('.value');
    
    if (!data) {
        [structEl, oteEl, obEl, fvgEl, sweepEl, patternEl].forEach(el => {
            el.innerText = 'NO DATA';
            el.className = 'value neutral';
        });
        return;
    }
    
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
    
    updateDetailPanel();
    loadTradingViewWidget(symbolId, tfId);
}

function selectAsset(symbolId) {
    selectCell(symbolId, appState.selectedTimeframe);
}

function getTradingViewSymbol(symbolId) {
    if (symbolId === 'BTC-USD') return 'BINANCE:BTCUSDT';
    if (symbolId === 'ETH-USD') return 'BINANCE:ETHUSDT';
    if (symbolId.endsWith('=X')) {
        const pair = symbolId.replace('=X', '');
        return `FX:${pair}`;
    }
    if (symbolId === 'NQ=F') return 'CME_MINI:NQ1!';
    if (symbolId === 'YM=F') return 'CBOT:YM1!';
    if (symbolId === 'XAUUSD=X') return 'OANDA:XAUUSD';
    if (symbolId === 'XAGUSD=X') return 'OANDA:XAGUSD';
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
    const tvSym = getTradingViewSymbol(symbolId);
    const tvTf = getTradingViewTimeframe(tfId);
    
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
            "studies": [
                "MASimple@tv-basicstudies"
            ]
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
            config = JSON.parse(saved);
        } catch(e) {
            console.error("Config load error:", e);
        }
    }
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
    setupSettingsUI();
    initializeMatrixTable();
    
    // Button bindings
    document.getElementById('settings-toggle').addEventListener('click', openSettings);
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('drawer-overlay').addEventListener('click', closeSettings);
    document.getElementById('settings-form').addEventListener('submit', applyFormSettings);
    
    document.getElementById('clear-alerts').addEventListener('click', () => {
        appState.alertLogs = [];
        renderAlertLogs();
    });
    
    const alertFilter = document.getElementById('alert-type-filter');
    if (alertFilter) {
        alertFilter.addEventListener('change', renderAlertLogs);
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
    
    // Interval schedules (Refreshes grid active items every 2 minutes)
    setInterval(() => {
        queueFullScan();
    }, 120000);
});
