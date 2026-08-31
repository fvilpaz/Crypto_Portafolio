# Crypto_Portafolio — Mi Cartera Crypto

Mi Cartera Crypto is a live cryptocurrency portfolio tracker. It shows what you
**hold right now** and what it's **worth in real time**, pulling live prices from
CoinGecko. It covers current positions, DCA, staking, airdrops and the rotations
that shaped the portfolio.

🔗 **Live:** [portafoliocrypto.netlify.app](https://portafoliocrypto.netlify.app/)

---

## 📌 Purpose

Mi Cartera Crypto answers a simple question:

**What do I hold right now, and what is it worth today?**

It is the mirror image of its companion app, [Crypto_Trace](https://github.com/fvilpaz/Crypto_Trace),
which answers *"how much fiat have I invested over time?"*.

The two are separate **by design**:

- **Crypto_Trace** → fiat spending / cost basis. Keeps every coin you ever bought,
  even ones you no longer hold.
- **Mi Cartera Crypto** (this app) → current holdings, the result of crypto-to-crypto
  rotations, staking and airdrops. If you bought DOT and rotated it into ATOM, this
  app shows ATOM.

Because holdings are shaped by rotations (not just purchases), the two data sets
are intentionally not merged. The apps cross-link, nothing more.

---

## 🚀 Features

- Live portfolio valuation with prices from the CoinGecko API
- Total value + PnL hero, in **USD ⇄ EUR** (toggle)
- Summary cards: BTC+ETH core, Cosmos (ATOM+TIA) with a 35% concentration guard,
  monthly staking, airdrops
- **Distribution** doughnut chart (share per asset)
- **Evolution** chart over time
- **DCA** summary (€175/month plan)
- **Staking** breakdown (per-asset APR)
- **Airdrops** section (toggle)
- **Movements** table (buys, sells and rotations), searchable
- Collapsible sections + sticky section navigation
- Manual refresh + auto-refresh of live prices
- Installable as a **PWA** (offline-capable app shell via a service worker)
- Dark theme, responsive / mobile-friendly

---

## 🛠 Tech Stack

- HTML5
- CSS3 (Custom Properties, dark theme)
- Vanilla JavaScript
- [Chart.js](https://www.chartjs.org/) for the charts
- [CoinGecko API](https://www.coingecko.com/en/api) for live prices (keyless)
- Service Worker + Web App Manifest (installable, offline app shell)

---

## 💾 Data

Live **prices** come from CoinGecko at runtime. Your **holdings and movements**
currently live as seed data in `js/app.js` (the `portfolio` and `transactions`
arrays). No backend, no tracking, full privacy.

To change what you hold today, you edit those arrays and redeploy (a `git push`
now triggers an automatic Netlify deploy).

---

## 📈 Project Philosophy

Keep it lightweight, private and focused. This app is the **valuation** half of the
pair; [Crypto_Trace](https://github.com/fvilpaz/Crypto_Trace) is the **spend-tracking**
half. Each does one thing well and they link to each other.

---

## 🔮 Roadmap

- In-app editor: add / edit / delete positions and movements (buy, sell, rotation)
  without touching code
- `localStorage` persistence so you can update holdings from your phone, instantly
- Add brand-new coins via CoinGecko search (auto-resolves id, name and icon —
  e.g. type "usdc")
- JSON export / import for backup and moving data between devices

---
