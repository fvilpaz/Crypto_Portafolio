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
- **Distribution** doughnut chart (share per asset) and **Evolution** chart over time. With stocks in the portfolio each
  section gets a **Crypto | Bolsa** selector (same look as Mercado's): the doughnut, the list and the invested / current
  value curves are those of the chosen group. Without stocks there is no selector
- **DCA** summary (monthly plan; purchases from the 28th onwards count towards the next month)
- **Centro de operaciones** (a separate view like Mercado; a **Cartera | Operaciones | Mercado** selector under the header switches between the three) holds the **monthly split ("Reparto del mes")**, built around a "Plan de inversión" panel: the monthly amount, a crypto / bolsa
  ratio slider (moving it rescales Núcleo / Satélites / Refugio so the four targets add up to 100 %), result cards
  ("this month to crypto / to bolsa") and Crypto / Bolsa cards where each bucket shows its weight and its target as
  coloured chips (green reaches it, yellow passes it, red is short). The three fixed templates (conservadora / moderada /
  agresiva) split the money by the ratio and then by their own percentages, **ignoring what you already hold**, and each
  one also sets the share of the bolsa that goes to the núcleo (50 / 25 / 10 %; the rest to the other stocks);
  **objetivos** looks at what you hold and sends each side's money where it is missing (if crypto is ahead, it all goes
  to bolsa)
- **Bolsa (stocks and ETFs):** the "Añadir movimiento" window has two separate searches (*Buscar crypto* /
  *Buscar acción o ETF*) so tokens that imitate stocks never mix with real stocks. The stock search finds US tickers
  (Twelve Data, no key for the search) and a short built-in list of popular ETFs by name ("sp500", "global vanguard"),
  European UCITS first (VUAA, VWCE, CSPX, IWDA...). A purchase with only an amount and no price opens a 1-unit position at
  the price paid. The Bolsa card has a pencil that opens the same editor as Núcleo: target, one percentage per stock, a
  search to add more and a ★ that marks the núcleo (it goes first and inherits the highest percentage; default 25 % núcleo,
  the rest equal among the satellites). The assets table shows Crypto and Bolsa as two blocks with their own subtotal
- **Live stock prices, no key in the browser:** a scheduled GitHub Action (`scripts/update_precios.py`, Twelve Data free
  plan) writes `data/precios.json` every 2 hours Monday to Friday; the app only reads that file and falls back to the
  purchase price when a stock has no recent price (older than 5 days) or is not in the file. The symbols it tracks are
  listed in `data/acciones.json`. A stock with no automatic price (e.g. European UCITS ETFs the free plan does not cover)
  has a **Price** box in its detail window where you type the current price in euros; market price wins when it exists
- **Import from Revolut:** *Importar → CSV* also accepts Revolut's transactions statement (`Date, Ticker, Type, Quantity,
  Price per share, Total Amount, Currency, FX Rate`). Unlike the app's own CSV it **adds** to what you have (nothing is
  rebuilt): only BUY / SELL rows are imported, top-ups, withdrawals and dividends are ignored, and a movement imported
  before is not duplicated
- **Satellites** are the coins of your own satellite split (`settings.satSplit`, edited with the card's pencil); a coin
  you add there shows up in the card and in the monthly split
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
- Service Worker + Web App Manifest (installable, offline app shell; network-first, revalidating every load)
- Python scripts + GitHub Actions that refresh static JSON in `data/` (SEC EDGAR 13F, DefiLlama, CoinGecko, Twelve Data)

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

Static data written by scheduled GitHub Actions lives in `data/` (`13f_*.json`, `crypto.json`, `precios.json`); the app
only reads it. Secrets live only in the repository settings: `TWELVE_DATA_KEY` (stock prices) and `SEC_USER_AGENT` (the
contact the SEC asks for). Twelve Data's free plan gives 8 credits per minute and 800 per day, 1 credit per symbol and
call; the price script makes one call per symbol every 10 s, at most 40 symbols, and stops at the first 429.

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
  - **Status (2026-10-22), published in `master`.** Done and checked in the browser: header button "Mercado" and its
    view; real 13F tables for Berkshire, Bridgewater and the Gates Foundation Trust (`scripts/update_13f.py`, one JSON per
    manager in `data/`); real "Dónde coinciden" and "Las que sigues" computed from the full positions, not only the top 10;
    teal highlight for the stocks I follow; Crypto tab from DefiLlama and CoinGecko (`scripts/update_crypto.py`, no keys); the
    daily Action `actualizar-datos.yml` (written, never run on GitHub yet). Still example data (yellow label): the text cards
    "Inversores y gestoras" and "Empresas y fondos". **Pending:** create the repo secret `SEC_USER_AGENT` (without it the Action
    skips the 13F) and run the Action once to check it; phases 2 and 3 below. **Done (22-oct):** people who are not 13F filers
    (Elon Musk first) come from the SEC's Form 4 and Schedule 13D/13G filings (`scripts/update_insiders.py` → `data/insiders.json`,
    shown in Mercado under the 13F managers; add a person with one line in `PERSONAS`); the two hand-written example text cards
    were hidden (commented out, not deleted)
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
  are resolved; saved in `settings.customCoins`, so they travel with the export and the sync). A new coin counts in the
  total and the distribution; to count in the Satélites card and in the monthly split, add it with the pencil of the Satélites
  card. Núcleo (BTC, ETH) and Refugio (USDC) are still fixed lists
- Per-coin manual price override for coins CoinGecko does not price
- Stocks/ETFs (e.g. an S&P 500 ETF for DCA or extra pay): symbol search with
  Twelve Data (CORS open; price needs a free key), price in EUR/USD with the
  existing rate, and its own "Bolsa" total kept apart from the crypto cards
  - **Phase 1 done:** US stocks/ETFs are found with the "Añadir movimiento" search, saved as holdings (`kind: 'stock'`,
    registry in `settings.customStocks`) and shown in a teal "Bolsa" card with an optional target (`settings.bolsaTarget`).
    Setting the Bolsa target rescales Núcleo / Satélites / Refugio so the four add up to 100 % (60/20/20 + Bolsa 30 gives
    42/14/14)
  - **Phase 2 done (2026-10-22):** separate crypto / stock searches; popular ETFs by name incl. European UCITS; amount-only
    purchases; Crypto / Bolsa blocks in the assets table; the Bolsa pencil opens an editor with per-stock percentages
    (`settings.stockSplit`) and the núcleo (`settings.bolsaCore`); issuer logo for Vanguard and a public logo for the other
    stocks (letters when none); live prices through the scheduled Action and `data/precios.json`. **Pending / unverified:** the
    first run of the price Action on GitHub (the free Twelve Data plan lists US stocks and ETFs; European ones such as VUAA
    may come back without a price, and then they stay at purchase price; it is not confirmed which ones the plan covers); a
    manual price per stock for those; a warning when editing the other targets breaks the 100 %; the "Tu plan" block
  - **Monthly plan (decided with Nando):** the "Dinero al mes" box is the single amount to invest (crypto + bolsa); the
    slider (or the pencil of the Bolsa card) sets the crypto / bolsa ratio. The three fixed templates divide the amount by
    that ratio and then by their own percentages (crypto: refugio / núcleo / satélites, then the per-coin split of each
    bucket; bolsa: the percentages of the Bolsa editor), without looking at the portfolio. "Objetivos" does look at it: it
    sends each side's money to whichever is further from its target, so with lots of crypto and no bolsa everything goes to
    bolsa. The panel's result cards use that same "what is missing" logic and subtract what you already bought this month
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
    - **What reached the app (2026-10-22):** the two collapsible Crypto / Bolsa groups in each template, the horizontal
      dock of templates (3 visible), the Plan panel (amount + ratio), the per-bucket chips, the bolsa split (now an editor
      behind the Bolsa pencil instead of a card, using the stocks you actually hold). **Left out on purpose:** the
      hardcoded five-stock catalogue and the separate "Reparto de crypto" card (the Núcleo / Satélites pencils edit it).
      **Still only in the prototype:** the "Plan del mes" sliders with cushion and "Ahorro y gastos", the "weight of the
      bolsa in N months" slider, and the month bar with legend. The old "Objetivos de la cartera" box (four % boxes, a SUMA badge
      and an "adjust the other three" button) is kept in the prototype notes in case it is wanted back

---
