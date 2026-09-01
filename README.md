# Crypto_Portafolio · Mi Cartera Crypto

Mi Cartera Crypto is a live cryptocurrency portfolio tracker. It shows what you
**hold right now** and what it's **worth in real time**, pulling live prices from
CoinGecko. It covers current positions, DCA, staking, airdrops and the rotations
that shaped the portfolio.

🔗 **Live:** [fvilpaz.github.io/Crypto_Portafolio](https://fvilpaz.github.io/Crypto_Portafolio/)

---

## 📌 Purpose

Mi Cartera Crypto answers a simple question:

**What do I hold right now, and what is it worth today?**

It is the mirror image of its companion app, [Crypto_Trace](https://github.com/fvilpaz/Crypto_Trace),
which answers *"how much fiat have I invested over time?"*.

The two are separate **by design**:

- **Crypto_Trace** covers fiat spending / cost basis. It keeps every coin you ever
  bought, even ones you no longer hold.
- **Mi Cartera Crypto** (this app) covers current holdings, the result of
  crypto-to-crypto rotations, staking and airdrops. If you bought DOT and rotated
  it into ATOM, this app shows ATOM.

Because holdings are shaped by rotations (not just purchases), the two data sets
are intentionally not merged. The apps cross-link, nothing more.

---

## 🚀 Features

- Live portfolio valuation with prices from the CoinGecko API
- Total value + PnL hero, in **USD ⇄ EUR** (toggle)
- Summary cards: BTC+ETH core, Cosmos (ATOM+TIA) with a 35% concentration guard,
  monthly staking income, airdrops
- **Single wallet with per-coin tags:** every coin lives in one portfolio and is
  tagged *Cartera*, *Staking* or *Airdrop* from its detail card. The staking and
  airdrop views derive from those tags (no hardcoded lists)
- **Movement types:** *Compra*, *Venta* and *Recompensa* (free coins from staking
  rewards or airdrops, added at 0 cost so they raise your quantity without counting
  as invested money)
- **Hide coins:** dust or clutter can be hidden from the list and the chart without
  changing the total value
- **Distribution** doughnut chart (share per asset)
- **Evolution** chart over time
- **DCA** summary (monthly plan)
- **Staking** breakdown (per-asset APR)
- **Custody** split (Bit2Me / Autocustodia / Bitget)
- **Movements** table (buys, sells, rewards), searchable
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
- [CoinGecko API](https://www.coingecko.com/en/api) for live prices (direct call, API key)
- Service Worker + Web App Manifest (installable, offline app shell)

---

## 💾 Data

Live **prices** come from CoinGecko at runtime (direct call with an API key, no
proxy or backend in between). Your **holdings and movements** live only in your
browser (`localStorage`). No backend, no tracking, full privacy.

The app starts empty and only shows what you add. There is no seed data.

**Export / Import** asks which format you want:

- **JSON (full backup):** the whole state (coins, tags, hidden flags, APR and
  movements). This is the way to carry your portfolio to another device: export
  the JSON on one device, import it on another and everything is restored intact.
- **CSV (movements):** just the buy / sell / reward history
  (`date,token,type,price,qty,totalUsd`).

A `git push` to `master` triggers an automatic **GitHub Pages** deploy.

---

## 📈 Project Philosophy

Keep it lightweight, private and focused. This app is the **valuation** half of the
pair; [Crypto_Trace](https://github.com/fvilpaz/Crypto_Trace) is the **spend-tracking**
half. Each does one thing well and they link to each other.

---

## 🔮 Roadmap

- Automatic cross-device sync (a "Nando profile" backed by a private GitHub Gist),
  so state travels between devices without carrying a file by hand
- Add brand-new coins via CoinGecko search (auto-resolves id, name and icon,
  e.g. type "usdc")
- Per-coin manual price override for coins CoinGecko does not price

---
