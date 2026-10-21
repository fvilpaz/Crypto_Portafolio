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
- Total value + PnL hero, in **USD ⇄ EUR** (toggle), with the live EUR/USD rate
  (open.er-api.com). Each movement also keeps the exact euros you typed
  (`totalEur`), so past purchases don't drift when the rate moves
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
- **DCA** summary (monthly plan; purchases from the 28th onwards count towards the next month)
- **Monthly split** by strategy: three fixed templates (conservadora / moderada / agresiva)
  plus **objetivos**, which sends the money to whichever bucket (refugio / core / satellites)
  is furthest below its own target, in proportion to each gap
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

- **NEXT, do this first:** market analysis zone ("smart money" tracker): connect to
  real data on what the big investors hold (Dalio/Bridgewater, Buffett/Berkshire,
  Gates Foundation, etc.), e.g. from public SEC 13F filings (EDGAR), then compute
  statistics on the overlap: which companies several of them hold at once, as
  candidates for my own investing. Note: 13F is quarterly and lags up to 45 days, so
  it shows what they held, not what they hold today
  - **Status (2026-10-21), branch `feat/mercado-bolsa`.** Done and checked in the browser: header button
    "Mercado" and its view; real 13F tables for Berkshire, Bridgewater and the Gates Foundation Trust
    (`scripts/update_13f.py`, one JSON per manager in `data/`, run by hand with `SEC_USER_AGENT`); real "Dónde
    coinciden" and "Las que sigues" computed from the full positions, not only the top 10; teal highlight for the
    stocks I follow; Crypto tab from DefiLlama and CoinGecko (`scripts/update_crypto.py`, no keys); "Reparto del
    mes" groups Crypto / Bolsa (shown only when `settings.bolsaMonthly` > 0). Still example data (yellow label):
    the text cards "Inversores y gestoras" and "Empresas y fondos". **Not done:** Bolsa card with real holdings,
    targets adding up to 100 %, live stock prices (Twelve Data), a scheduled GitHub Action running both scripts
    (the SEC contact would be a repo secret), and people such as Elon Musk (not 13F filers: they show up in
    Form 4 and 13D/13G filings, a different source)
  - Base the analysis on quarter-to-quarter changes (new buys, increases) and portfolio
    weight, not only on plain overlap
  - Per-company drill-down: who holds it, since when, weight, plus recent news and
    fundamentals, to learn why the big investors went in (the goal is to learn to
    analyse on my own, copying is the toll until then)
  - Crypto side: DefiLlama (free, no key, CORS open) for TVL, protocol revenue and
    stablecoin flows
  - Placement: separate "Mercado" view opened from a header button (not a nav anchor),
    with a Bolsa / Crypto selector; data loaded only when opened
  - Architecture: a scheduled script (GitHub Action) downloads EDGAR 13F, DefiLlama
    and news, and writes small static JSON files to the repo; the app only reads those.
    Tested 2026-10-21: EDGAR holdings XML and Google News have no CORS (browser cannot
    read them), EDGAR needs a User-Agent, DefiLlama files are large (protocols 9 MB,
    fees 29 MB), Yahoo returned 429. A script avoids CORS, API limits and keys in
    the frontend. Live prices stay in the browser (Twelve Data)
  - 13F quirk: the same company can appear in several rows (e.g. Apple in
    Berkshire's filing); sum positions per issuer before comparing
  - Crypto holders: companies holding BTC/ETH (Strategy, Metaplanet, BitMine...) from
    CoinGecko's public-treasury endpoint, fetched by the same script (DefiLlama's
    treasuries/ETF endpoints are paid). Bitcoin ETFs such as IBIT are funds, not companies
  - Scope: get the basics working first (fixed list of ~5 managers, static JSON,
    read-only view). Everything below is a later phase, only if the app grows
  - Later, phase 1: configurable manager list (name + SEC CIK in a file the script reads)
  - Later, phase 2: small cloud function (e.g. Cloudflare Worker) as a proxy: it solves
    EDGAR's missing CORS and keeps any API key out of the frontend
  - Later, phase 3, on top of that function: in-app manager search, and an analysis chat
    over the same data (13F data only changes quarterly; only prices and news are live)
- **Done:** automatic cross-device sync (a "Nando profile" backed by a private GitHub Gist, cloud
  button in the header), so state travels between devices without carrying a file by hand
- **Done:** add brand-new coins via CoinGecko search in the "Añadir movimiento" window (id, name and icon
  are resolved; saved in `settings.customCoins`, so they travel with the export and the sync). Known limit: a
  new coin counts in the total and the distribution, but not yet in the Núcleo / Satélites / Refugio cards
  (they use fixed lists), so the place of each new coin has to be decided
- Per-coin manual price override for coins CoinGecko does not price
- Stocks/ETFs (e.g. an S&P 500 ETF for DCA or extra pay): symbol search with
  Twelve Data (CORS open; price needs a free key), price in EUR/USD with the
  existing rate, and its own "Bolsa" total kept apart from the crypto cards
  - **Phase 1 done:** the "Añadir movimiento" search box also finds US stocks/ETFs (Twelve Data, no key
    needed for the search). They are saved as holdings (`kind: 'stock'`, registry in `settings.customStocks`) and
    a teal "Bolsa" card shows their weight and an optional target (`settings.bolsaTarget`, pencil button); they
    are valued at purchase price. Setting the Bolsa target offers to rescale Núcleo / Satélites / Refugio in
    proportion so the four add up to 100 % (60/20/20 + Bolsa 30 gives 42/14/14). **Pending:** live price (needs
    a free Twelve Data key that only I can create, to go in `config.js`), a warning when editing the other
    targets breaks the 100 %, and the "Tu plan" block of the prototype
  - **Monthly plan, one amount (decided with Nando):** the pencil of the DCA card is the single monthly money to
    invest (crypto + bolsa). The Bolsa target (pencil of the Bolsa card) defines the crypto / bolsa ratio (the rest
    is crypto), and each month's money goes to whichever side is further from its target (same mechanism as the
    "objetivos" template; if one side already reaches it, everything goes to the other). The Reparto templates
    split only the crypto part (with Crypto / Bolsa groups), the DCA card counts every purchase (crypto and stocks)
    against the total and breaks it down, the Bolsa card says how much is missing ("Faltan"), and a line projects
    the weight of the Bolsa at 12 and 24 months and when it reaches its target (month-by-month simulation, price
    moves ignored). Note: with lots of crypto and no Bolsa, all the new money goes to the Bolsa until the ratio is
    close. **Open:** one single "Plan de inversión" panel for all these inputs, how the Bolsa part is shared among
    the stocks (today equally among the five of the catalogue), and the "Tu plan" block
- Traditional-market metrics next to the crypto ones (allocation, performance and
  evolution of the "Bolsa" side, same charts as crypto)
  - New summary card "Bolsa" in the card row (same format as Núcleo / Satélites /
    Refugio: icons of the holdings, % of the portfolio, bar with target mark). The
    header button "Mercado" is for analysis (Bolsa + Crypto); the card is what I own
  - Stock holdings must add to the portfolio total in the hero; needs a buy price per
    stock (for P&L) and the live EUR/USD rate for conversion
  - Targets: Núcleo / Satélites / Refugio / Bolsa must add up to 100 %, so the current
    60/20/20 targets and the "Reparto del mes" templates need rethinking
  - Header button toggles its own label: "Mercado" on the portfolio view, "Cartera"
    on the market view (no second back button inside the view)
  - Design decided in the prototype (market view + Bolsa card + monthly plan):
    - "Reparto del mes": each template gets two collapsible groups, Crypto and Bolsa,
      with a subtotal; plus a fifth block "Tu plan" that counts only what is invested
      (savings and living costs are not investment and stay out of the split)
    - Split cards in %: "Reparto de crypto" (BTC, ETH, USDC, ATOM, TIA, SOL) and
      "Reparto de la bolsa" (S&P 500, SpaceX, Tesla, Nvidia, Microsoft); the bolsa
      catalogue is hardcoded like COINS, a search to add more comes later
    - Monthly contribution has a fixed crypto base, a variable cushion (up to a cap)
      and a bolsa amount; the rest of the budget is not part of the split
    - Estimate panel: weight of the bolsa in the portfolio after N months, and the month
      the bolsa target is reached (ignores price changes)
    - EUR / USD toggle must keep working everywhere (same rate and format as the app)
    - Desktop: the template blocks scroll horizontally with 3 visible; mobile keeps the
      stacked grid
    - Reuse existing classes (token-icon, reparto-row, strat-bar, card, section-badge...)
      instead of new styles; one row-building function for every list
    - Open: base of the template maths (600 EUR budget vs invested only), whether "Tu
      plan" goes first, and the bolsa rows' progress bar (split share, not progress)

---
