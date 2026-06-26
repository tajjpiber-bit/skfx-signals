# SKFX Signals App - Smart Money concepts Dashboard Web Application

A premium, modern, serverless web dashboard that replicates the logic of your Pine Script indicator ("My Dashboard 8 Pairs BY SK"). It fetches live price data from Yahoo Finance and Binance APIs, scans for key market structures, and triggers entry signals when reversal candlestick confirmation patterns form inside key trade zones.

## Features
* **34 Assets Tracked**: 28 Forex Pairs, Gold (XAUUSD), Silver (XAGUSD), NASDAQ, US30, BTCUSD, and ETHUSD.
* **8 Timeframes Supported**: M5, M15, M30, H1, H4 (aggregated), Daily, Weekly, and Monthly.
* **Smart Money Indicators**: Replicates Market Structure Breakouts, OTE Fibonacci levels (0.618, 0.705, 0.786), Order Blocks (Supply/Demand touches), and Fair Value Gaps (FVG) with ATR filters.
* **Reversal Entry Confirmation System**: Filters signals to ONLY trigger when price is inside a key zone and forms a strong confirmation candle:
  * **Bullish Reversals (Buy)**: Bullish Sweep, Bullish Engulfing, or Hammer.
  * **Bearish Reversals (Sell)**: Bearish Sweep, Bearish Engulfing, or Shooting Star.
* **Interactive Charting**: Built-in TradingView widget that updates instantly when clicking any asset-timeframe cell.
* **Audio Alerts**: Real-time chime played through the Web Audio API on new signal triggers.
* **Fully Configurable**: Customizable lookback, body-break toggles, and asset selections saved directly to browser `localStorage`.

---

## How to Run Locally

You can run this dashboard locally on your computer with a simple web server. 

### Method 1: Python Live Server (Recommended)
If you have Python installed, open your command line, navigate to this project folder, and run:
```bash
python -m http.server 8000
```
Then open your browser and navigate to: `http://localhost:8000`

### Method 2: Node.js (http-server)
If you have Node/npm:
```bash
npx http-server . -p 8000
```
Then open: `http://localhost:8000`

---

## How to Upload to GitHub and Host for Free on GitHub Pages

Since this is a client-side only (serverless) HTML/CSS/JS application, you can host it permanently for free on **GitHub Pages**.

### Step 1: Create a GitHub Repository
1. Go to [GitHub.com](https://github.com) and log in.
2. Click **New** to create a new repository.
3. Name it `skm-dashboard`.
4. Leave it **Public** (required for free hosting).
5. Do NOT add a README, `.gitignore`, or license. Click **Create repository**.

### Step 2: Initialize Git and Push Code
Open your terminal (PowerShell or Git Bash) inside the `skm_dashboard` directory and run:

```bash
# Initialize local repository
git init

# Add all files to staging
git add .

# Create the initial commit
git commit -m "Deploy SKM Dashboard v1.0"

# Rename default branch to main
git branch -M main

# Link to your GitHub repository (replace with your actual URL)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/skm-dashboard.git

# Push the code to GitHub
git push -u origin main -f
```

### Step 3: Enable GitHub Pages
1. Go to your repository page on GitHub.
2. Click on **Settings** (tab on the top right).
3. On the left sidebar, click on **Pages**.
4. Under **Build and deployment** -> **Branch**, select `main` (instead of None).
5. Click **Save**.
6. Wait 1-2 minutes. GitHub will display a message: *"Your site is live at `https://YOUR_GITHUB_USERNAME.github.io/skm-dashboard/`"*.

Aap is link ko apne mobile ya doosre computer par save karke kahin se bhi dashboard live use kar sakte hain!
