// ═══════════════════════════════════════════════════════════════
// MI CARTERA CRYPTO — Datos + API + Lógica
// ═══════════════════════════════════════════════════════════════

const App = (() => {
  // Cambio €/$: cuántos euros vale 1 dólar. Se pide en vivo al arrancar (misma
  // fuente que CryptoTrace) y se guarda el último bueno en este navegador.
  // 0.85 era el cambio fijo hasta sep-2026: queda como arranque si nunca se ha
  // podido pedir, y para reconstruir los euros de los movimientos de entonces.
  const LEGACY_EUR_USD = 0.85;
  const RATE_KEY = 'miCartera.rate.v1';
  const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
  let EUR_USD = parseFloat(localStorage.getItem(RATE_KEY)) || LEGACY_EUR_USD;
  const COINGECKO_IMG = 'https://coin-images.coingecko.com/coins/images';

  // Catálogo de las monedas que farmeo. Sirve para el selector de "Añadir" y
  // para crear la tenencia la primera vez que compro una nueva (p.ej. USDC).
  const COINS = {
    BTC:  { name: 'Bitcoin',  coingeckoId: 'bitcoin',  icon: `${COINGECKO_IMG}/1/small/bitcoin.png`,      color: '#f7931a', cssClass: 'btc' },
    ETH:  { name: 'Ethereum', coingeckoId: 'ethereum', icon: `${COINGECKO_IMG}/279/small/ethereum.png`,   color: '#627eea', cssClass: 'eth' },
    ATOM: { name: 'Cosmos',   coingeckoId: 'cosmos',   icon: `${COINGECKO_IMG}/1481/small/cosmos_hub.png`, color: '#8c94a8', cssClass: 'atom' },
    TIA:  { name: 'Celestia', coingeckoId: 'celestia', icon: `${COINGECKO_IMG}/31967/small/tia.jpg`,       color: '#cd9eff', cssClass: 'tia' },
    USDC: { name: 'USD Coin', coingeckoId: 'usd-coin', icon: `${COINGECKO_IMG}/6319/small/usdc.png`,       color: '#2775ca', cssClass: 'usdc' },
    PI:    { name: 'Pi Network', coingeckoId: 'pi-network', icon: `${COINGECKO_IMG}/54342/small/pi_network.jpg`, color: '#0ecb81', cssClass: 'pi' },
    ATONE: { name: 'AtomOne', coingeckoId: 'atomone', icon: `${COINGECKO_IMG}/33230/small/atomone_200x200.jpg`, color: '#1e90ff', cssClass: 'atone' },
    MODE:  { name: 'Mode', coingeckoId: 'mode', icon: `${COINGECKO_IMG}/34979/small/MODE.jpg`, color: '#f0b90b', cssClass: 'mode' },
    SOL:   { name: 'Solana', coingeckoId: 'solana', icon: `${COINGECKO_IMG}/4128/small/solana.png`, color: '#9945ff', cssClass: 'sol' },
  };

  // Tokens que cuentan como satélites: los de tu reparto interno de Satélites (settings.satSplit, el del lápiz de la tarjeta). Para que una moneda
  // nueva salga en la tarjeta y en las recomendaciones, añádela ahí.
  function getSatTokens() {
    const ks = Object.keys(settings.satSplit || {}), base = ['ATOM', 'TIA', 'SOL'];   // las de siempre, en su orden de siempre; las nuevas detrás
    return [...base.filter(t => ks.includes(t)), ...ks.filter(t => !base.includes(t))];
  }
  const REPARTO_OPEN = new Set();   // grupos (crypto/bolsa) que tienes abiertos: renderReparto repinta todo

  // La cartera es UN SOLO monedero. Cada moneda lleva un tag:
//   'portfolio' → cartera normal
//   'staking'   → desviada al chart de staking
//   'airdrop'   → desviada al chart de airdrops
// Los filtros derivados reemplazan a los antiguos arrays fijos.

  const getStakingAssets = () => portfolio.filter(a => a.tag === 'staking');
  const getAirdropAssets = () => portfolio.filter(a => a.tag === 'airdrop');

  // Reparto de custodia: distribución fija, no son datos del usuario.
  const custody = [
    { name: 'Bit2Me', type: 'Exchange regulado ES', pct: 0.30, color: '#f0b90b', purpose: 'Fiat / Hacienda' },
    { name: 'Autocustodia', type: 'Claves propias', pct: 0.40, color: '#0ecb81', purpose: 'Largo plazo' },
    { name: 'Bitget', type: 'Exchange earn', pct: 0.30, color: '#1e90ff', purpose: 'Earn / operativa' },
  ];

  const cosmosTopPct = () => (settings.satTarget ?? DEFAULT_SAT_TARGET) / 100;
  const DEFAULT_DCA_TARGET = 200;   // objetivo DCA inicial en €, hasta que lo edites
  const DEFAULT_DEFENSE_TARGET = 20;   // objetivo de refugio (USDC) en % de la cartera
  const DEFAULT_CORE_TARGET = 60;      // objetivo de núcleo (BTC+ETH) en % de la cartera
  const DEFAULT_SAT_TARGET = 20;       // objetivo de satélites en % de la cartera

  // Plantillas de reparto del dinero nuevo: % que va a Refugio / Núcleo / Satélites.
  const STRATEGIES = {
    conservadora: { refugio: 50, core: 35, satelites: 15 },
    moderada:     { refugio: 30, core: 50, satelites: 20 },
    agresiva:     { refugio: 15, core: 60, satelites: 25 },
    // Sin porcentajes fijos: reparte hacia los objetivos de cubo (ver computeReparto).
    objetivos:    { byTargets: true },
  };
  const DEFAULT_STRATEGY = 'moderada';
  // coreSplit y satSplit ahora viven en settings (editables y persistidos)

  // ── PERSISTENCIA (localStorage) ──
  // La cartera, los movimientos y los airdrops viven SOLO en el navegador.
  // Primera vez: todo a 0. Nada de datos hardcodeados en el código.
  const STORE_KEY = 'miCartera.v1';

  // Snapshot de precios en vivo (último tick bueno). Sobrevive al rate limit
  // de CoinGecko: si todas las fuentes fallan, se usan estos precios hasta 20 min.
  const PRICE_CACHE_KEY = 'miCartera.prices.v1';
  const CACHE_MAX_MIN = 20;   // ventana en la que el snapshot se considera utilizable

  const clone = (x) => JSON.parse(JSON.stringify(x));

  function saveStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.portfolio) && Array.isArray(data.transactions)) {
          if (data.updatedAt == null) data.updatedAt = Date.now();
          return data;
        }
      }
    } catch (e) {
      console.warn('localStorage ilegible, parto de cero:', e);
    }
    // Primera vez (o datos corruptos): parte de cero.
    const empty = { portfolio: [], transactions: [], updatedAt: 0 };
    saveStore(empty);
    return empty;
  }

  // ── SNAPSHOT DE PRECIOS (fallback al rate limit) ──
  // Guarda solo los precios que vinieron de una API (nunca avgPrice de compra).
  function loadCachedPrices() {
    try {
      const raw = localStorage.getItem(PRICE_CACHE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.prices && typeof d.prices === 'object') {
          return { ts: d.ts || 0, prices: d.prices };
        }
      }
    } catch (e) {
      console.warn('Snapshot de precios ilegible:', e);
    }
    return { ts: 0, prices: {} };
  }

  function saveCachedPrices() {
    // Guarda cada token con su propio timestamp de adquisición (prices[t].ts):
    // si un tick falla pero los datos vivos aún son recientes, la edad del
    // snapshot refleja el cambio real y no "renueva" un precio viejo.
    const snap = {};
    let newest = 0;
    liveTokens.forEach(t => {
      const p = prices[t];
      if (p && p.price > 0) {
        snap[t] = { price: p.price, change24h: p.change24h || 0, ts: p.ts || 0 };
        newest = Math.max(newest, p.ts || 0);
      }
    });
    if (Object.keys(snap).length === 0) return;
    try {
      const ts = newest || Date.now();
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ ts, prices: snap }));
      cachedPrices = { ts, prices: snap };
    } catch (e) {
      console.warn('No se pudo guardar el snapshot de precios:', e);
    }
  }

  const _store = loadStore();
  let portfolio = _store.portfolio;
  let transactions = _store.transactions;
  let settings = Object.assign({ dcaTarget: DEFAULT_DCA_TARGET, defenseTarget: DEFAULT_DEFENSE_TARGET, coreTarget: DEFAULT_CORE_TARGET, satTarget: DEFAULT_SAT_TARGET, strategy: DEFAULT_STRATEGY, coreSplit: { BTC: 0.6, ETH: 0.4 }, satSplit: { SOL: 0.5, ATOM: 0.3, TIA: 0.2 } }, _store.settings || {});   // dcaTarget en €, defenseTarget en %, strategy = plantilla de reparto

  // Monedas añadidas por búsqueda (settings.customCoins): se registran en COINS y el resto del código las trata como una más.
  // Lo que viene de fuera (CoinGecko, un JSON importado) se limpia, y una moneda de fuera nunca pisa una del catálogo.
  function registerCustomCoins() {
    Object.entries(settings.customCoins || {}).forEach(([tok, m]) => {
      const ya = COINS[tok];
      if (!/^[A-Z0-9]{1,12}$/.test(tok) || !/^[a-z0-9-]+$/.test(m?.coingeckoId || '') || (ya && ya.coingeckoId !== m.coingeckoId)) return;
      COINS[tok] = { name: String(m.name || tok).replace(/[<>&"']/g, ''), coingeckoId: m.coingeckoId, icon: /^https:\/\//.test(m.icon) ? m.icon : '', color: '#8c94a8', cssClass: '' };
    });
  }
  registerCustomCoins();

  // Acciones/ETF añadidos por búsqueda (settings.customStocks): se registran en COINS con kind 'stock'. Sin coingeckoId no hay
  // precio en vivo, así que valen a precio de compra. Nunca pisan una moneda del catálogo; el nombre se limpia.
  function registerCustomStocks() {
    Object.entries(settings.customStocks || {}).forEach(([tok, m]) => {
      if (!/^[A-Z0-9.]{1,10}$/.test(tok) || COINS[tok]) return;
      COINS[tok] = { name: String(m?.name || tok).replace(/[<>&"']/g, ''), kind: 'stock', color: '#2dd4bf', cssClass: 'stk',
        // logo público; si no carga, iconHtml vuelve a las letras. Los Vanguard (también los UCITS europeos, que la otra fuente no tiene) llevan el logo de la gestora.
        icon: /vanguard/i.test(m?.name || '') ? 'https://www.google.com/s2/favicons?domain=vanguard.com&sz=64' : `https://financialmodelingprep.com/image-stock/${tok}.png` };
    });
  }
  registerCustomStocks();
  let storeVersion = _store.updatedAt || 0;
  let showHidden = false;   // mostrar temporalmente las monedas ocultas en la tabla
  let pendingImportFormat = null;   // 'json' | 'csv' elegido antes de abrir el file picker

  // Normaliza activos (al cargar y al importar un JSON): tag por defecto y, para
  // monedas conocidas, refresca coingeckoId/icono/color desde el catálogo COINS.
  // Corrige ids obsoletos guardados antes (p.ej. PI/MODE con id malo → precio 0€).
  // 'ATOMONE' es como mucha gente guardó AtomOne en el export; aquí se alía al
  // símbolo del catálogo ('ATONE') para que recupere coingeckoId y precio en vivo.
  const TOKEN_ALIASES = { ATOMONE: 'ATONE' };
  function normalizePortfolio(list) {
    if (!Array.isArray(list)) return;
    list.forEach(a => {
      if (!a) return;
      if (!a.tag) a.tag = 'portfolio';
      const cat = COINS[a.token] || COINS[TOKEN_ALIASES[a.token]];
      if (cat) {
        a.coingeckoId = cat.coingeckoId;   // fuente de verdad del precio en vivo
        if (!a.icon) a.icon = cat.icon;
        if (!a.color) a.color = cat.color;
        if (!a.cssClass) a.cssClass = cat.cssClass;
        if (!a.name) a.name = cat.name;
      }
    });
  }
  normalizePortfolio(portfolio);

  // Guarda el estado actual (holdings + movimientos) tras cada edición.
  function persist() {
    storeVersion = Date.now();
    saveStore({ portfolio, transactions, settings, updatedAt: storeVersion });
    syncSchedulePush();   // si el sync está activo, sube al gist (debounced)
  }

  // Cada movimiento necesita un id estable para poder editar/borrar por fila.
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  transactions.forEach(t => { if (t.id == null) t.id = uid(); });

  // Cada movimiento guarda también los euros que se teclearon (totalEur), para
  // que no bailen cuando cambia el €/$. Los anteriores al cambio en vivo no lo
  // traen: se metieron todos a 0.85, así que se reconstruyen exactos con ese cambio.
  function fillTotalEur(list) {
    list.forEach(t => {
      if (t.totalEur == null) t.totalEur = Math.round((t.totalUsd || 0) * LEGACY_EUR_USD * 100) / 100;
    });
  }
  fillTotalEur(transactions);

  async function fetchEurUsd() {
    try {
      const data = await (await fetch(RATE_URL)).json();
      const rate = data?.rates?.EUR;
      if (data?.result !== 'success' || !(rate > 0)) return;
      EUR_USD = rate;
      localStorage.setItem(RATE_KEY, String(rate));
      render();
    } catch (e) {
      console.warn('No se pudo pedir el cambio €/$ (se usa el último guardado):', e);
    }
  }

  // ── ESTADO ──
  let currency = 'USD';
  let prices = {};
  let liveTokens = new Set();   // tokens con precio confirmado por API en esta sesión
  let cachedPrices = loadCachedPrices();
  // Siembra inicial: al abrir, ya se ve el último snapshot guardado mientras
  // llega el primer precio vivo. El render usa price/change24h, ignora 'ts'.
  Object.entries(cachedPrices.prices).forEach(([t, p]) => {
    if (p && p.price > 0) prices[t] = { price: p.price, change24h: p.change24h || 0, ts: p.ts || 0 };
  });
  let sparklineData = {};
  let chartInstance = null;
  let evolutionChart = null;
  let refreshInterval = null;
  let txFilter = '';
  let prevTotal = null;
  let prevPnl = null;
  let isInitialLoad = true;

  // ── FORMATEO ──
  // Cantidades SIEMPRE con 2 decimales como máximo (0 → 0.00), salvo valores
  // sin dígitos (enteros/porcentajes) que explícitamente piden 0 decimales.
  const fmt = (n, decimals = 2) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const d = Math.max(0, Math.min(decimals, 2));
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const fmtCurrency = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const value = currency === 'EUR' ? n * EUR_USD : n;
    return currency === 'EUR' ? fmt(value) + ' €' : '$' + fmt(value);   // espacio duro: el € no salta de línea
  };

  // Importe de UN movimiento (su total o su precio, en $). En € usa los euros
  // exactos del movimiento (totalEur), no los dólares reconvertidos al cambio de hoy.
  const fmtTxAmount = (tx, usd) => {
    if (currency !== 'EUR' || !(tx.totalUsd > 0) || tx.totalEur == null) return fmtCurrency(usd);
    return fmt(usd * tx.totalEur / tx.totalUsd) + ' €';
  };

  const fmtPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return sign + (n * 100).toFixed(2) + '%';
  };

  // APR guardado como fracción (0.12) → texto '12.00%'. Único sitio del formato.
  const fmtApr = (apr) => `${((apr || 0) * 100).toFixed(2)}%`;

  const pnlClass = (n) => n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral';

  function iconHtml(token, cssClass, size = 32) {
    const all = portfolio;
    const asset = all.find(a => a.token === token) || COINS[token];
    const icon = asset?.icon || COINS[token]?.icon;
    if (icon) {
      return `<img src="${icon}" alt="${token}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="token-icon ${cssClass}" style="display:none;width:${size}px;height:${size}px;font-size:${size * 0.38}px;">${token.substring(0, 2)}</div>`;
    }
    return `<div class="token-icon ${cssClass}" style="width:${size}px;height:${size}px;font-size:${size * 0.38}px;">${token.substring(0, 2)}</div>`;
  }

  // ── SKELETON LOADING ──
  function renderSkeletons() {
    const assetTbody = document.getElementById('asset-tbody');
    if (assetTbody) {
      assetTbody.innerHTML = Array(4).fill('').map(() => `
        <tr><td colspan="9"><div class="skeleton-row">
          <div class="skeleton skeleton-circle"></div>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1">
            <div class="skeleton skeleton-line w80"></div>
            <div class="skeleton skeleton-line w60"></div>
          </div>
          <div class="skeleton skeleton-line w100"></div>
          <div class="skeleton skeleton-line w80"></div>
          <div class="skeleton skeleton-line w60"></div>
          <div class="skeleton skeleton-line w100"></div>
          <div class="skeleton skeleton-line w80"></div>
          <div class="skeleton skeleton-line w60"></div>
        </div></td></tr>
      `).join('');
    }

    const stakingGrid = document.getElementById('staking-grid');
    if (stakingGrid) {
      stakingGrid.innerHTML = Array(2).fill('').map(() => `
        <div class="staking-card skeleton-card">
          <div class="skeleton skeleton-line h20" style="margin-bottom:16px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><div class="skeleton skeleton-line h14" style="width:50px;margin-bottom:6px"></div><div class="skeleton skeleton-line h20" style="width:80px"></div></div>
            <div><div class="skeleton skeleton-line h14" style="width:50px;margin-bottom:6px"></div><div class="skeleton skeleton-line h20" style="width:80px"></div></div>
            <div><div class="skeleton skeleton-line h14" style="width:50px;margin-bottom:6px"></div><div class="skeleton skeleton-line h20" style="width:80px"></div></div>
            <div><div class="skeleton skeleton-line h14" style="width:50px;margin-bottom:6px"></div><div class="skeleton skeleton-line h20" style="width:80px"></div></div>
          </div>
        </div>
      `).join('');
    }

    const txTbody = document.getElementById('tx-tbody');
    if (txTbody) {
      txTbody.innerHTML = Array(8).fill('').map(() => `
        <tr><td colspan="6"><div class="skeleton-row">
          <div class="skeleton skeleton-line w80"></div>
          <div class="skeleton skeleton-circle" style="width:24px;height:24px"></div>
          <div class="skeleton skeleton-line w60"></div>
          <div class="skeleton skeleton-line w100"></div>
          <div class="skeleton skeleton-line w80"></div>
          <div class="skeleton skeleton-line w60"></div>
        </div></td></tr>
      `).join('');
    }
  }

  // ── ANIMATE VALUE (counter) ──
  function animateValue(el, start, end, duration, formatter) {
    if (start === null || start === undefined) start = end;
    if (Math.abs(end - start) < 0.01) {
      el.textContent = formatter(end);
      return;
    }
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      el.textContent = formatter(current);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // URLs de precios (simple/price) o sparklines (coins/markets). La directa de
  // CoinGecko funciona desde el navegador gracias a la API key de js/config.js
  // (responde CORS). Sin proxy de por medio. El _t= rompe cualquier caché.
  function coingeckoUrls(type, ids) {
    const key = COINGECKO_API_KEY ? `&${COINGECKO_API_PARAM}=${COINGECKO_API_KEY}` : '';
    const direct = (type === 'markets'
      ? `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h`
      : `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`) + key;
    return [direct + '&_t=' + Date.now()];
  }

  // Fetch a CoinGecko resistente al rate limit (HTTP 429): reintenta un par de
  // veces respetando Retry-After (o backoff exponencial si no viene) y pasa el
  // turno a los fallbacks cuanto antes. no-store evita caché navegador/PWA.
  async function fetchCoinGecko(urls, retries = 2) {
    if (!Array.isArray(urls)) urls = [urls];
    let lastErr = null;
    for (const url of urls) {
      for (let intento = 0; ; intento++) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) return res;
          if (res.status === 429 && intento < retries) {
            const retryAfter = parseInt(res.headers.get('retry-after'), 10);
            const espera = (retryAfter > 0 ? retryAfter : Math.pow(2, intento)) * 1000;
            await new Promise(r => setTimeout(r, espera));
            continue;
          }
          lastErr = new Error(`HTTP ${res.status}`);
          break; // ni 429 ni OK → siguiente fuente
        } catch (e) {
          lastErr = e;
          break; // red caída → siguiente fuente
        }
      }
    }
    throw lastErr || new Error('HTTP --');
  }

  // Aplica un precio de API (vivo) y lo marca para persistirlo en el snapshot.
  // Nunca guarda avgPrice de compra: evitaría que el total cayera a precio de compra.
  function applyPrice(token, price, change24h) {
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) return;
    prices[token] = {
      price,
      change24h: change24h || 0,
      ts: Date.now(),
    };
    liveTokens.add(token);
  }

  // ── FALLBACKS SIN API KEY ──
  // Binance: un batch en /ticker/24hr da precio + cambio de todos los pares.
  async function fetchFromBinance(symbols) {
    if (!symbols.length) return {};
    const q = encodeURIComponent(JSON.stringify(symbols));
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = await res.json();
    const out = {};
    (Array.isArray(data) ? data : [data]).forEach(d => {
      const last = parseFloat(d.lastPrice);
      if (last > 0) out[d.symbol] = { price: last, change24h: parseFloat(d.priceChangePercent) || 0 };
    });
    return out;
  }

  // OKX: un ticker por instId (PI Network y similares no cotizan en Binance).
  async function fetchFromOkx(instIds) {
    const out = {};
    await Promise.all(instIds.map(async (instId) => {
      try {
        const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        const t = d?.data?.[0];
        if (t && parseFloat(t.last) > 0) {
          const last = parseFloat(t.last);
          const open = parseFloat(t.open24h);
          out[instId] = { price: last, change24h: open > 0 ? ((last - open) / open) * 100 : 0 };
        }
      } catch (e) { /* un fallo no tumba el resto */ }
    }));
    return out;
  }

  // Kraken: sin key, CORS abierto. Par formato XBTUSD para BTC, resto normal.
  async function fetchFromKraken(pairs) {
    if (!pairs.length) return {};
    const out = {};
    await Promise.all(pairs.map(async ({ token, pair }) => {
      try {
        const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        const ticker = Object.values(d.result || {})[0];
        if (ticker) {
          const price = parseFloat(ticker.c[0]);
          const open = parseFloat(ticker.o);
          if (price > 0) out[token] = { price, change24h: open > 0 ? ((price - open) / open) * 100 : 0 };
        }
      } catch (e) { /* fallo silencioso */ }
    }));
    return out;
  }

  // DeFiLlama: agregador con CORS abierto y sin key. Un solo batch de ids.
  async function fetchFromLlama(ids) {
    if (!ids.length) return {};
    const key = ids.map(id => `coingecko:${id}`).join(',');
    const res = await fetch(`https://coins.llama.fi/prices/current/${key}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);
    const d = await res.json();
    const out = {};
    Object.entries(d.coins || {}).forEach(([k, v]) => {
      if (v && parseFloat(v.price) > 0) out[k] = { price: v.price, change24h: 0 };
    });
    return out;
  }

  // Lanza Binance, Kraken y DeFiLlama en paralelo y devuelve la media
  // de los precios recibidos por cada token. Más fuentes = más estable.
  async function fillMissingFromFallbacks(assets) {
    const fetched = new Map();

    const binanceAssets = assets.filter(a => (PRICE_SOURCES[a.token] || {}).binance);
    const krakenAssets  = assets.filter(a => (PRICE_SOURCES[a.token] || {}).kraken);
    const llamaAssets   = assets.filter(a => (PRICE_SOURCES[a.token] || {}).llama);

    const [binanceRes, krakenRes, llamaRes] = await Promise.all([
      binanceAssets.length
        ? fetchFromBinance(binanceAssets.map(a => PRICE_SOURCES[a.token].binance))
            .catch(() => ({}))
        : {},
      krakenAssets.length
        ? fetchFromKraken(krakenAssets.map(a => ({ token: a.token, pair: PRICE_SOURCES[a.token].kraken })))
            .catch(() => ({}))
        : {},
      llamaAssets.length
        ? fetchFromLlama(llamaAssets.map(a => PRICE_SOURCES[a.token].llama))
            .catch(() => ({}))
        : {},
    ]);

    // Por cada token, promediar todos los precios recibidos.
    assets.forEach(a => {
      const src = PRICE_SOURCES[a.token] || {};
      const prices = [];
      const changes = [];
      const b = src.binance && binanceRes[src.binance];
      const k = krakenRes[a.token];
      const l = src.llama && llamaRes[`coingecko:${src.llama}`];
      if (b) { prices.push(b.price); changes.push(b.change24h); }
      if (k) { prices.push(k.price); changes.push(k.change24h); }
      if (l) { prices.push(l.price); changes.push(0); }
      if (prices.length > 0) {
        const avg = p => p.reduce((s, v) => s + v, 0) / p.length;
        fetched.set(a.token, { price: avg(prices), change24h: avg(changes) });
      }
    });

    return fetched;
  }

  // ── SPARKLINE DATA ──
  async function fetchSparklines() {
    // Sparklines requieren CoinGecko (datos históricos 7d), sin alternativa gratuita.
    // Desactivadas mientras la key demo siga dando 429.
  }

  function renderSparkline(token, isPositive) {
    const canvasId = `spark-${token}`;
    const data = sparklineData[token];
    if (!data || data.length === 0) return '<div class="sparkline-cell"></div>';

    const color = isPositive ? '#0ecb81' : '#f6465d';
    return `<div class="sparkline-cell"><canvas id="${canvasId}" width="80" height="32"></canvas></div>`;
  }

  function drawSparklines() {
    portfolio.forEach(asset => {
      const data = sparklineData[asset.token];
      if (!data || data.length === 0) return;
      const canvas = document.getElementById(`spark-${asset.token}`);
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const w = 80;
      const h = 32;
      canvas.width = w * 2;
      canvas.height = h * 2;
      ctx.scale(2, 2);

      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const change = prices[asset.token]?.change24h || 0;
      const color = change >= 0 ? '#0ecb81' : '#f6465d';

      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';

      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((val - min) / range) * (h - 4) - 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, color + '30');
      gradient.addColorStop(1, color + '00');
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }

  // ── COINGECKO API ──
  let fetchingPrices = false;   // evita ticks solapados (interval 60s + refresh manual)
  async function fetchPrices() {
    if (fetchingPrices) return;
    fetchingPrices = true;
    try {
      await fetchPricesImpl();
    } finally {
      fetchingPrices = false;
    }
  }

  async function fetchPricesImpl() {
    const assets = portfolio.filter(a => a.coingeckoId);
    if (assets.length === 0) {
      // No hay nada en cartera: sin llamadas, render vacío limpio.
      setLiveState('ok');
      updateLastUpdate();
      render();
      return;
    }

    const gotThisRound = new Map();   // token → {price, change24h} obtenidos AHORA

    // CoinGecko primero (mejor precio, algoritmo VWAP propio).
    // Con intervalo de 270s gastamos ~320 llamadas/día → aguanta todo el mes.
    try {
      const urls = coingeckoUrls('price', assets.map(a => a.coingeckoId).join(','));
      const res = await fetchCoinGecko(urls);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      assets.forEach(a => {
        const c = data[a.coingeckoId];
        if (c && c.usd > 0) gotThisRound.set(a.token, { price: c.usd, change24h: c.usd_24h_change || 0 });
      });
    } catch (err) {
      console.warn('CoinGecko fetch failed:', err.message);
    }

    // Fallback: Binance + Kraken + DeFiLlama en paralelo para lo que CoinGecko no dio.
    const missed = assets.filter(a => !gotThisRound.has(a.token));
    if (missed.length > 0) {
      const fbResults = await fillMissingFromFallbacks(missed);
      fbResults.forEach((v, t) => gotThisRound.set(t, v));
    }

    // Aplica los vivos y guarda el snapshot en localStorage (se sobrescribe).
    gotThisRound.forEach((v, t) => applyPrice(t, v.price, v.change24h));
    saveCachedPrices();

    // Token sin precio vivo en esta ronda → muestra el último snapshot guardado
    // (si existe). El render ya cae a avgPrice como último recurso.
    const notLive = assets.filter(a => !gotThisRound.has(a.token));

    const cacheMins = cachedPrices.ts
      ? Math.max(0, Math.floor((Date.now() - cachedPrices.ts) / 60000))
      : null;
    const missingAny = assets.filter(a => !(prices[a.token] && prices[a.token].price > 0));

    // Estado del punto: verde si toda la cartera tiene precio de este tick; ámbar
    // si algo viene del snapshot; rojo solo si no hay ni precio ni snapshot.
    let mode = 'ok';
    let mins = null;
    if (missingAny.length > 0 && !cachedPrices.ts) {
      mode = 'error';
    } else if (notLive.length > 0 && cachedPrices.ts) {
      mode = 'stale';
      mins = cacheMins;
    }
    setLiveState(mode, mins);
    if (mode === 'ok') updateLastUpdate();
    render();
    if (Object.keys(sparklineData).length === 0) {
      fetchSparklines().then(() => {
        render();
      });
    }
  }

  // ── CÁLCULOS ──
  function getAssetValue(asset) {
    if (!asset) return 0;
    const p = prices[asset.token]?.price || asset.avgPrice;
    return asset.qty * p;
  }

  function getAssetPnl(asset) {
    return getAssetValue(asset) - asset.costUsd;
  }

  function getAirdropValue(ad) {
    // Valor del airdrop SOLO con el precio en vivo de CoinGecko. Nunca con un
    // valor fijo: si no hay precio, el airdrop no aporta al total (coste real 0).
    return ad.qty * (prices[ad.token]?.price || 0);
  }

  function getTotalPortfolioValue() {
    return portfolio.reduce((sum, a) => sum + getAssetValue(a), 0);
  }

  function getTotalCost() {
    return portfolio.reduce((sum, a) => sum + a.costUsd, 0);
  }

  function getTotalAirdropValue() {
    return getAirdropAssets().reduce((sum, a) => sum + getAirdropValue(a), 0);
  }

  // Base de reparto: capital invertido (todo menos airdrops, que son coste 0 y
  // "dinero gratis"). Los cubos (Núcleo/Satélites/Refugio) se miden sobre esto
  // para que sumen 100% y sean coherentes.
  function getInvestedValue() {
    return portfolio.filter(a => a.tag !== 'airdrop').reduce((sum, a) => sum + getAssetValue(a), 0);
  }

  function getTotalStakingIncomeYearly() {
    return getStakingAssets().reduce((sum, s) => {
      const p = prices[s.token]?.price || s.avgPrice || 0;
      return sum + (s.qty * p * (s.apr || 0));
    }, 0);
  }

  function getSatPct() {
    const invested = getInvestedValue();
    if (invested === 0) return 0;
    const satVal = getSatTokens().reduce((sum, tok) => {
      return sum + getAssetValue(portfolio.find(a => a.token === tok));
    }, 0);
    return satVal / invested;
  }
  const getCosmosPct = getSatPct;   // alias para no romper llamadas internas

  // ── RENDER ──
  function render() {
    renderHero();
    renderCards();
    renderReparto();
    renderDcaSummary();
    renderCosmosBar();
    renderAssetTable();
    renderAllocation();
    renderEvolutionChart();
    renderStaking();
    renderAirdrops();

    renderTransactions();
    if (isInitialLoad) isInitialLoad = false;
  }

  function renderHero() {
    // portfolio ya incluye TODAS las monedas (también las tag staking/airdrop).
    // NO sumar getTotalAirdropValue por encima: duplicaría los airdrops.
    const totalValue = getTotalPortfolioValue();
    const totalCost = getTotalCost();
    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : 0;

    const heroEl = document.getElementById('hero-value');
    if (isInitialLoad) {
      animateValue(heroEl, 0, totalValue, 1200, (v) => fmtCurrency(v));
    } else if (prevTotal !== null && Math.abs(prevTotal - totalValue) > 0.01) {
      animateValue(heroEl, prevTotal, totalValue, 600, (v) => fmtCurrency(v));
    } else {
      heroEl.textContent = fmtCurrency(totalValue);
    }
    prevTotal = totalValue;

    const pnlEl = document.getElementById('hero-pnl');
    pnlEl.className = `hero-pnl ${pnlClass(totalPnl)}`;
    pnlEl.innerHTML = `
      <span id="hero-pnl-amount">${fmtCurrency(totalPnl)}</span>
      <span class="badge ${pnlClass(totalPnl)}" style="background:${totalPnl >= 0 ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)'}; color:${totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
        ${fmtPct(totalPnlPct)}
      </span>
    `;
  }

  // Chips del detalle de un cubo: lo que pesa en la cartera y su objetivo con la diferencia (verde si llega, amarillo si se pasa, rojo si falta).
  // Los usan el detalle y el panel del Reparto.
  function chipPesoHtml(pct) {
    return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--bg-input);color:var(--text-secondary);">${pct.toFixed(1)}% de la cartera</span>`;
  }
  function chipObjetivoHtml(actualPct, targetPct, margenSup = '4px') {
    if (targetPct == null) return '';
    const diffPct = actualPct - targetPct, ok = Math.abs(diffPct) < 1, over = diffPct > 1;
    const color = ok ? 'var(--accent-green)' : over ? 'var(--accent-yellow)' : 'var(--accent-red)';
    const bg    = ok ? 'var(--accent-green-bg)' : over ? 'var(--accent-yellow-bg, rgba(240,185,11,.12))' : 'var(--accent-red-bg)';
    const sign  = diffPct >= 0 ? '+' : '';
    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-top:${margenSup};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${bg};color:${color};">
          Objetivo ${targetPct.toFixed(1)}% &nbsp;·&nbsp; ${sign}${diffPct.toFixed(1)}%
        </span>`;
  }

  function setBarMark(wrapId, targetPct) {
    const wrap = document.getElementById(wrapId);
    if (!wrap || !targetPct) return;
    let mark = wrap.querySelector('.card-bar-mark');
    if (!mark) { mark = document.createElement('div'); mark.className = 'card-bar-mark'; wrap.appendChild(mark); }
    mark.style.left = `${Math.min(Math.max(targetPct, 0), 100)}%`;
  }

  function barColor(ratio, okColor) {
    if (ratio >= 1)    return okColor || '#0ecb81';
    if (ratio >= 0.85) return '#f0b90b';
    if (ratio >= 0.6)  return '#e87c2a';
    return '#f6465d';
  }

  function renderCards() {
    const total = getInvestedValue();   // base de cubos: capital invertido, sin airdrops (suman 100%)
    const btcAsset = portfolio.find(a => a.token === 'BTC');
    const ethAsset = portfolio.find(a => a.token === 'ETH');
    const btcEth = getAssetValue(btcAsset) + getAssetValue(ethAsset);
    const coreCost = (btcAsset?.costUsd || 0) + (ethAsset?.costUsd || 0);
    const corePnlPct = coreCost > 0 ? (btcEth - coreCost) / coreCost : 0;
    const coreWeight = total > 0 ? btcEth / total : 0;
    const cosmosPct = getCosmosPct();
    const stakingMonthly = getTotalStakingIncomeYearly() / 12;

    // Pone (o actualiza) una marca vertical en la barra al % del objetivo
    // Nucleo: peso en la cartera vs objetivo editable por el usuario.
    const coreTarget = settings.coreTarget ?? DEFAULT_CORE_TARGET;
    document.getElementById('card-btceth-pct').textContent = `${(coreWeight * 100).toFixed(1)}%`;
    const btcEthBar = document.getElementById('btceth-bar-fill');
    if (btcEthBar) {
      btcEthBar.style.width = `${Math.min(coreWeight * 100, 100)}%`;
      btcEthBar.style.background = barColor(coreTarget > 0 ? (coreWeight * 100) / coreTarget : 1, 'var(--accent-green)');
      btcEthBar.className = 'progress-fill';
    }
    setBarMark('btceth-bar-wrap', coreTarget);
    const btcEthLabel = document.getElementById('btceth-bar-label');
    if (btcEthLabel) {
      btcEthLabel.textContent = `Objetivo ${coreTarget}%`;
      btcEthLabel.style.color = barColor(coreTarget > 0 ? (coreWeight * 100) / coreTarget : 1, 'var(--accent-green)');
    }
    const iconsEl = document.getElementById('btceth-icons');
    if (iconsEl && !iconsEl.childElementCount) iconsEl.innerHTML = iconHtml('BTC', 'btc', 30) + iconHtml('ETH', 'eth', 30);
    const btcEthSub = document.getElementById('card-btceth-sub');
    if (btcEthSub) {
      btcEthSub.innerHTML = '';
    }
    // Satelites: todos los tokens de getSatTokens() presentes en la cartera.
    const cosmosNum = document.getElementById('card-cosmos-pct');
    cosmosNum.textContent = `${(cosmosPct * 100).toFixed(1)}%`;
    cosmosNum.classList.remove('negative');   // pasarse del objetivo ya no se pinta en rojo (como en Núcleo, Refugio y Bolsa)
    const cosmosIconsEl = document.getElementById('cosmos-icons');
    if (cosmosIconsEl && cosmosIconsEl.dataset.sig !== getSatTokens().join()) {   // se repinta si cambia la lista de satélites
      cosmosIconsEl.dataset.sig = getSatTokens().join();
      cosmosIconsEl.innerHTML = getSatTokens()
        .map(tok => { const c = COINS[tok]; return c ? iconHtml(tok, c.cssClass, 30) : ''; })
        .join('');
    }
    const cosmosStakingEl = document.getElementById('card-cosmos-staking');
    if (cosmosStakingEl) {
      cosmosStakingEl.innerHTML = '';
    }

    // Refugio (USDC): peso actual vs objetivo editable (defenseTarget en %).
    const usdcVal = getAssetValue(portfolio.find(a => a.token === 'USDC'));
    const defenseTargetFrac = (settings.defenseTarget || 0) / 100;
    const defenseWeight = total > 0 ? usdcVal / total : 0;
    const reached = defenseTargetFrac > 0 && defenseWeight >= defenseTargetFrac;
    document.getElementById('card-defense-pct').textContent = `${(defenseWeight * 100).toFixed(1)}%`;
    const defenseIconsEl = document.getElementById('defense-icons');
    if (defenseIconsEl && !defenseIconsEl.childElementCount) defenseIconsEl.innerHTML = iconHtml('USDC', 'usdc', 30);
    const defenseBar = document.getElementById('defense-bar-fill');
    const defRatio = defenseTargetFrac > 0 ? defenseWeight / defenseTargetFrac : 1;
    if (defenseBar) {
      defenseBar.style.width = `${Math.min(defenseWeight * 100, 100)}%`;
      defenseBar.style.background = barColor(defRatio, 'var(--accent-blue)');
      defenseBar.className = 'progress-fill';
    }
    setBarMark('defense-bar-wrap', settings.defenseTarget || 0);
    const need = defenseTargetFrac < 1 ? Math.max((defenseTargetFrac * total - usdcVal) / (1 - defenseTargetFrac), 0) : 0;
    const defenseLabel = document.getElementById('defense-bar-label');
    if (defenseLabel) {
      defenseLabel.textContent = reached
        ? `Objetivo ${settings.defenseTarget}% · Cubierto`
        : `Objetivo ${settings.defenseTarget}% · Faltan ${fmtCurrency(need)}`;
      defenseLabel.style.color = barColor(defRatio, 'var(--accent-blue)');
    }
    const defenseSub = document.getElementById('card-defense-sub');
    if (defenseSub) defenseSub.innerHTML = reached ? `<span class="positive">✓ Colchon cubierto</span>` : '';
    // Bolsa (acciones/ETF): lo registrado con kind 'stock'. Sin precio en vivo valen a precio de compra.
    const stocks = portfolio.filter(a => a.kind === 'stock');
    const bolsaVal = stocks.reduce((s, a) => s + getAssetValue(a), 0);
    const bolsaWeight = total > 0 ? bolsaVal / total : 0, bolsaTarget = settings.bolsaTarget || 0;
    document.getElementById('card-bolsa-pct').textContent = `${(bolsaWeight * 100).toFixed(1)}%`;
    document.getElementById('bolsa-icons').innerHTML = stocks.slice(0, 5).map(a => iconHtml(a.token, a.cssClass || 'stk', 30)).join('');
    const bolsaBar = document.getElementById('bolsa-bar-fill');
    const bolsaRatio = bolsaTarget > 0 ? (bolsaWeight * 100) / bolsaTarget : 1;
    bolsaBar.style.width = `${Math.min(bolsaWeight * 100, 100)}%`;
    bolsaBar.style.background = barColor(bolsaRatio, 'var(--accent-teal)');
    setBarMark('bolsa-bar-wrap', bolsaTarget);
    const bolsaLabel = document.getElementById('bolsa-bar-label');
    const bolsaFrac = Math.min(bolsaTarget / 100, 1);
    const bolsaNeed = bolsaFrac > 0 && bolsaFrac < 1 ? Math.max((bolsaFrac * total - bolsaVal) / (1 - bolsaFrac), 0) : 0;   // lo que hay que comprar para llegar
    bolsaLabel.textContent = bolsaTarget > 0 ? (bolsaNeed > 0 ? `Objetivo ${bolsaTarget}% · Faltan ${fmtCurrency(bolsaNeed)}` : `Objetivo ${bolsaTarget}% · Cubierto`) : 'Sin objetivo';
    bolsaLabel.style.color = bolsaTarget > 0 ? barColor(bolsaRatio, 'var(--accent-teal)') : '';
    document.getElementById('card-bolsa-sub').textContent = stocks.length ? `${stocks.length} ${stocks.length === 1 ? 'posición' : 'posiciones'} · a precio de compra` : 'Sin posiciones todavía';
    // listeners de edición de cubos — se registran en init(), no aquí
  }

  // Cuánto de lo que entra este mes va a bolsa y cuánto a crypto, según lo que le falta a cada lado para su objetivo tras aportar
  // (mismo mecanismo que la plantilla "objetivos"): el lado más lejos recibe más; si uno ya llega, todo va al otro. Todo en USD.
  function splitByGaps(total, stocks, monthly, target) {
    if (target <= 0 || monthly <= 0) return { bolsa: 0, crypto: monthly };
    const after = total + monthly;
    const gapB = Math.max(target * after - stocks, 0), gapC = Math.max((1 - target) * after - (total - stocks), 0);
    const gaps = gapB + gapC;
    const bolsa = gaps >= monthly ? monthly * gapB / gaps : gapB + (monthly - gaps) * target;
    return { bolsa, crypto: monthly - bolsa };
  }

  // Dinero mensual para invertir (settings.dcaTarget, en €) repartido entre bolsa y crypto según el ratio que defines con el
  // objetivo de bolsa (el resto es crypto). Sin objetivo de bolsa, todo es crypto como antes.
  function monthlySplit() {
    const totalUsd = (settings.dcaTarget || 0) / EUR_USD;
    const target = Math.min(Math.max((settings.bolsaTarget || 0) / 100, 0), 1);
    const stocks = portfolio.filter(a => a.kind === 'stock').reduce((s, a) => s + getAssetValue(a), 0);
    const { bolsa, crypto } = splitByGaps(getInvestedValue(), stocks, totalUsd, target);
    return { totalUsd, target, stocks, bolsaUsd: bolsa, cryptoUsd: crypto };
  }

  // Calcula el reparto de una plantilla: cuánto va a cada sitio este mes.
  // Las plantillas fijas (Conservadora/Moderada/Agresiva) reparten el dinero por sus % puros y, dentro de cada cubo, por los % de cada
  // moneda (coreSplit/satSplit), SIN mirar lo que ya tienes. Solo "Objetivos" analiza lo que tienes y lo que falta para llegar al objetivo.
  function computeReparto(strat) {
    // Cuánto del dinero mensual va a crypto y cuánto a bolsa (€ a USD interno):
    //  - Conservadora/Moderada/Agresiva: se divide por el ratio fijado (400 € al 50/50 → 200 y 200), sin mirar lo que ya tienes;
    //  - Objetivos: según lo que falta a cada lado (si en crypto vas sobrado, todo a bolsa, que es donde falta).
    const split0 = monthlySplit();
    const monthlyUsd = strat.byTargets ? split0.cryptoUsd : split0.totalUsd * (1 - split0.target);
    const bolsaUsd = strat.byTargets ? split0.bolsaUsd : split0.totalUsd * split0.target;
    const satBlocked = getCosmosPct() >= (cosmosTopPct() - 0.05);
    const btcVal = getAssetValue(portfolio.find(a => a.token === 'BTC'));
    const ethVal = getAssetValue(portfolio.find(a => a.token === 'ETH'));

    let toRefugio, toCore, toSat;
    if (strat.byTargets) {
      // Plantilla "objetivos": el dinero va a los cubos en proporción a lo que le
      // falta a cada uno para llegar a su objetivo tras aportar (mismo mecanismo
      // que BTC/ETH más abajo). Un cubo que ya llega no recibe; por eso no hay freno.
      const after = getInvestedValue() + monthlySplit().totalUsd;   // tras aportar todo el dinero, también el de bolsa
      const targets = [settings.defenseTarget || 0, settings.coreTarget ?? DEFAULT_CORE_TARGET, settings.satTarget ?? DEFAULT_SAT_TARGET];
      const vals = [
        getAssetValue(portfolio.find(a => a.token === 'USDC')),
        btcVal + ethVal,
        getSatTokens().reduce((s, tok) => s + getAssetValue(portfolio.find(a => a.token === tok)), 0),
      ];
      const gaps = targets.map((t, i) => Math.max(t / 100 * after - vals[i], 0));
      const gapSum = gaps[0] + gaps[1] + gaps[2];
      const targetSum = targets[0] + targets[1] + targets[2] || 1;
      [toRefugio, toCore, toSat] = gaps.map((g, i) => {
        if (gapSum <= 0) return monthlyUsd * targets[i] / targetSum;
        if (gapSum >= monthlyUsd) return monthlyUsd * g / gapSum;
        return g + (monthlyUsd - gapSum) * targets[i] / targetSum;
      });
    } else {
      const wR = strat.refugio, wC = strat.core, wS = strat.satelites;
      const sum = wR + wC + wS || 1;
      toRefugio = monthlyUsd * wR / sum;
      toCore = monthlyUsd * wC / sum;
      toSat = monthlyUsd * wS / sum;
    }

    const coreAfter = btcVal + ethVal + toCore;
    const btcGap = Math.max(settings.coreSplit.BTC * coreAfter - btcVal, 0);
    const ethGap = Math.max(settings.coreSplit.ETH * coreAfter - ethVal, 0);
    const gapSum = btcGap + ethGap;
    let toBtc, toEth;
    if (!strat.byTargets || gapSum <= 0) {
      toBtc = toCore * settings.coreSplit.BTC; toEth = toCore * settings.coreSplit.ETH;
    } else if (gapSum >= toCore) {
      toBtc = toCore * (btcGap / gapSum); toEth = toCore * (ethGap / gapSum);
    } else {
      const rest = toCore - gapSum;
      toBtc = btcGap + rest * settings.coreSplit.BTC; toEth = ethGap + rest * settings.coreSplit.ETH;
    }

    // Gap-logic para satelites: mismo mecanismo que el nucleo.
    const satTokens = Object.keys(settings.satSplit);
    const satVals = {};
    satTokens.forEach(tok => { satVals[tok] = getAssetValue(portfolio.find(a => a.token === tok)); });
    const satTotal = satTokens.reduce((s, tok) => s + satVals[tok], 0);
    const satAfter = satTotal + toSat;
    const satGaps = {};
    satTokens.forEach(tok => { satGaps[tok] = Math.max(settings.satSplit[tok] * satAfter - satVals[tok], 0); });
    const satGapSum = satTokens.reduce((s, tok) => s + satGaps[tok], 0);
    const satAlloc = {};
    satTokens.forEach(tok => {
      if (!strat.byTargets || satGapSum <= 0) {
        satAlloc[tok] = toSat * settings.satSplit[tok];
      } else if (satGapSum >= toSat) {
        satAlloc[tok] = toSat * (satGaps[tok] / satGapSum);
      } else {
        const rest = toSat - satGapSum;
        satAlloc[tok] = satGaps[tok] + rest * settings.satSplit[tok];
      }
    });

    return { toBtc, toEth, toRefugio, toSat, satAlloc, satBlocked, monthlyUsd, bolsaUsd };
  }

  // Una fila del Reparto (crypto o bolsa). pct = null: sin barra de progreso.
  function repartoRowHtml({ icon, label, amountText, pct = null, barColor = '', idle = false }) {
    const bar = pct === null ? '' : `
                <div class="reparto-prog-wrap">
                  <div class="reparto-prog-bar" style="width:${pct}%;background:${barColor}"></div>
                </div>`;
    return `
            <div class="reparto-row ${idle ? 'idle' : ''}">
              <span class="reparto-coin">${icon}</span>
              <div class="reparto-mid">
                <span class="reparto-name">${label}</span>${bar}
              </div>
              <span class="reparto-amt">${amountText}</span>
            </div>`;
  }

  // Grupo plegable (Crypto / Bolsa) dentro de una plantilla, con su subtotal.
  function repartoGroupHtml(key, title, totalUsd, inner) {
    return `<details class="reparto-group" data-g="${key}"${REPARTO_OPEN.has(key) ? ' open' : ''}><summary class="reparto-group-sum"><span>${title}</span><span class="reparto-group-tot">${fmtCurrency(totalUsd)}<svg class="strat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>${inner}</details>`;
  }

  // Reparto del mes: un desplegable por plantilla y, dentro, cuánto meter en cada
  // sitio este mes según esa estrategia. Abres las tres para comparar.
  // Panel "Plan de inversión": entradas (dinero, ratio, % dentro de cada lado) y resultado, todo leído de UN cálculo (Plan.modelo, js/modelo.js).
  // Escribe en los ajustes que ya existen (dcaTarget, bolsaTarget, coreTarget/satTarget/defenseTarget) y en stockSplit (% de cada acción de la bolsa).
  const PL_ICONO = { nucleo: 'sp', satelites: 'cush', refugio: 'sv' }, PL_COLOR = { crypto: 'var(--accent-green)', bolsa: 'var(--accent-teal)' };
  const PL_NOMBRE = { nucleo: 'Núcleo', satelites: 'Satélites', refugio: 'Refugio' };
  const PL_TONO = { crypto: 'background:var(--accent-green-bg);color:var(--accent-green);', bolsa: 'background:rgba(45,212,191,.12);color:var(--accent-teal);',
    bien: 'background:var(--accent-green-bg);color:var(--accent-green);', mal: 'background:var(--accent-red-bg);color:var(--accent-red);' };
  const plPct = (f) => (f * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' %';

  // Lo ya comprado este mes (mismo mes que llena la tarjeta DCA), en USD interno
  function dcaMonthBoughtUsd() {
    const n = new Date(), hoy = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`, mk = dcaMonthKey(hoy);
    return transactions.filter(tx => dcaMonthKey(tx.date) === mk && tx.type === 'Compra' && tx.totalUsd > 0).reduce((s, tx) => s + tx.totalUsd, 0);
  }

  function planInput() {
    const val = (toks) => toks.reduce((s, t) => s + getAssetValue(portfolio.find(a => a.token === t && a.tag !== 'airdrop')), 0);
    const bolsa = settings.bolsaTarget || 0, rc = 100 - bolsa;
    const t = [settings.coreTarget ?? DEFAULT_CORE_TARGET, settings.satTarget ?? DEFAULT_SAT_TARGET, settings.defenseTarget || 0].map(v => rc > 0 ? v * 100 / rc : 0);
    const nuc = bolsaNucleo(), pn = nuc ? plBolsaActual()[nuc] : 0, bs = { nucleo: pn, satelites: 100 - pn };   // núcleo = la acción marcada; satélites = el resto
    const stk = portfolio.filter(a => a.kind === 'stock' && a.tag !== 'airdrop');
    return { mensual: Math.max(monthlySplit().totalUsd - dcaMonthBoughtUsd(), 0), ratioCrypto: rc,
      pesos: { crypto: { nucleo: t[0], satelites: t[1], refugio: t[2] }, bolsa: { nucleo: bs.nucleo, satelites: bs.satelites } },
      valores: { crypto: { nucleo: val(['BTC', 'ETH']), satelites: val(getSatTokens()), refugio: val(['USDC']) },
        bolsa: { nucleo: stk.filter(a => a.token === nuc).reduce((s, a) => s + getAssetValue(a), 0), satelites: stk.filter(a => a.token !== nuc).reduce((s, a) => s + getAssetValue(a), 0) } } };
  }

  // Dónde cae el dinero de un cubo: reparto interno de la app (coreSplit / satSplit; bolsa: S&P 500 y el resto a partes iguales)
  function planDonde(lado, cubo, usd) {
    let pos;
    if (lado === 'crypto') pos = cubo === 'nucleo' ? Object.entries(settings.coreSplit) : cubo === 'satelites' ? Object.entries(settings.satSplit) : [['USDC', 1]];
    else { const nuc = bolsaNucleo(), pb = plBolsaActual(); pos = bolsaLista().filter(x => (cubo === 'nucleo') === (x[0] === nuc)).map(x => [x[1], pb[x[0]]]); }
    const s = pos.reduce((x, [, w]) => x + w, 0);
    if (s <= 0) return '';
    return pos.map(([n, w]) => `${n} ${fmtCurrency(usd * w / s)}`).join(' · ');
  }

  // Panel del Reparto del mes: dinero al mes y ratio crypto/bolsa (reajusta Núcleo/Satélites/Refugio con fitTargetsTo100). El reparto de la bolsa
  // por acción (stockSplit) y su núcleo (bolsaCore) se editan con el lápiz de la tarjeta Bolsa.
  // Tus acciones/ETF reales: las que has añadido con el buscador (settings.customStocks) y las que tienes en cartera. [token, nombre, clase del icono]
  function bolsaListaReal() {
    const toks = [...new Set([...Object.keys(settings.customStocks || {}), ...portfolio.filter(a => a.kind === 'stock').map(a => a.token)])];
    return toks.map(t => [t, COINS[t]?.name || t, COINS[t]?.cssClass || 'stk']);
  }
  // Núcleo de la bolsa: la que marques con la estrella; si no, el primer ETF del S&P 500 que tengas (europeo o americano); si no tienes ninguno, el S&P 500 ('SP', virtual).
  function bolsaNucleo() {
    const l = bolsaListaReal().map(x => x[0]);
    return l.includes(settings.bolsaCore) ? settings.bolsaCore : ['VUAA', 'VUSA', 'CSPX', 'SXR8', 'SPYL', 'VOO', 'SPY', 'IVV', 'SPLG'].find(t => l.includes(t)) || 'SP';
  }
  // Lista que se reparte: tus acciones y, si ninguna es núcleo, el S&P 500 delante como núcleo a comprar (sin posición todavía).
  function bolsaLista() {
    const l = bolsaListaReal(), nuc = bolsaNucleo();
    const lista = nuc === 'SP' && !l.some(x => x[0] === 'SP') ? [['SP', 'S&P 500', 'sp'], ...l] : l;
    return [...lista].sort((x, y) => (y[0] === nuc) - (x[0] === nuc));   // el núcleo, el primero
  }
  // Nombre CORTO de una acción/ETF de tu lista, para el editor de la Bolsa (una fila = una línea): los ETF habituales con una etiqueta que dice qué
  // son (no es lo mismo "Global" que "S&P 500"); el resto, el nombre sin sufijos legales y con dos palabras como mucho.
  const ETF_CORTO = { VUAA: 'S&P 500', VUSA: 'S&P 500 Dist', CSPX: 'S&P 500', SXR8: 'S&P 500', SPYL: 'S&P 500', VOO: 'S&P 500', SPY: 'S&P 500', IVV: 'S&P 500',
    VWCE: 'Global', VWRL: 'Global Dist', VT: 'Global', IWDA: 'MSCI World', EUNL: 'MSCI World', SWDA: 'MSCI World', VTI: 'USA total', VXUS: 'Internacional',
    EQQQ: 'Nasdaq 100', CNDX: 'Nasdaq 100', QQQ: 'Nasdaq 100', EMIM: 'Emergentes', VUG: 'Growth', SCHD: 'Dividendos', VYM: 'Dividendos' };
  function bolsaNombre(tok) {
    if (ETF_CORTO[tok]) return ETF_CORTO[tok];
    const nombre = String(bolsaLista().find(x => x[0] === tok)?.[1] || COINS[tok]?.name || tok).replace(/[<>&"']/g, '');
    const sufijos = new Set(['inc', 'corp', 'corporation', 'co', 'ltd', 'plc', 'holdings', 'common', 'stock', 'ordinary', 'share', 'shares', 'class', 'a', 'b', 'c']);
    return nombre.replace(/[,.]/g, ' ').split(' ').filter(w => w && !sufijos.has(w.toLowerCase())).slice(0, 2).join(' ') || nombre;
  }
  // % de cada acción sobre el total de bolsa (a partes iguales hasta que lo fijes)
  function plBolsaActual() {
    const sp = settings.stockSplit || {}, l = bolsaLista();
    return Object.fromEntries(l.map(([tk]) => [tk, (sp[tk] ?? 1 / l.length) * 100]));
  }

  // Bolsa de una plantilla: en bolsa no hay refugio, así que el dinero se reparte entre núcleo (S&P 500) y satélites (el resto) en la misma
  // proporción que la plantilla da a Núcleo y a Satélites; los satélites, entre sus acciones por los % relativos del panel Reparto de la bolsa.
  function bolsaPorPlantilla(strat, usd) {
    const wC = strat.byTargets ? (settings.coreTarget ?? DEFAULT_CORE_TARGET) : strat.core, wS = strat.byTargets ? (settings.satTarget ?? DEFAULT_SAT_TARGET) : strat.satelites;
    const l = bolsaLista().map(x => x[0]), nuc = bolsaNucleo(), sats = l.filter(t => t !== nuc), pb = plBolsaActual();
    const nucleo = !nuc ? 0 : !sats.length ? usd : wC + wS > 0 ? usd * wC / (wC + wS) : 0, sat = usd - nucleo, suma = sats.reduce((s, t) => s + pb[t], 0);
    return Object.fromEntries(l.map(t => [t, t === nuc ? nucleo : suma > 0 ? sat * pb[t] / suma : sat / sats.length]));
  }

  function planPanelesHtml() {
    const rc = 100 - (settings.bolsaTarget || 0);
    return `<div class="cards-grid">
        <div class="card"><div class="card-label">Dinero al mes para invertir (€)</div><div class="add-field"><input type="number" min="0" step="10" data-plan="dca" value="${settings.dcaTarget || 0}"></div></div>
        <div class="card"><div class="card-label">Ratio crypto / bolsa</div><input type="range" class="pl-rango" min="0" max="100" step="1" data-plan="rc" value="${rc}">
          <div class="strat-head"><span class="strat-legend lg-core">Crypto ${rc} %</span><span class="strat-legend lg-bolsa">Bolsa ${100 - rc} %</span></div>
          <div class="strat-bar"><span class="seg seg-core" style="width:${rc}%"></span><span class="seg seg-bolsa" style="width:${100 - rc}%"></span></div></div>
      </div>`;
  }

  function renderPlanPanel() {
    const box = document.getElementById('plan-panel');
    if (!box || typeof Plan === 'undefined') return;
    const p = planInput(), m = Plan.modelo(p), pr = Plan.proyeccion({ ...p, mensual: monthlySplit().totalUsd }, [12, 24]);   // la proyección usa el mes entero
    const rc = p.ratioCrypto;
    const llega = pr.llega === 0 ? 'Ya estás' : pr.llega === null ? 'No en 20 años' : `${pr.llega} ${pr.llega === 1 ? 'mes' : 'meses'}`;
    const chip = (lado, txt) => `<span class="section-badge" style="${PL_TONO[lado]}white-space:nowrap">${txt}</span>`;
    const lados = Plan.LADOS.map((l) => {
      const L = m.lados[l];
      const filas = L.cubos.map((hj) => `
        <div class="reparto-row ${hj.rec < 0.005 ? 'idle' : ''}">
          <span class="reparto-coin"><span class="token-icon ${PL_ICONO[hj.cubo]}">${PL_NOMBRE[hj.cubo][0]}</span></span>
          <div class="reparto-mid"><span class="reparto-name">${PL_NOMBRE[hj.cubo]}</span>
            <span style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">${chipPesoHtml(hj.peso * 100)}${chipObjetivoHtml(hj.peso * 100, hj.objetivo * 100, '0')}</span>
            ${hj.rec >= 0.005 ? `<span class="card-sub" style="margin:0;color:var(--text-muted)">${planDonde(l, hj.cubo, hj.rec)}</span>` : ''}</div>
          <span class="reparto-amt">${hj.rec >= 0.005 ? fmtCurrency(hj.rec) : '—'}</span></div>`).join('');
      return `<div class="card" style="border-top:3px solid ${PL_COLOR[l]}">
        <div class="strat-head"><span class="strat-name" style="color:${PL_COLOR[l]}">${l === 'crypto' ? 'Crypto' : 'Bolsa'}</span><span style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end">${chipPesoHtml(L.peso * 100)}${chipObjetivoHtml(L.peso * 100, L.objetivo * 100, '0')}</span></div>
        <div class="cosmos-bar-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(L.peso * 100, 100)}%;background:${PL_COLOR[l]}"></div><div class="card-bar-mark" style="left:${L.objetivo * 100}%"></div></div></div>
        <div class="card-sub">Este mes: <strong>${fmtCurrency(L.rec)}</strong></div>
        ${L.rec < 0.005 && L.peso > L.objetivo ? '<div style="margin-top:6px"><span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--accent-yellow-bg, rgba(240,185,11,.12));color:var(--accent-yellow);">Este mes no recibe: ya pasa su objetivo</span></div>' : ''}<div class="reparto-group">${filas}</div></div>`;
    }).join('');
    box.innerHTML = `
      ${planPanelesHtml()}
      <div class="cards-grid" style="margin-top:14px">
        <div class="card"><div class="card-label">Cartera</div><div class="card-value">${fmtCurrency(m.total)}</div>
          <div class="pl-chips">${chip('crypto', `Crypto <b>${fmtCurrency(m.lados.crypto.valor)}</b>`)}${chip('bolsa', `Bolsa <b>${fmtCurrency(m.lados.bolsa.valor)}</b>`)}</div></div>
        <div class="card"><div class="card-label">Este mes a crypto</div><div class="card-value" style="color:${PL_COLOR.crypto}">${fmtCurrency(m.lados.crypto.rec)}</div><div class="card-sub">de los ${fmtCurrency(p.mensual)} que te faltan este mes</div></div>
        <div class="card"><div class="card-label">Este mes a bolsa</div><div class="card-value" style="color:${PL_COLOR.bolsa}">${fmtCurrency(m.lados.bolsa.rec)}</div><div class="card-sub">de los ${fmtCurrency(p.mensual)} que te faltan este mes</div></div>
        <div class="card"><div class="card-label">Llegas al ratio en</div><div class="card-value">${llega}</div><div class="card-sub">ratio ${rc} / ${100 - rc}, con ${fmtCurrency(monthlySplit().totalUsd)} al mes</div></div>
      </div>
      ${m.avisos.map(x => `<div class="warning-banner">⚠ ${x}</div>`).join('')}
      <p class="reparto-hint">Sin contar variaciones de precio: crypto pasa de ${plPct(m.lados.crypto.peso)} a ${plPct(pr.pesos[12].crypto)} en 12 meses y a ${plPct(pr.pesos[24].crypto)} en 24; bolsa, de ${plPct(m.lados.bolsa.peso)} a ${plPct(pr.pesos[12].bolsa)} y a ${plPct(pr.pesos[24].bolsa)}.</p>
      <div class="cards-grid">${lados}</div>`;
  }

  function onPlanPanelChange(e) {
    const k = e.target.dataset?.plan;
    if (!k) return;
    const num = (i) => Math.max(parseFloat(i.value) || 0, 0);
    if (k === 'dca') settings.dcaTarget = num(e.target);
    else if (k === 'rc') { settings.bolsaTarget = 100 - Math.min(num(e.target), 100); fitTargetsTo100(); }   // el ratio fija la bolsa y los otros tres se reajustan, como con el lápiz de Bolsa
    persist();
    render();
  }

  function renderReparto() {
    renderPlanPanel();
    const split = monthlySplit(), monthlyUsd = split.cryptoUsd, bolsaUsd = split.bolsaUsd;   // bolsaUsd 0 = sin objetivo de bolsa
    const badge = document.getElementById('reparto-amount-badge');
    if (badge) badge.textContent = `${fmtCurrency(split.totalUsd)}/mes`;

    const stratWrap = document.getElementById('reparto-strategies');
    if (stratWrap) {
      stratWrap.innerHTML = Object.entries(STRATEGIES).map(([key, s]) => {
        const name = key.charAt(0).toUpperCase() + key.slice(1);
        const r = computeReparto(s);
        // Cabecera (números y barra): los % fijos de la plantilla o, en "objetivos", los que salen hoy.
        const share = (usd) => r.monthlyUsd > 0 ? Math.round(usd / r.monthlyUsd * 100) : 0;
        const mix = s.byTargets ? { refugio: share(r.toRefugio), core: share(r.toBtc + r.toEth), satelites: share(r.toSat) } : s;
        // Progreso actual de cada token respecto a su objetivo
        const coreTotal = getAssetValue(portfolio.find(a => a.token === 'BTC')) + getAssetValue(portfolio.find(a => a.token === 'ETH'));
        const satTotal  = getSatTokens().reduce((s, t) => s + getAssetValue(portfolio.find(a => a.token === t)), 0);
        const invTotal  = getInvestedValue();
        const defFrac   = (settings.defenseTarget || 0) / 100;

        function rowProgress(token) {
          const val = getAssetValue(portfolio.find(a => a.token === token));
          if (token === 'BTC') return coreTotal > 0 ? Math.min((val / coreTotal) / settings.coreSplit.BTC, 1) : 0;
          if (token === 'ETH') return coreTotal > 0 ? Math.min((val / coreTotal) / settings.coreSplit.ETH, 1) : 0;
          if (token === 'USDC') return defFrac > 0 && invTotal > 0 ? Math.min((val / invTotal) / defFrac, 1) : 0;
          const split = settings.satSplit[token];
          return (split > 0 && satTotal > 0) ? Math.min((val / satTotal) / split, 1) : 0;
        }

        const satRows = getSatTokens().map(tok => {
          const c = COINS[tok] || { cssClass: tok.toLowerCase() };
          const amount = r.satAlloc?.[tok] ?? 0;
          return { token: tok, cssClass: c.cssClass, amount, label: tok };
        });
        const rows = [
          { token: 'BTC',  cssClass: 'btc',  amount: r.toBtc,     label: 'BTC'  },
          { token: 'ETH',  cssClass: 'eth',  amount: r.toEth,     label: 'ETH'  },
          { token: 'USDC', cssClass: 'usdc', amount: r.toRefugio, label: 'USDC' },
          ...satRows,
        ];
        const detail = rows.map(row => {
          const on = row.amount >= 0.01;
          const prog = rowProgress(row.token);
          const pct = (prog * 100).toFixed(0);
          const barColor = prog >= 1 ? 'var(--accent-green)' : prog >= 0.8 ? 'var(--accent-yellow)' : 'var(--accent-blue)';
          return repartoRowHtml({ icon: iconHtml(row.token, row.cssClass, 24), label: row.label, amountText: on ? fmtCurrency(row.amount) : `${pct}%`, pct, barColor, idle: !on });
        }).join('');
        const bAmt = bolsaPorPlantilla(s, r.bolsaUsd), bNuc = bolsaNucleo();
        const stockRows = bolsaLista().length ? bolsaLista().map(([tok, name, css]) => repartoRowHtml({ icon: iconHtml(tok, css, 24), label: name + (tok === bNuc ? ' · núcleo' : ''), amountText: fmtCurrency(bAmt[tok]) })).join('')
          : '<div class="card-sub" style="padding:8px 12px">Añade acciones con el buscador del botón + para repartir la bolsa.</div>';
        return `
          <details class="strat-block ${key === settings.strategy ? 'active' : ''}" data-strat="${key}" open>
            <summary class="strat-sum">
              <div class="strat-head">
                <span class="strat-name">${name}</span>
                <span class="strat-head-right">
                  <span class="strat-legend"><span class="lg-refugio">${mix.refugio}</span> · <span class="lg-core">${mix.core}</span> · <span class="lg-sat">${mix.satelites}</span></span>
                  <svg class="strat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </div>
              <div class="strat-bar">
                <span class="seg seg-refugio" style="width:${mix.refugio}%"></span>
                <span class="seg seg-core" style="width:${mix.core}%"></span>
                <span class="seg seg-sat" style="width:${mix.satelites}%"></span>
              </div>
            </summary>
            <div class="reparto-list">${settings.bolsaTarget > 0 ? repartoGroupHtml('crypto', 'Crypto', r.monthlyUsd, detail) + repartoGroupHtml('bolsa', 'Bolsa', r.bolsaUsd, stockRows) : detail}</div>
          </details>`;
      }).join('');
    }
    if (stratWrap && !stratWrap.dataset.bound) {
      stratWrap.dataset.bound = '1';
      // Clic en una plantilla la marca como la tuya (se guarda y viaja por el gist),
      // sin re-renderizar para no cerrar los desplegables que tengas abiertos.
      stratWrap.addEventListener('click', (e) => {
        if (e.target.closest('.reparto-group-sum')) return;   // plegar/desplegar un grupo no elige la plantilla
        const block = e.target.closest('.strat-block');
        if (!block) return;
        settings.strategy = block.dataset.strat;
        persist();
        stratWrap.querySelectorAll('.strat-block').forEach(b => b.classList.toggle('active', b === block));
      });
      // `toggle` no burbujea: se escucha en captura para recordar qué grupos tienes abiertos.
      stratWrap.addEventListener('toggle', (e) => {
        const g = e.target.dataset && e.target.dataset.g;
        if (g) { e.target.open ? REPARTO_OPEN.add(g) : REPARTO_OPEN.delete(g); }
      }, true);
    }
  }

  function editDcaTarget() {
    const cur = settings.dcaTarget;
    const input = prompt('Dinero mensual para invertir, crypto y bolsa (en €):', cur);
    if (input === null) return;
    const val = parseFloat(String(input).replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    settings.dcaTarget = val;
    persist();
    render();
  }

  // Ajusta Núcleo, Satélites y Refugio en proporción para que, con la Bolsa, los cuatro objetivos sumen 100 %.
  // El reparto interno de cada cubo (BTC/ETH, satélites) no se toca. El redondeo lo absorbe el núcleo.
  function fitTargetsTo100() {
    const libre = 100 - (settings.bolsaTarget || 0);
    const actual = [settings.coreTarget ?? DEFAULT_CORE_TARGET, settings.satTarget ?? DEFAULT_SAT_TARGET, settings.defenseTarget || 0];
    const suma = actual.reduce((s, v) => s + v, 0);
    if (suma <= 0) return;   // nada que repartir
    const nuevo = actual.map(v => Math.round(v * libre / suma));
    nuevo[0] += libre - nuevo.reduce((s, v) => s + v, 0);
    [settings.coreTarget, settings.satTarget, settings.defenseTarget] = nuevo;
  }

  function editBolsaTarget() {
    openBucketEditModal({ title: 'Bolsa', targetKey: 'bolsaTarget', splitKey: 'stockSplit', defaultTarget: 0, color: 'var(--accent-teal)', stock: true });
  }

  function editDefenseTarget() {
    const cur = settings.defenseTarget;
    const input = prompt('Objetivo de refugio (USDC) en % de la cartera:', cur);
    if (input === null) return;
    const val = parseFloat(String(input).replace(',', '.'));
    if (isNaN(val) || val < 0 || val > 100) return;
    settings.defenseTarget = val;
    persist();
    render();
  }

  // Modal de edición de cubo: % objetivo + tokens con sus % internos
  function openBucketEditModal({ title, targetKey, splitKey, defaultTarget, color, stock = false }) {
    const curTarget = settings[targetKey] ?? defaultTarget;
    // Bolsa (stock): las acciones salen de tu lista (bolsaLista) con su % (stockSplit) y la ★ marca el núcleo
    const curSplit  = stock ? Object.fromEntries(Object.entries(plBolsaActual()).map(([t, p]) => [t, p / 100])) : { ...(settings[splitKey] || {}) };
    let nucleo = stock ? bolsaNucleo() : null;

    const ov = document.createElement('div');
    ov.className = 'modal-overlay open';
    ov.innerHTML = `
      <div class="modal" style="max-width:440px;">
        <div class="add-modal-head">
          <h3 style="color:${color};margin:0;">${title}</h3>
          <button type="button" class="modal-close" aria-label="Cerrar">&times;</button>
        </div>

        <div style="padding:0 24px 24px;">

          <div style="margin-top:20px;">
            <label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);display:block;margin-bottom:10px;">% objetivo del cubo en la cartera</label>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="number" id="bucket-target" min="0" max="100" step="1" value="${curTarget}"
                style="width:80px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:22px;font-weight:700;padding:8px 12px;outline:none;text-align:center;">
              <span style="color:var(--text-muted);font-size:18px;">%</span>
            </div>
          </div>

          <div style="margin-top:24px;">
            <label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);display:block;margin-bottom:10px;">${stock ? 'Acciones y reparto interno (★ marca el núcleo)' : 'Monedas y reparto interno'}</label>
            <div style="position:relative;margin-bottom:12px;">
              <div class="search-wrap" style="cursor:text;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="bucket-search" class="tx-search" placeholder="${stock ? 'Añadir acción o ETF (p. ej. VUAA, NVDA)…' : 'Añadir moneda...'}" style="width:100%;">
                <svg id="bucket-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);flex-shrink:0;cursor:pointer;"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div id="bucket-suggestions" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:200;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:180px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.4);"></div>
            </div>
            <div id="bucket-tokens" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-muted);margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
            <span>Total asignado: <strong id="bucket-total" style="color:var(--text-primary);font-size:14px;">0%</strong></span>
            <span id="bucket-warn" style="color:var(--accent-red);display:none;font-weight:600;">Debe sumar 100%</span>
          </div>

          <div class="sync-actions" style="margin-top:20px;">
            <button type="button" id="bucket-save" class="add-submit">Guardar</button>
            <button type="button" class="add-cancel modal-close">Cancelar</button>
          </div>

        </div>
      </div>`;
    document.body.appendChild(ov);

    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.modal-close')) close(); });

    // tokens actualmente en el split
    const tokenMap = { ...curSplit }; // token → fracción

    function renderTokens() {
      const total = Object.values(tokenMap).reduce((s, v) => s + v * 100, 0);
      document.getElementById('bucket-total').textContent = `${Math.round(total)}%`;
      document.getElementById('bucket-warn').style.display = Math.abs(total - 100) > 1 && Object.keys(tokenMap).length > 0 ? '' : 'none';
      document.getElementById('bucket-tokens').innerHTML = (stock ? Object.entries(tokenMap).sort((x, y) => (y[0] === nucleo) - (x[0] === nucleo)) : Object.entries(tokenMap)).map(([tok, frac]) => `
        <div style="display:flex;align-items:center;gap:12px;background:var(--bg-input);border-radius:var(--radius-sm);padding:10px 14px;">
          ${iconHtml(tok, COINS[tok]?.cssClass || '', 26)}
          <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;font-size:14px;" title="${stock ? bolsaLista().find(x => x[0] === tok)?.[1] || tok : tok}">${tok}${stock ? ` <span style="font-weight:400;font-size:12px;color:var(--text-muted);">${bolsaNombre(tok)}${tok === nucleo ? ' · núcleo' : ''}</span>` : ''}</span>
          <input type="number" min="0" max="100" step="1" value="${Math.round(frac * 100)}"
            data-tok="${tok}"
            style="width:64px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:15px;font-weight:600;padding:5px 10px;outline:none;text-align:center;">
          <span style="color:var(--text-muted);font-size:13px;">%</span>
          ${stock ? `<button type="button" class="tx-btn" data-star="${tok}" title="Marcar como núcleo de la bolsa" style="width:34px;padding:0;text-align:center;${tok === nucleo ? 'color:var(--accent-yellow);' : ''}">${tok === nucleo ? '★' : '☆'}</button>` : ''}
          <button type="button" class="tx-btn tx-del" data-remove="${tok}" title="Quitar" aria-label="Quitar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>`).join('');

      // eventos de los inputs y botones de borrar
      document.querySelectorAll('#bucket-tokens input[data-tok]').forEach(inp => {
        inp.addEventListener('input', () => {
          tokenMap[inp.dataset.tok] = parseFloat(inp.value) / 100 || 0;
          const t = Object.values(tokenMap).reduce((s, v) => s + v * 100, 0);
          document.getElementById('bucket-total').textContent = `${Math.round(t)}%`;
          document.getElementById('bucket-warn').style.display = Math.abs(t - 100) > 1 && Object.keys(tokenMap).length > 0 ? '' : 'none';
        });
      });
      document.querySelectorAll('#bucket-tokens button[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => { delete tokenMap[btn.dataset.remove]; renderTokens(); });
      });
      document.querySelectorAll('#bucket-tokens [data-star]').forEach(b => {
        b.addEventListener('click', () => { nucleo = b.dataset.star; renderTokens(); });
      });
    }
    renderTokens();

    // buscador + desplegable
    const searchEl  = document.getElementById('bucket-search');
    const sugEl     = document.getElementById('bucket-suggestions');
    const portfolioTokens = portfolio.map(a => a.token);
    const allTokens = [...new Set([...portfolioTokens, ...Object.keys(COINS)])];

    // Bolsa: el buscador de acciones (el mismo del botón +); al elegir una se registra en tu lista de acciones
    const sugDatos = {};
    let esperaSug;
    function showStockSuggestions(q) {
      clearTimeout(esperaSug);
      const pintar = (lista) => {
        lista.forEach(c => { sugDatos[c.symbol] = c; });
        if (!lista.length) { sugEl.style.display = 'none'; return; }
        sugEl.style.display = '';
        sugEl.innerHTML = lista.map(c => {
          const sym = c.symbol, nombre = String(c.name || '').replace(/[<>&"']/g, ''), yaEsta = tokenMap[sym] != null;
          return `<div data-add="${sym}" style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;opacity:${yaEsta ? '.45' : '1'};">
            ${iconHtml(sym, COINS[sym]?.cssClass || 'stk', 22)}
            <span style="font-size:13px;font-weight:600;">${sym}</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${nombre}</span>
            ${yaEsta ? '<span style="font-size:10px;color:var(--text-muted);">ya añadida</span>' : ''}
          </div>`;
        }).join('');
        sugEl.querySelectorAll('[data-add]').forEach(el => {
          el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-input)');
          el.addEventListener('mouseleave', () => el.style.background = '');
          el.addEventListener('mousedown', e => {
            e.preventDefault();
            const c = sugDatos[el.dataset.add], sym = c.symbol;
            if (COINS[sym] && COINS[sym].kind !== 'stock') return;   // ese símbolo ya es una moneda crypto
            if (!COINS[sym] && sym !== 'SP') {
              const previo = settings.customStocks;
              settings.customStocks = Object.assign({}, previo, { [sym]: { name: c.name } });
              registerCustomStocks();
              if (!COINS[sym]) { settings.customStocks = previo; return; }   // rechazada: no se guarda
              persist();
            }
            if (tokenMap[sym] == null) tokenMap[sym] = 0;
            searchEl.value = ''; sugEl.style.display = 'none';
            renderTokens();
          });
        });
      };
      if (!q) { pintar(bolsaLista().map(([t, n]) => ({ symbol: t, name: n }))); return; }
      esperaSug = setTimeout(async () => { try { pintar(await searchStocks(q)); } catch (e) { sugEl.style.display = 'none'; } }, 400);
    }

    function showSuggestions(q) {
      if (stock) { showStockSuggestions(q); return; }
      const matches = q
        ? allTokens.filter(t => t.includes(q) || (COINS[t]?.name || '').toUpperCase().includes(q)).slice(0, 10)
        : portfolioTokens.slice(0, 10);   // sin texto → monedas del portfolio
      if (!matches.length) { sugEl.style.display = 'none'; return; }
      sugEl.style.display = '';
      sugEl.innerHTML = matches.map(t => {
        const inMap = !!tokenMap[t];
        return `<div data-add="${t}" style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;opacity:${inMap ? '.45' : '1'};">
          ${iconHtml(t, COINS[t]?.cssClass || '', 22)}
          <span style="font-size:13px;font-weight:600;">${t}</span>
          <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${COINS[t]?.name || ''}</span>
          ${inMap ? '<span style="font-size:10px;color:var(--text-muted);">ya añadida</span>' : ''}
        </div>`;
      }).join('');
      sugEl.querySelectorAll('[data-add]').forEach(el => {
        el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-input)');
        el.addEventListener('mouseleave', () => el.style.background = '');
        el.addEventListener('mousedown', e => {
          e.preventDefault();
          if (!tokenMap[el.dataset.add]) tokenMap[el.dataset.add] = 0;
          searchEl.value = '';
          sugEl.style.display = 'none';
          renderTokens();
        });
      });
    }

    const chevronEl = document.getElementById('bucket-chevron');

    searchEl.addEventListener('input', () => showSuggestions(searchEl.value.trim().toUpperCase()));
    chevronEl.addEventListener('click', () => {
      if (sugEl.style.display === 'none') showSuggestions(searchEl.value.trim().toUpperCase());
      else sugEl.style.display = 'none';
    });
    document.addEventListener('click', e => {
      if (!sugEl.contains(e.target) && e.target !== searchEl && e.target !== chevronEl) sugEl.style.display = 'none';
    });

    // guardar
    document.getElementById('bucket-save').addEventListener('click', () => {
      const target = parseFloat(document.getElementById('bucket-target').value);
      if (isNaN(target) || target < 0 || target > 100) return;
      const total = Object.values(tokenMap).reduce((s, v) => s + v * 100, 0);
      if (Object.keys(tokenMap).length > 0 && Math.abs(total - 100) > 1) {
        document.getElementById('bucket-warn').style.display = '';
        return;
      }
      settings[targetKey] = target;
      settings[splitKey]  = { ...tokenMap };
      if (stock) {   // el núcleo de la bolsa y, si con la bolsa los objetivos ya no suman 100, los otros tres se reajustan en proporción
        settings.bolsaCore = nucleo;
        const suma = (settings.coreTarget ?? DEFAULT_CORE_TARGET) + (settings.satTarget ?? DEFAULT_SAT_TARGET) + (settings.defenseTarget || 0) + target;
        if (Math.abs(suma - 100) > 0.05) fitTargetsTo100();
      }
      persist();
      render();
      close();
    });
  }

  function editCoreTarget() {
    openBucketEditModal({ title: 'Núcleo', targetKey: 'coreTarget', splitKey: 'coreSplit', defaultTarget: DEFAULT_CORE_TARGET, color: 'var(--accent-green)' });
  }

  function editSatTarget() {
    openBucketEditModal({ title: 'Satélites', targetKey: 'satTarget', splitKey: 'satSplit', defaultTarget: DEFAULT_SAT_TARGET, color: 'var(--accent-yellow)' });
  }

  // Mes al que se imputa una compra: del día 28 en adelante cuenta ya como gasto
  // del mes siguiente. La fecha guardada del movimiento no cambia.
  const DCA_CUTOFF_DAY = 27;
  function dcaMonthKey(isoDate) {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    const first = new Date(y, m - 1 + (d > DCA_CUTOFF_DAY ? 1 : 0), 1);
    return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
  }

  function renderDcaSummary() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthKey = dcaMonthKey(today);
    const [keyYear, keyMonth] = monthKey.split('-');
    const period = new Date(keyYear, keyMonth - 1);   // mes que se está llenando (no siempre el del calendario)
    const dcaTargetEur = settings.dcaTarget;   // objetivo en €

    const monthBuys = transactions
      .filter(tx => dcaMonthKey(tx.date) === monthKey && tx.type === 'Compra' && tx.totalUsd > 0);
    const investedUsd = monthBuys.reduce((sum, tx) => sum + tx.totalUsd, 0);
    const investedEur = monthBuys.reduce((sum, tx) => sum + tx.totalEur, 0);   // euros exactos tecleados
    const sp = monthlySplit();   // con objetivo de bolsa, el total se desglosa en crypto y bolsa
    const bolsaBoughtEur = monthBuys.filter(tx => COINS[tx.token]?.kind === 'stock').reduce((sum, tx) => sum + tx.totalEur, 0);

    const invested = currency === 'EUR' ? investedEur : investedUsd;
    const target = currency === 'EUR' ? dcaTargetEur : dcaTargetEur / EUR_USD;
    const pct = target > 0 ? Math.min((invested / target) * 100, 100) : 0;
    const remaining = Math.max(target - invested, 0);
    const symFmt = (v, d = 2) => currency === 'EUR' ? fmt(v, d) + ' €' : '$' + fmt(v, d);

    // Cabecera: objetivo siempre en € (es como lo piensa el usuario).
    const headerDca = document.getElementById('header-dca');
    if (headerDca) headerDca.textContent = `${fmt(dcaTargetEur, 0)} €`;

    const el = document.getElementById('dca-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="dca-top">
        <span class="dca-month">${period.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
      </div>
      <div class="dca-amount">
        <span class="dca-invested">${symFmt(invested)}</span>
        <span class="dca-target">de ${symFmt(target)}</span>
      </div>
      <div class="dca-bar">
        <div class="dca-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="dca-footer">
        ${pct >= 100
          ? '<span class="positive">✓ Mes completo</span>'
          : `<span style="color:var(--text-muted)">Faltan ${symFmt(remaining)}</span>`}
      </div>
      ${settings.bolsaTarget > 0 ? `<div class="dca-footer" style="color:var(--text-muted)">Crypto ${symFmt(currency === 'EUR' ? investedEur - bolsaBoughtEur : (investedEur - bolsaBoughtEur) / EUR_USD)} de ${symFmt(currency === 'EUR' ? sp.cryptoUsd * EUR_USD : sp.cryptoUsd)} · <span style="color:var(--accent-teal)">Bolsa ${symFmt(currency === 'EUR' ? bolsaBoughtEur : bolsaBoughtEur / EUR_USD)} de ${symFmt(currency === 'EUR' ? sp.bolsaUsd * EUR_USD : sp.bolsaUsd)}</span></div>` : ''}
    `;
    const amountEl = document.getElementById('dca-amount');
    if (amountEl) amountEl.addEventListener('click', editDcaTarget);
  }

  function renderCosmosBar() {
    const cosmosPct = getCosmosPct() * 100;
    const bar = document.getElementById('cosmos-bar-fill');
    const label = document.getElementById('cosmos-bar-label');
    const banner = document.getElementById('cosmos-warning');
    if (!bar || !label) return;

    const satTarget = settings.satTarget ?? DEFAULT_SAT_TARGET;
    const satRatio = satTarget > 0 ? cosmosPct / satTarget : 1;

    // Igual que Núcleo, Refugio y Bolsa: verde si llega al objetivo o lo supera; amarillo, naranja o rojo según lo lejos que esté.
    const barCol = barColor(satRatio, '#0ecb81');

    bar.style.width = `${Math.min(cosmosPct, 100)}%`;
    bar.style.background = barCol;
    bar.className = 'progress-fill';
    setBarMark('cosmos-bar-wrap', cosmosTopPct() * 100);

    label.textContent = `Objetivo ${satTarget}%`;
    label.className = 'cosmos-label';
    label.style.color = barCol;
    if (banner) banner.style.display = 'none';
  }

  function renderAssetTable() {
    const tbody = document.getElementById('asset-tbody');
    const total = getTotalPortfolioValue();

    const hiddenCount = portfolio.filter(a => a.hidden).length;
    const visible = portfolio.filter(a => showHidden || !a.hidden);

    const badge = document.getElementById('asset-count-badge');
    if (badge) badge.textContent = `${portfolio.length} activo${portfolio.length === 1 ? '' : 's'}`;
    const sorted = [...visible].sort((a, b) => getAssetValue(b) - getAssetValue(a));

    const rowHtml = (asset, i) => {
      const p = prices[asset.token]?.price || asset.avgPrice;
      const change = prices[asset.token]?.change24h || 0;
      const value = getAssetValue(asset);
      const pnl = getAssetPnl(asset);
      const pnlPct = asset.costUsd > 0 ? pnl / asset.costUsd : 0;
      const weight = total > 0 ? value / total : 0;

      return `
        <tr data-token="${asset.token}" class="fade-in-up" style="cursor:pointer;animation-delay:${i * 0.06}s;${asset.hidden ? 'opacity:0.45;' : ''}">
          <td>
            <div class="token-cell">
              ${iconHtml(asset.token, asset.cssClass)}
              <div>
                <div class="token-name">${asset.name}${asset.hidden ? ' <span class="hidden-tag">oculta</span>' : ''}</div>
                <div class="token-symbol">${asset.token}</div>
              </div>
            </div>
          </td>
          <td class="text-right">${fmt(asset.qty, asset.token === 'BTC' ? 8 : 4)}</td>
          <td class="text-right">${fmtCurrency(p)}</td>
          <td class="text-right ${pnlClass(change / 100)}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</td>
          <td>${renderSparkline(asset.token, change >= 0)}</td>
          <td class="text-right">${fmtCurrency(value)}</td>
          <td class="text-right ${pnlClass(pnl)}">${fmtCurrency(pnl)}</td>
          <td class="text-right ${pnlClass(pnlPct)}">${fmtPct(pnlPct)}</td>
          <td class="text-right">${(weight * 100).toFixed(1)}%</td>
        </tr>
      `;
    };
    // Con acciones en la cartera se ven dos carteras independientes (Crypto y Bolsa), cada una con su subtotal; el total sigue sumando las dos.
    const grupoHtml = (nombre, color, lista) => {
      const v = lista.reduce((s, a) => s + getAssetValue(a), 0);
      return `<tr class="asset-group-row"><td colspan="9"><span class="asset-group-name" style="color:${color}">${nombre}</span>
        <span>${lista.length} activo${lista.length === 1 ? '' : 's'} · ${fmtCurrency(v)} · ${total > 0 ? (v / total * 100).toFixed(1) : '0.0'}% de la cartera</span></td></tr>`;
    };
    const cryptoList = sorted.filter(a => a.kind !== 'stock'), bolsaList = sorted.filter(a => a.kind === 'stock');
    tbody.innerHTML = bolsaList.length
      ? [['Crypto', 'var(--accent-green)', cryptoList], ['Bolsa', 'var(--accent-teal)', bolsaList]]
          .filter(g => g[2].length).map(([n, col, l]) => grupoHtml(n, col, l) + l.map(rowHtml).join('')).join('')
      : sorted.map(rowHtml).join('');

    if (hiddenCount > 0) {
      tbody.innerHTML += `
        <tr class="asset-hidden-toggle">
          <td colspan="9" style="text-align:center;padding:12px;">
            <button type="button" id="toggle-hidden-btn" class="link-btn">
              ${showHidden ? 'Ocultar de nuevo' : `Ver ${hiddenCount} moneda${hiddenCount > 1 ? 's' : ''} oculta${hiddenCount > 1 ? 's' : ''}`}
            </button>
          </td>
        </tr>`;
      const tbtn = document.getElementById('toggle-hidden-btn');
      if (tbtn) tbtn.addEventListener('click', () => { showHidden = !showHidden; renderAssetTable(); });
    }

    setTimeout(drawSparklines, 50);
  }

  function renderAllocation() {
    const segments = portfolio.filter(a => !a.hidden).map(a => ({
      token: a.token, value: getAssetValue(a), color: a.color,
    }));

    segments.sort((a, b) => b.value - a.value);

    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const ctx = document.getElementById('allocation-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    if (segments.length === 0) {
      chartInstance = null;
      return;
    }

    // Borde de los segmentos = fondo de la tarjeta; hover = texto principal.
    const csA = getComputedStyle(document.body);
    const segBorder = csA.getPropertyValue('--bg-secondary').trim() || '#1e2329';
    const segHover = csA.getPropertyValue('--text-primary').trim() || '#eaecef';

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: segments.map(s => s.token),
        datasets: [{
          data: segments.map(s => s.value),
          backgroundColor: segments.map(s => s.color),
          borderColor: segBorder,
          borderWidth: 3,
          hoverBorderColor: segHover,
          hoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2b3139',
            titleColor: '#eaecef',
            bodyColor: '#eaecef',
            borderColor: '#363c45',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${fmtCurrency(ctx.raw)} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    document.getElementById('allocation-list').innerHTML = segments.map(s => {
      const pct = total > 0 ? (s.value / total) * 100 : 0;
      return `
        <div class="allocation-item">
          <div class="allocation-item-left">
            <div class="allocation-dot" style="background:${s.color}"></div>
            <span class="token-name">${s.token}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="allocation-pct">${pct.toFixed(1)}%</span>
            <span style="color:var(--text-secondary);font-size:13px;">${fmtCurrency(s.value)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEvolutionChart() {
    const ctx = document.getElementById('evolution-chart');
    if (!ctx) return;

    // Colores del chart según el tema (se leen al recrearlo en cada render).
    const cs = getComputedStyle(document.body);
    const tickColor = cs.getPropertyValue('--text-muted').trim() || '#5e6673';
    const gridColor = cs.getPropertyValue('--chart-grid').trim() || 'rgba(43,49,57,0.5)';
    const legendColor = cs.getPropertyValue('--text-secondary').trim() || '#848e9c';

    // Las dos series van ya en la moneda elegida; el tooltip y el eje solo ponen el símbolo.
    const inEur = currency === 'EUR';
    const money = (v) => inEur ? fmt(v) + ' €' : '$' + fmt(v);
    const monthlyInvest = {};
    transactions.forEach(tx => {
      if (tx.type === 'Compra' && tx.totalUsd > 0) {
        const month = dcaMonthKey(tx.date);
        monthlyInvest[month] = (monthlyInvest[month] || 0) + (inEur ? tx.totalEur : tx.totalUsd);
      }
    });

    const sorted = Object.keys(monthlyInvest).sort();
    let cumulative = 0;
    const labels = [];
    const invested = [];

    sorted.forEach(m => {
      cumulative += monthlyInvest[m];
      const [y, mo] = m.split('-');
      const date = new Date(y, parseInt(mo) - 1);
      labels.push(date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
      invested.push(parseFloat(cumulative.toFixed(2)));
    });

    if (evolutionChart) evolutionChart.destroy();

    const totalNow = getTotalPortfolioValue();   // ya incluye airdrops/staking; no re-sumar
    const currentVal = inEur ? totalNow * EUR_USD : totalNow;

    evolutionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Invertido',
            data: invested,
            borderColor: '#1e90ff',
            backgroundColor: 'rgba(30, 144, 255, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: '#1e90ff',
            borderWidth: 2,
          },
          {
            label: 'Valor actual',
            data: invested.map(() => currentVal),
            borderColor: '#0ecb81',
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 2,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: legendColor, font: { size: 12 } } },
          tooltip: {
            backgroundColor: '#2b3139',
            titleColor: '#eaecef',
            bodyColor: '#eaecef',
            borderColor: '#363c45',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
          y: {
            ticks: { color: tickColor, font: { size: 11 }, callback: (v) => inEur ? v.toLocaleString() + ' €' : '$' + v.toLocaleString() },
            grid: { color: gridColor },
          },

        },
      },
    });
  }

  function renderStaking() {
    const stakingAssets = getStakingAssets();
    if (stakingAssets.length === 0) {
      document.getElementById('staking-grid').innerHTML =
        '<div class="empty-state">Sin monedas en staking. Marca una moneda como Staking desde su ficha.</div>';
      return;
    }
    document.getElementById('staking-grid').innerHTML = stakingAssets.map((s, i) => {
      const p = prices[s.token]?.price || s.avgPrice || 0;
      const yearlyTokens = s.qty * s.apr;      // tokens generados al año (no depende del precio)
      const monthlyTokens = yearlyTokens / 12;
      const yearlyIncome = yearlyTokens * p;
      const monthlyIncome = yearlyIncome / 12;

      return `
        <div class="staking-card fade-in-up" style="animation-delay:${i * 0.08}s">
          <div class="staking-card-header">
            <div class="token-info">
              ${iconHtml(s.token, s.cssClass || '', 32)}
              <span class="token-name">${s.token} Staking</span>
            </div>
            <span class="staking-apr">${fmtApr(s.apr)} APR</span>
          </div>
          <div class="staking-stats">
            <div>
              <div class="staking-stat-label">Stakeado</div>
              <div class="staking-stat-value">${fmt(s.qty, s.qty < 10 ? 2 : 0)} ${s.token}</div>
            </div>
            <div>
              <div class="staking-stat-label">Valor</div>
              <div class="staking-stat-value">${fmtCurrency(s.qty * p)}</div>
            </div>
            <div>
              <div class="staking-stat-label">Ingreso/año</div>
              <div class="staking-stat-value positive">${fmtCurrency(yearlyIncome)}</div>
              <div class="staking-stat-sub">${fmt(yearlyTokens, 2)} ${s.token}</div>
            </div>
            <div>
              <div class="staking-stat-label">Ingreso/mes</div>
              <div class="staking-stat-value positive">${fmtCurrency(monthlyIncome)}</div>
              <div class="staking-stat-sub">${fmt(monthlyTokens, 2)} ${s.token}</div>
            </div>
          </div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">${s.note || ''}</div>
        </div>
      `;
    }).join('');
  }

  function renderAirdrops() {
    const airdropAssets = getAirdropAssets();
    const tbody = document.getElementById('airdrop-tbody');
    if (airdropAssets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Sin airdrops. Marca una moneda como Airdrop desde su ficha.</td></tr>';
      return;
    }
    tbody.innerHTML = airdropAssets.map((a, i) => {
      const price = prices[a.token]?.price || 0;
      const value = getAirdropValue(a);
      return `
        <tr>
          <td>
            <div class="token-cell">
              ${iconHtml(a.token, a.cssClass)}
              <div>
                <div class="token-name">${a.name}</div>
                <div class="token-symbol">${a.token}</div>
              </div>
            </div>
          </td>
          <td class="text-right">${fmt(a.qty, 0)}</td>
          <td class="text-right">${fmtCurrency(price)}</td>
          <td class="text-right">${fmtCurrency(value)}</td>
          <td style="color:var(--text-muted);font-size:12px;">${a.note || ''}</td>
        </tr>
      `;
    }).join('');
  }

  function renderCustody() {
    document.getElementById('custody-bar').innerHTML = custody.map(c =>
      `<div class="custody-segment" style="flex:${c.pct};background:${c.color}">${(c.pct * 100).toFixed(0)}%</div>`
    ).join('');

    document.getElementById('custody-legend').innerHTML = custody.map(c =>
      `<div class="custody-legend-item">
        <div class="custody-legend-dot" style="background:${c.color}"></div>
        <div class="custody-legend-text">
          <span class="custody-legend-name">${c.name}</span>
          <span class="custody-legend-purpose">${c.purpose}</span>
        </div>
      </div>`
    ).join('');
  }

  function renderTransactions() {
    const tbody = document.getElementById('tx-tbody');
    let filtered = [...transactions].reverse();
    if (txFilter) {
      const q = txFilter.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.token.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        tx.date.includes(q)
      );
    }

    tbody.innerHTML = filtered.slice(0, 20).map(tx => {
      const allAssets = portfolio;
      const txAsset = allAssets.find(a => a.token === tx.token);
      return `
      <tr>
        <td style="color:var(--text-secondary);">${tx.date}</td>
        <td>
          <div class="token-cell">
            ${iconHtml(tx.token, txAsset?.cssClass || '', 24)}
            <span class="token-name">${tx.token}</span>
          </div>
        </td>
        <td>
          <span style="color:${tx.type === 'Compra' ? 'var(--accent-green)' : 'var(--accent-blue)'};">${tx.type}</span>
        </td>
        <td class="text-right">${tx.price > 0 ? fmtTxAmount(tx, tx.price) : '—'}</td>
        <td class="text-right">${fmt(tx.qty, tx.token === 'BTC' ? 8 : 2)}</td>
        <td class="text-right">${tx.totalUsd > 0 ? fmtTxAmount(tx, tx.totalUsd) : '—'}</td>
        <td class="text-right tx-actions">
          <button type="button" class="tx-btn tx-edit" data-txid="${tx.id}" title="Editar" aria-label="Editar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" class="tx-btn tx-del" data-txid="${tx.id}" title="Borrar" aria-label="Borrar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </td>
      </tr>
      `;
    }).join('');
  }

  function updateLastUpdate() {
    const now = new Date();
    document.getElementById('last-update').textContent =
      `Actualizado: ${now.toLocaleTimeString('es-ES')} ${now.toLocaleDateString('es-ES')}`;
  }

  // Marca visualmente la frescura de los precios:
//   'ok'    → punto verde: toda la cartera con precio vivo en el último tick.
//   'stale' → punto ámbar: parte de los precios viene del snapshot guardado
//             (hasta 20 min tras el último tick bueno).
// Formatos de antigüedad legibles: <60 min → "X min", <24 h → "X h", luego días.
  const humanAge = (mins) => {
    if (mins == null) return '?';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h} h ${mins % 60} min`;
    const d = Math.floor(h / 24);
    return `${d} día${d > 1 ? 's' : ''} ${h % 24} h`;
  };

  // Marca visualmente la frescura de los precios:
//   'ok'    → punto verde: toda la cartera con precio vivo en el último tick.
//   'stale' → punto ámbar: parte de los precios viene del snapshot guardado
//             (hasta 20 min tras el último tick bueno).
//   'error' → punto rojo: sin conexión y sin snapshot que mostrar.
  function setLiveState(mode, mins) {
    const dot = document.querySelector('.live-dot');
    if (dot) {
      dot.classList.toggle('offline', mode === 'error');
      dot.classList.toggle('stale', mode === 'stale');
      dot.title = mode === 'ok'
        ? 'Precios en vivo'
        : mode === 'stale'
          ? `Precios del último snapshot · hace ${humanAge(mins)}`
          : 'Sin conexión y sin precio guardado';
    }
    const el = document.getElementById('last-update');
    if (!el) return;
    if (mode === 'stale') {
      el.textContent = mins != null
        ? `Precios guardados desde hace ${humanAge(mins)} (API caída)`
        : 'Precios guardados (API caída)';
    } else if (mode === 'error') {
      el.textContent = 'Sin conexión · sin precio guardado';
    }
  }

  // ── TOGGLE MONEDA ──
  // Un único botón: muestra la moneda activa y al pulsarlo alterna a la otra.
  function setCurrency(c) {
    currency = c;
    const glyph = document.getElementById('currency-glyph');
    const code = document.getElementById('currency-code');
    if (glyph) glyph.textContent = c === 'USD' ? '$' : '€';
    if (code) code.textContent = c;
    render();
  }

  // ── TABLA ORDENABLE ──
  function setupSortable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('thead th[data-sort]').forEach((th, idx) => {
      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
        th.dataset.dir = dir;

        const cmp = (a, b) => {
          let va = a.cells[idx]?.textContent.trim() || '';
          let vb = b.cells[idx]?.textContent.trim() || '';
          const na = parseFloat(va.replace(/[$€,%+\s]/g, ''));
          const nb = parseFloat(vb.replace(/[$€,%+\s]/g, ''));
          if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
          return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        };

        if (tbody.querySelector('.asset-group-row')) {   // tabla con carteras separadas: cada una se ordena por su cuenta
          const grupos = [], toggle = rows.filter(r => r.classList.contains('asset-hidden-toggle'));
          rows.forEach(r => { if (r.classList.contains('asset-group-row')) grupos.push({ head: r, rows: [] }); else if (grupos.length && !toggle.includes(r)) grupos[grupos.length - 1].rows.push(r); });
          grupos.forEach(g => { g.rows.sort(cmp); tbody.appendChild(g.head); g.rows.forEach(r => tbody.appendChild(r)); });
          toggle.forEach(r => tbody.appendChild(r));
        } else {
          rows.sort(cmp);
          rows.forEach(r => tbody.appendChild(r));
        }
      });
    });
  }

  // ── TOKEN DETAIL MODAL ──
  function openTokenModal(token) {
    const asset = portfolio.find(a => a.token === token);
    if (!asset) return;

    const p = prices[asset.token]?.price || asset.avgPrice;
    const change = prices[asset.token]?.change24h || 0;
    const value = getAssetValue(asset);
    const pnl = getAssetPnl(asset);
    const pnlPct = asset.costUsd > 0 ? pnl / asset.costUsd : 0;
    const total = getTotalPortfolioValue();
    const weight = total > 0 ? value / total : 0;

    const txs = transactions
      .filter(tx => tx.token === token)
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalInvested = txs.reduce((s, tx) => s + (tx.totalUsd || 0), 0);
    const avgBuy = txs.length > 0
      ? txs.reduce((s, tx) => s + (tx.price * tx.qty), 0) / asset.qty
      : asset.avgPrice;

    const yearlyIncome = asset.tag === 'staking' ? asset.qty * p * (asset.apr || 0) : 0;

    const buyVsNow = p > 0 ? ((p - avgBuy) / avgBuy) * 100 : 0;

    document.getElementById('modal-header').innerHTML = `
      <div class="modal-hero" style="border-left:4px solid ${asset.color}">
        <div class="modal-hero-top">
          <div class="modal-token-cell">
            ${iconHtml(asset.token, asset.cssClass, 56)}
            <div>
              <div class="modal-token-name">${asset.name}</div>
              <div class="modal-token-symbol">${asset.token}</div>
            </div>
          </div>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-hero-price">
          <span class="modal-price">${fmtCurrency(p)}</span>
          <span class="modal-change-badge ${change >= 0 ? 'positive' : 'negative'}">
            ${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%
          </span>
        </div>
        <div class="modal-chart-area" id="modal-chart-area"></div>
      </div>
    `;

    document.getElementById('modal-body').innerHTML = `
      <div class="modal-section">
        <div class="modal-section-label">Resumen</div>
        <div class="modal-grid-3">
          <div class="modal-stat-card">
            <div class="modal-stat-label">Cantidad</div>
            <div class="modal-stat-big">${fmt(asset.qty, asset.token === 'BTC' ? 8 : 4)}</div>
            <div class="modal-stat-sub">${asset.token}</div>
          </div>
          <div class="modal-stat-card">
            <div class="modal-stat-label">Valor actual</div>
            <div class="modal-stat-big">${fmtCurrency(value)}</div>
            <div class="modal-stat-sub">${(weight * 100).toFixed(1)}% del portfolio</div>
          </div>
          <div class="modal-stat-card">
            <div class="modal-stat-label">P&L</div>
            <div class="modal-stat-big ${pnlClass(pnl)}">${fmtCurrency(pnl)}</div>
            <div class="modal-stat-sub ${pnlClass(pnlPct)}">${fmtPct(pnlPct)}</div>
          </div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-label">Categoría</div>
        <div class="modal-tag-selector">
          <button class="tag-btn ${asset.tag === 'portfolio' ? 'active tag-portfolio' : ''}" data-tag="portfolio">Cartera</button>
          <button class="tag-btn ${asset.tag === 'staking' ? 'active tag-staking' : ''}" data-tag="staking">Staking</button>
          <button class="tag-btn ${asset.tag === 'airdrop' ? 'active tag-airdrop' : ''}" data-tag="airdrop">Airdrop</button>
        </div>
        <div class="modal-tag-hint" id="tag-hint">${asset.tag === 'staking' ? `APR ${fmtApr(asset.apr)} · se desvía al chart de staking` : asset.tag === 'airdrop' ? 'Se desvía al chart de airdrops' : 'Cuenta dentro del portfolio general'}</div>
        <button type="button" id="hide-btn" class="hide-btn">${asset.hidden ? 'Mostrar en la cartera' : 'Ocultar de la cartera'}</button>
        <div class="modal-tag-hint">Ocultar solo esconde la moneda de la lista y del gráfico. No cambia el valor total de la cartera.</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-label">Coste</div>
        <div class="modal-grid-2">
          <div class="modal-stat-card">
            <div class="modal-stat-label">Invertido total</div>
            <div class="modal-stat-big">${fmtCurrency(totalInvested || asset.costUsd)}</div>
          </div>
          <div class="modal-stat-card">
            <div class="modal-stat-label">Precio medio</div>
            <div class="modal-stat-big">${fmtCurrency(avgBuy)}</div>
          </div>
        </div>
        <div class="modal-buy-bar">
          <div class="modal-buy-bar-label">
            <span>Tu precio medio</span>
            <span>Precio actual</span>
          </div>
          <div class="modal-buy-bar-track">
            <div class="modal-buy-bar-marker" style="left:50%"></div>
            <div class="modal-buy-bar-fill ${buyVsNow >= 0 ? 'positive' : 'negative'}" style="width:${Math.min(Math.abs(buyVsNow), 100)}%;${buyVsNow >= 0 ? 'left:50%' : `left:${50 - Math.min(Math.abs(buyVsNow), 50)}%`}"></div>
          </div>
          <div class="modal-buy-bar-result ${pnlClass(buyVsNow)}">
            ${buyVsNow >= 0 ? '+' : ''}${buyVsNow.toFixed(1)}% vs tu entrada
          </div>
        </div>
      </div>

      ${asset.tag === 'staking' ? `
        <div class="modal-section">
          <div class="modal-section-label">Staking</div>
          <div class="modal-grid-3">
            <div class="modal-stat-card">
              <div class="modal-stat-label">Stakeado</div>
              <div class="modal-stat-big">${fmt(asset.qty, 0)} ${token}</div>
            </div>
            <div class="modal-stat-card">
              <div class="modal-stat-label">APR</div>
              <div class="modal-stat-big positive">${fmtApr(asset.apr)}</div>
            </div>
            <div class="modal-stat-card">
              <div class="modal-stat-label">Ingreso / año</div>
              <div class="modal-stat-big positive">${fmtCurrency(yearlyIncome)}</div>
              <div class="modal-stat-sub">${fmtCurrency(yearlyIncome / 12)}/mes</div>
            </div>
          </div>
          ${asset.note ? `<div class="modal-staking-note">${asset.note}</div>` : ''}
        </div>
      ` : ''}

      <div class="modal-section">
        <div class="modal-section-label">Historial (${txs.length} compras)</div>
        <div class="modal-tx-list">
          ${txs.length === 0 ? '<div class="modal-empty">Sin transacciones registradas</div>' :
            txs.map(tx => `
              <div class="modal-tx-row">
                <div class="modal-tx-left">
                  <div class="modal-tx-date">${tx.date}</div>
                  <div class="modal-tx-qty">${fmt(tx.qty, tx.token === 'BTC' ? 8 : 4)} ${tx.token}</div>
                </div>
                <div class="modal-tx-right">
                  <div class="modal-tx-price">${tx.price > 0 ? fmtTxAmount(tx, tx.price) : '—'}</div>
                  <div class="modal-tx-total">${tx.totalUsd > 0 ? fmtTxAmount(tx, tx.totalUsd) : '—'}</div>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    const modal = document.getElementById('token-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTag = btn.dataset.tag;
        if (newTag === asset.tag) return;
        let apr = asset.apr || 0;
        if (newTag === 'staking') {
          const input = prompt(`Introduce el APR de ${token} (en %, solo número, p.ej. 12.5):`, ((asset.apr || 0) * 100));
          if (input === null) return;
          const parsed = parseFloat(String(input).replace(',', '.'));
          apr = (isNaN(parsed) || parsed < 0) ? 0 : parsed / 100;
        }
        asset.tag = newTag;
        asset.apr = apr;
        persist();
        closeModal();
        render();
      });
    });

    const hideBtn = document.getElementById('hide-btn');
    if (hideBtn) hideBtn.addEventListener('click', () => {
      asset.hidden = !asset.hidden;
      persist();
      closeModal();
      render();
    });

    drawModalSparkline(token, asset.color);
  }

  function drawModalSparkline(token, color) {
    const data = sparklineData[token];
    const container = document.getElementById('modal-chart-area');
    if (!data || data.length === 0 || !container) return;

    container.innerHTML = '<canvas id="modal-spark-canvas"></canvas>';
    const canvas = document.getElementById('modal-spark-canvas');
    const ctx = canvas.getContext('2d');
    const w = container.offsetWidth || 440;
    const h = 80;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(2, 2);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((val - min) / range) * (h - 12) - 6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + '25');
    gradient.addColorStop(1, color + '00');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function closeModal() {
    document.getElementById('token-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function openBucketModal(bucket) {
    const total = getInvestedValue();
    const buckets = {
      core: {
        label: 'Nucleo',
        color: 'var(--accent-green)',
        tokens: ['BTC', 'ETH'],
        target: null,
      },
      satelites: {
        label: 'Satelites',
        color: 'var(--accent-yellow)',
        tokens: getSatTokens(),
        target: settings.satTarget ?? DEFAULT_SAT_TARGET,   // el mismo objetivo que la tarjeta Satélites (antes: un 35 escrito a mano)
      },
      refugio: {
        label: 'Refugio',
        color: 'var(--accent-blue)',
        tokens: ['USDC'],
        target: settings.defenseTarget || null,
      },
      bolsa: {
        label: 'Bolsa',
        color: 'var(--accent-teal)',
        tokens: portfolio.filter(a => a.kind === 'stock').map(a => a.token),
        target: settings.bolsaTarget || null,
      },
    };
    const b = buckets[bucket];
    if (!b) return;

    const rows = b.tokens.map(tok => {
      const asset = portfolio.find(a => a.token === tok);
      const c = COINS[tok] || {};
      const val = getAssetValue(asset);
      const cost = asset?.costUsd || 0;
      const pnl = val - cost;
      const pnlPct = cost > 0 ? pnl / cost : 0;
      const weight = total > 0 ? val / total : 0;
      const bucketTotal = b.tokens.reduce((s, t) => s + getAssetValue(portfolio.find(a => a.token === t)), 0);
      const bucketWeight = bucketTotal > 0 ? val / bucketTotal : 0;

      // Objetivo individual = objetivo del cubo × split interno del token
      let targetPct = null;
      if (bucket === 'core' && settings.coreSplit?.[tok] != null) {
        targetPct = (settings.coreTarget ?? DEFAULT_CORE_TARGET) * (settings.coreSplit[tok]);
      } else if (bucket === 'satelites' && settings.satSplit?.[tok] != null) {
        targetPct = (settings.satTarget ?? DEFAULT_SAT_TARGET) * (settings.satSplit[tok]);
      } else if (bucket === 'refugio' && settings.defenseTarget) {
        targetPct = settings.defenseTarget;
      }
      const actualPct = weight * 100;
      const diffPct = targetPct != null ? actualPct - targetPct : null;
      const chipHtml = chipObjetivoHtml(actualPct, targetPct);

      const accentColor = c.color || 'var(--accent-blue)';
      return `
        <div class="bucket-row" style="border-right:3px solid ${accentColor};">

          <div class="bucket-row-left">
            ${iconHtml(tok, c.cssClass || tok.toLowerCase(), 36)}
            <div class="bucket-row-info">
              <div class="bucket-row-name">${c.name || tok} <span class="bucket-row-sym">${tok}</span></div>
              <div class="bucket-row-sub" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;">
                ${chipPesoHtml(actualPct)}
                ${chipHtml}
              </div>
            </div>
          </div>
          <div class="bucket-row-right">
            <div class="bucket-row-val">${fmtCurrency(val)}</div>
            <div class="bucket-row-pnl ${pnlClass(pnl)}">${pnl >= 0 ? 'Ganancias' : 'Perdidas'} ${fmtPct(Math.abs(pnlPct))} · ${fmtCurrency(Math.abs(pnl))}</div>
            <div class="bucket-row-bar">
              <div class="bucket-bar-fill" style="width:${(bucketWeight * 100).toFixed(1)}%;background:${c.color || 'var(--accent-blue)'}; opacity:0.0"></div>
            </div>
          </div>
        </div>`;
    }).join('');

    const bucketTotal = b.tokens.reduce((s, tok) => s + getAssetValue(portfolio.find(a => a.token === tok)), 0);
    const bucketCost  = b.tokens.reduce((s, tok) => s + (portfolio.find(a => a.token === tok)?.costUsd || 0), 0);
    const bucketPnl   = bucketTotal - bucketCost;
    const bucketPnlPct = bucketCost > 0 ? bucketPnl / bucketCost : 0;
    const bucketPct = total > 0 ? bucketTotal / total : 0;

    document.getElementById('modal-header').innerHTML = `
      <div class="modal-hero" style="border-left:4px solid ${b.color}">
        <div class="modal-hero-top">
          <div class="modal-token-cell">
            <div>
              <div class="modal-token-name">${b.label}</div>
              <div class="modal-token-symbol">${fmtCurrency(bucketTotal)} · ${(bucketPct * 100).toFixed(1)}% de la cartera${b.target ? ` · objetivo ${b.target}%` : ''}</div>
            </div>
          </div>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-hero-price">
          <span class="modal-price ${pnlClass(bucketPnl)}">${fmtCurrency(bucketPnl)}</span>
          <span class="modal-change-badge ${pnlClass(bucketPnl)}">${bucketPnl >= 0 ? 'Ganancias' : 'Perdidas'} ${fmtPct(Math.abs(bucketPnlPct))}</span>
        </div>
      </div>`;

    document.getElementById('modal-body').innerHTML = `<div class="bucket-list">${rows}</div>`;

    const modal = document.getElementById('token-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  }

  // ── AÑADIR MOVIMIENTO (Compra / Venta) ──
  let addState = { token: 'BTC', type: 'Compra' };
  let editingId = null;

  function renderAddChips() {
    document.getElementById('add-coin-chips').innerHTML = Object.keys(COINS).map(t => `
      <button type="button" class="coin-chip${t === addState.token ? ' active' : ''}" data-token="${t}">
        ${iconHtml(t, COINS[t].cssClass, 20)}<span>${t}</span>
      </button>`).join('');
  }

  // Selecciona una moneda en el modal y recalcula lo que dependa de ella (lo hace el clic en un chip y la búsqueda).
  function selectToken(token) {
    addState.token = token;
    renderAddChips();
    renderAddPrice();
    if (parseNum(document.getElementById('add-amount').value) > 0) onAmountInput();
    else if (parseNum(document.getElementById('add-qty').value) > 0) onQtyInput();
  }

  // Buscar monedas que no están en el catálogo (CoinGecko). Solo propone: no se guarda nada hasta que eliges una.
  async function searchCoins(q) {
    const key = COINGECKO_API_KEY ? `&${COINGECKO_API_PARAM}=${COINGECKO_API_KEY}` : '';
    const res = await fetchCoinGecko([`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}${key}`]);
    return (await res.json()).coins.slice(0, 8);
  }

  // ETF habituales, para encontrarlos por nombre ("sp500", "global vanguard"...): la búsqueda de Twelve Data es literal y solo entiende símbolos y
  // nombres exactos, y deja fuera todo lo que no cotiza en EE. UU. Primero los UCITS europeos (los que se compran desde España, p. ej. en Revolut);
  // después los americanos. [símbolo, nombre, palabras clave, mercado (opcional)]
  const UCITS = 'Europa (UCITS)';
  const ETF_POPULARES = [
    ['VUAA', 'Vanguard S&P 500 UCITS ETF (Acc)', 'sp500 s&p vanguard ucits acc', UCITS], ['VUSA', 'Vanguard S&P 500 UCITS ETF (Dist)', 'sp500 s&p vanguard ucits dist', UCITS],
    ['CSPX', 'iShares Core S&P 500 UCITS ETF (Acc)', 'sp500 s&p ishares ucits acc', UCITS], ['SXR8', 'iShares Core S&P 500 UCITS ETF (Acc, Xetra)', 'sp500 s&p ishares ucits acc xetra', UCITS],
    ['SPYL', 'SPDR S&P 500 UCITS ETF', 'sp500 s&p spdr ucits', UCITS],
    ['VWCE', 'Vanguard FTSE All-World UCITS ETF (Acc)', 'vanguard global world mundo allworld ucits acc', UCITS], ['VWRL', 'Vanguard FTSE All-World UCITS ETF (Dist)', 'vanguard global world mundo allworld ucits dist', UCITS],
    ['IWDA', 'iShares Core MSCI World UCITS ETF (Acc)', 'global world mundo msci ishares ucits acc', UCITS], ['EUNL', 'iShares Core MSCI World UCITS ETF (Acc, Xetra)', 'global world mundo msci ishares ucits acc xetra', UCITS],
    ['SWDA', 'iShares Core MSCI World UCITS ETF (Acc, Londres)', 'global world mundo msci ishares ucits acc londres', UCITS],
    ['EQQQ', 'Invesco EQQQ NASDAQ-100 UCITS ETF', 'nasdaq 100 invesco ucits tecnologia', UCITS], ['CNDX', 'iShares NASDAQ 100 UCITS ETF (Acc)', 'nasdaq 100 ishares ucits acc tecnologia', UCITS],
    ['EMIM', 'iShares Core MSCI EM IMI UCITS ETF (Acc)', 'emergentes emerging msci ishares ucits acc', UCITS],
    ['VOO', 'Vanguard S&P 500 ETF', 'sp500 s&p vanguard'], ['SPY', 'SPDR S&P 500 ETF Trust', 'sp500 s&p spdr'], ['IVV', 'iShares Core S&P 500 ETF', 'sp500 s&p ishares'],
    ['VTI', 'Vanguard Total Stock Market ETF', 'vanguard total usa bolsa'], ['VT', 'Vanguard Total World Stock ETF', 'vanguard global world mundo total'],
    ['VXUS', 'Vanguard Total International Stock ETF', 'vanguard global internacional mundo'], ['QQQ', 'Invesco QQQ Trust', 'nasdaq 100 tecnologia'],
    ['VUG', 'Vanguard Growth ETF', 'vanguard growth crecimiento'], ['SCHD', 'Schwab U.S. Dividend Equity ETF', 'dividendos dividend schwab'], ['VYM', 'Vanguard High Dividend Yield ETF', 'vanguard dividendos dividend'],
  ];

  // Buscar acciones/ETF (Twelve Data: la búsqueda no pide clave). Solo cotizaciones de EE. UU., una por símbolo.
  async function searchStocks(q) {
    const norm = (s) => String(s).toLowerCase().replace(/[\s&.\-]/g, '');
    const palabras = String(q).toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    const vistos = new Set();
    // 1) los ETF habituales que encajan por nombre o palabras clave (todas las palabras tienen que aparecer)
    const locales = palabras.length ? ETF_POPULARES.filter(([sym, nom, claves]) => { const t = norm(`${sym} ${nom} ${claves}`); return palabras.every(p => t.includes(p)); })
      .map(([symbol, name, , exchange]) => ({ kind: 'stock', symbol, name, exchange: exchange || 'EE. UU.' })) : [];
    locales.forEach(x => vistos.add(x.symbol));
    // 2) la búsqueda de Twelve Data (más resultados que antes, antes de quedarnos solo con EE. UU.)
    let remotos = [];
    try {
      const res = await fetch(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=30`);
      remotos = ((await res.json()).data || [])
        .filter(x => x.country === 'United States' && /^[A-Z][A-Z0-9.]{0,9}$/.test(x.symbol) && !vistos.has(x.symbol) && vistos.add(x.symbol))   // sin códigos que empiezan por número (ids de fondos, no tickers)
        .map(x => ({ kind: 'stock', symbol: x.symbol, name: x.instrument_name, exchange: x.exchange }));
    } catch (e) { /* sin red: quedan los ETF habituales */ }
    return [...locales, ...remotos].slice(0, 12);
  }

  function renderCoinResults(list) {
    const box = document.getElementById('add-coin-results');
    box.replaceChildren(...(list || []).map(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'coin-chip';
      const sym = document.createElement('span'); sym.textContent = c.symbol.toUpperCase();
      if (c.kind === 'stock') {   // acción/ETF: sin imagen y con el borde turquesa de la Bolsa
        b.title = `${c.name} · ${c.exchange} (bolsa)`; b.style.borderColor = 'var(--accent-teal)';
        b.append(sym);
        b.addEventListener('click', () => chooseStock(c));
      } else {
        b.title = c.name;
        const img = new Image(20, 20); img.src = c.thumb; img.alt = '';
        b.append(img, sym);
        b.addEventListener('click', () => chooseCoin(c));
      }
      return b;
    }));
    if (list && !list.length) box.textContent = 'Sin resultados';
  }

  async function chooseCoin(c) {
    const token = c.symbol.toUpperCase(), err = document.getElementById('add-error');
    if (COINS[token] && COINS[token].coingeckoId !== c.id) { err.textContent = `Ya tienes otra moneda con el símbolo ${token}.`; return; }
    if (!COINS[token]) {
      const previo = settings.customCoins;
      settings.customCoins = Object.assign({}, previo, { [token]: { name: c.name, coingeckoId: c.id, icon: c.large || c.thumb } });
      registerCustomCoins();
      if (!COINS[token]) { settings.customCoins = previo; err.textContent = 'No se pudo añadir esa moneda.'; return; }   // rechazada: no se guarda
      persist();
    }
    err.textContent = '';
    document.getElementById('add-coin-search').value = '';
    renderCoinResults(null);
    selectToken(token);
    try {   // aún no está en cartera: su precio en vivo hay que pedirlo aparte
      const d = await (await fetchCoinGecko(coingeckoUrls('price', c.id))).json();
      applyPrice(token, d[c.id]?.usd, d[c.id]?.usd_24h_change);
      renderAddPrice();
    } catch (e) { /* sin precio en vivo: se escribe el importe a mano */ }
  }

  function chooseStock(c) {
    const token = c.symbol, err = document.getElementById('add-error');
    if (COINS[token] && COINS[token].kind !== 'stock') { err.textContent = `El símbolo ${token} ya es una moneda crypto de tu catálogo.`; return; }
    if (!COINS[token]) {
      const previo = settings.customStocks;
      settings.customStocks = Object.assign({}, previo, { [token]: { name: c.name } });
      registerCustomStocks();
      if (!COINS[token]) { settings.customStocks = previo; err.textContent = 'No se pudo añadir esa acción.'; return; }   // rechazada: no se guarda
      persist();
    }
    err.textContent = '';
    document.getElementById('add-coin-search').value = '';
    renderCoinResults(null);
    selectToken(token);
  }

  // Parseo robusto: acepta coma decimal (0,044) y punto (0.044).
  const parseNum = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
  const fmtInput = (n, dec) => n.toLocaleString('es-ES', { maximumFractionDigits: dec, useGrouping: false });

  // Precio en vivo de la moneda seleccionada, en €.
  function addPriceEur() {
    const t = addState.token;
    const usd = prices[t]?.price || portfolio.find(a => a.token === t)?.avgPrice || (t === 'USDC' ? 1 : 0);
    return usd * EUR_USD;
  }

  function renderAddPrice() {
    const pe = addPriceEur();
    document.getElementById('add-price-live').textContent = pe > 0
      ? `Precio ${addState.token} en vivo: ${pe.toLocaleString('es-ES', { maximumFractionDigits: pe < 1 ? 6 : 2 })} €/ud`
      : `Sin precio de ${addState.token} en vivo. Pon importe y cantidad, o solo el importe (se guarda como 1 unidad al precio que pagaste)`;
  }

  function updateEffective() {
    const amount = parseNum(document.getElementById('add-amount').value);
    const qty = parseNum(document.getElementById('add-qty').value);
    document.getElementById('add-derived').textContent = (amount > 0 && qty > 0)
      ? `≈ ${(amount / qty).toLocaleString('es-ES', { maximumFractionDigits: 6 })} €/ud`
      : '';
  }

  // Recompensa (staking/airdrop) = monedas gratis: solo cantidad, coste 0€.
  // Oculta el importe y avisa. Compra/Venta muestran el importe normal.
  function updateTypeUI() {
    const isReward = addState.type === 'Recompensa';
    const amountField = document.getElementById('add-amount-field');
    if (amountField) amountField.style.display = isReward ? 'none' : '';
    const priceLive = document.getElementById('add-price-live');
    if (isReward && priceLive) priceLive.textContent = 'Recompensa: monedas gratis a 0€ (solo suma cantidad, no cuenta como invertido).';
    else renderAddPrice();
    // Cerrado: el nombre seleccionado conserva su color (solo el texto, borde neutro).
    const sel = document.getElementById('add-type');
    if (sel) {
      sel.classList.remove('sel-compra', 'sel-venta', 'sel-recompensa');
      sel.classList.add(addState.type === 'Venta' ? 'sel-venta' : addState.type === 'Recompensa' ? 'sel-recompensa' : 'sel-compra');
    }
  }

  // Metes € → calcula la cantidad. Metes cantidad → calcula los €. (Precio en vivo.)
  function onAmountInput() {
    const pe = addPriceEur();
    const amount = parseNum(document.getElementById('add-amount').value);
    if (pe > 0 && amount > 0) document.getElementById('add-qty').value = fmtInput(amount / pe, 8);
    updateEffective();
  }
  function onQtyInput() {
    const pe = addPriceEur();
    const qty = parseNum(document.getElementById('add-qty').value);
    if (pe > 0 && qty > 0) document.getElementById('add-amount').value = fmtInput(qty * pe, 2);
    updateEffective();
  }

  // Aplica el efecto de un movimiento sobre las tenencias.
  function applyMovement(tx) {
    const h = portfolio.find(a => a.token === tx.token);
    if (tx.type === 'Venta') {
      if (!h) return;
      h.qty -= tx.qty;
      if (h.qty <= 1e-9) portfolio = portfolio.filter(a => a.token !== tx.token);
      else h.costUsd = h.avgPrice * h.qty;
      return;
    }
    // Compra, Airdrop o cualquier ENTRADA de monedas: suma a la tenencia.
    // Un airdrop trae coste 0 (moneda gratis) pero es una tenencia real.
    if (h) {
      h.qty += tx.qty;
      h.costUsd += tx.totalUsd;
      h.avgPrice = h.qty > 0 ? h.costUsd / h.qty : 0;
    } else {
      const m = COINS[tx.token] || {};
      portfolio.push({
        token: tx.token, name: m.name || tx.token, qty: tx.qty,
        costUsd: tx.totalUsd, avgPrice: tx.price || 0,
        coingeckoId: m.coingeckoId, icon: m.icon, color: m.color, cssClass: m.cssClass, kind: m.kind,
        tag: 'portfolio',
      });
    }
  }

  // Deshace el efecto (para borrar o editar un movimiento).
  function reverseMovement(tx) {
    const h = portfolio.find(a => a.token === tx.token);
    if (tx.type === 'Venta') { // revertir una Venta = devolver las monedas
      if (h) { h.qty += tx.qty; h.costUsd = h.avgPrice * h.qty; }
      else {
        const m = COINS[tx.token] || {};
        portfolio.push({ token: tx.token, name: m.name || tx.token, qty: tx.qty, costUsd: tx.price * tx.qty, avgPrice: tx.price, coingeckoId: m.coingeckoId, icon: m.icon, color: m.color, cssClass: m.cssClass, kind: m.kind });
      }
    } else { // revertir Compra/Airdrop = quitar las monedas
      if (!h) return;
      h.qty -= tx.qty; h.costUsd -= tx.totalUsd;
      if (h.qty <= 1e-9) portfolio = portfolio.filter(a => a.token !== tx.token);
      else h.avgPrice = h.qty > 0 ? h.costUsd / h.qty : 0;
    }
  }

  function openAddModal(tx) {
    editingId = tx ? tx.id : null;
    addState = { token: tx ? tx.token : 'BTC', type: tx ? tx.type : 'Compra' };
    document.getElementById('add-title').textContent = tx ? 'Editar movimiento' : 'Añadir movimiento';
    document.getElementById('add-date').value = tx ? tx.date : new Date().toISOString().slice(0, 10);
    document.getElementById('add-qty').value = tx ? fmtInput(tx.qty, 8) : '';
    document.getElementById('add-amount').value = tx ? fmtInput(tx.totalEur, 2) : '';
    document.getElementById('add-error').textContent = '';
    document.getElementById('add-derived').textContent = '';
    document.getElementById('add-coin-search').value = '';
    renderCoinResults(null);
    renderAddChips();
    renderAddPrice();
    updateEffective();
    document.getElementById('add-type').value = addState.type;
    updateTypeUI();
    document.getElementById('add-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAddModal() {
    editingId = null;
    document.getElementById('add-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function submitAdd(e) {
    e.preventDefault();
    const errEl = document.getElementById('add-error');
    errEl.textContent = '';

    const token = addState.token;
    const type = addState.type;
    const date = document.getElementById('add-date').value;
    let qty = parseNum(document.getElementById('add-qty').value);
    const amountEur = parseNum(document.getElementById('add-amount').value);
    const isReward = type === 'Recompensa';
    // Compra sin precio conocido (p. ej. una acción sin cotización en vivo) y solo importe: no se puede calcular la cantidad, así que se guarda
    // como 1 unidad al precio pagado. Así se abre una posición de 1 € sin tener que inventar cuántas unidades son.
    if (!(qty > 0) && type === 'Compra' && amountEur > 0 && !(addPriceEur() > 0)) qty = 1;

    if (!date || !(qty > 0)) {
      errEl.textContent = 'Rellena fecha y cantidad (mayores que 0).';
      return;
    }
    if (!isReward && !(amountEur > 0)) {
      errEl.textContent = 'Rellena el importe (mayor que 0).';
      return;
    }

    // Recompensa = monedas gratis: coste 0€, sin precio de compra.
    // Al editar sin tocar el importe se conservan los $ con los que entró: si no,
    // corregir una cantidad o una fecha cambiaría el coste al cambio de hoy.
    const prevTx = editingId ? transactions.find(t => t.id === editingId) : null;
    const sameAmount = prevTx && prevTx.totalUsd > 0 && Math.abs(prevTx.totalEur - amountEur) < 0.005;
    const totalEur = isReward ? 0 : (sameAmount ? prevTx.totalEur : amountEur);
    const totalUsd = isReward ? 0 : (sameAmount ? prevTx.totalUsd : amountEur / EUR_USD);   // € → $ (la cartera calcula en USD)
    const priceUsd = isReward ? 0 : totalUsd / qty;

    // Si editamos, revertimos primero el movimiento viejo.
    let oldIdx = -1, oldTx = null;
    if (editingId) {
      oldIdx = transactions.findIndex(t => t.id === editingId);
      if (oldIdx >= 0) { oldTx = transactions[oldIdx]; if (oldTx.applied) reverseMovement(oldTx); }
    }

    if (type === 'Venta') {
      const h = portfolio.find(a => a.token === token);
      if (!h || qty > h.qty + 1e-9) {
        if (oldTx && oldTx.applied) applyMovement(oldTx); // deshacer la reversión
        errEl.textContent = h
          ? `No puedes vender ${fmt(qty, 6)} ${token}: solo tienes ${fmt(h.qty, 6)}.`
          : `No tienes ${token} para vender.`;
        return;
      }
    }

    const newTx = { id: editingId || uid(), date, token, type, price: priceUsd, qty, totalUsd, totalEur, applied: true };
    applyMovement(newTx);
    if (oldIdx >= 0) transactions[oldIdx] = newTx;
    else transactions.push(newTx);

    editingId = null;
    persist();
    closeAddModal();
    render();
  }

  function deleteTx(id) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx < 0) return;
    const tx = transactions[idx];
    if (tx.applied) reverseMovement(tx);   // solo revierte tenencias lo que se metió por el formulario
    transactions.splice(idx, 1);
    persist();
    render();
  }

  // ── EXPORT / IMPORT CSV (movimientos) ──
  const csvEscape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function exportCsv() {
    const header = ['date', 'token', 'type', 'price', 'qty', 'totalUsd', 'totalEur'];
    const rows = transactions.map(t => [t.date, t.token, t.type, t.price, t.qty, t.totalUsd, t.totalEur].map(csvEscape));
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mi-cartera-movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Mini-modal para elegir formato (JSON completo vs CSV de movimientos).
  // Devuelve 'json' | 'csv' | null (si cancela).
  function pickFormat(title, subtitle) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'modal-overlay open';
      ov.innerHTML = `
        <div class="modal" style="max-width:440px;">
          <div class="add-modal-head">
            <h3>${title}</h3>
            <button type="button" class="modal-close" aria-label="Cerrar">&times;</button>
          </div>
          <p style="color:var(--text-secondary);font-size:13px;margin:0 0 16px;">${subtitle}</p>
          <div class="format-choice">
            <button type="button" data-fmt="json" class="format-btn">
              <span class="format-btn-title">JSON · todo</span>
              <span class="format-btn-sub">Monedas, tags, ocultos, APR y movimientos. Para llevar tu cartera a otro dispositivo.</span>
            </button>
            <button type="button" data-fmt="csv" class="format-btn">
              <span class="format-btn-title">CSV · movimientos</span>
              <span class="format-btn-sub">Solo el histórico de compras/ventas/recompensas.</span>
            </button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      const done = (val) => { ov.remove(); resolve(val); };
      ov.addEventListener('click', (e) => {
        if (e.target === ov || e.target.closest('.modal-close')) return done(null);
        const b = e.target.closest('[data-fmt]');
        if (b) done(b.dataset.fmt);
      });
    });
  }

  // Export/import COMPLETO en JSON: todo el estado (monedas con tags/ocultos/APR
  // + movimientos). Sirve para llevar tu cartera idéntica a otro dispositivo.
  // Objeto de estado completo (lo comparten export a archivo y sync a Gist).
  function buildState() {
    return {
      schema: 'mi-cartera', version: 1,
      exportedAt: new Date().toISOString(),
      updatedAt: storeVersion,   // para resolver conflictos: gana el más reciente
      portfolio, transactions, settings,
    };
  }

  // Aplica un estado ya parseado (lo comparten import de archivo y pull del Gist).
  // No persiste ni pide precios: eso lo decide quien llama.
  function applyState(data) {
    if (!data || !Array.isArray(data.portfolio) || !Array.isArray(data.transactions)) {
      throw new Error('No es un backup de Mi Cartera (falta portfolio/transactions).');
    }
    portfolio = data.portfolio;
    transactions = data.transactions;
    fillTotalEur(transactions);
    if (data.settings) settings = Object.assign({ dcaTarget: DEFAULT_DCA_TARGET, defenseTarget: DEFAULT_DEFENSE_TARGET, strategy: DEFAULT_STRATEGY }, data.settings);
    registerCustomCoins();
    registerCustomStocks();
    normalizePortfolio(portfolio);
  }

  function exportState() {
    const blob = new Blob([JSON.stringify(buildState(), null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mi-cartera-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importState(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data?.portfolio)) throw new Error('No es un backup de Mi Cartera.');
        if (!confirm(`Se restaurará TODO: ${data.portfolio.length} monedas y ${data.transactions.length} movimientos (con tags, ocultos y APR). Reemplaza lo que tengas ahora. ¿Continuar?`)) return;
        applyState(data);
        persist();
        fetchPrices();   // precios en vivo tras restaurar
        alert(`Restaurado: ${portfolio.length} monedas y ${transactions.length} movimientos.`);
      } catch (e) {
        alert('Error al importar el JSON: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ── SYNC ENTRE DISPOSITIVOS (Gist privado de GitHub) ──
  // El "perfil" = un token de GitHub (solo permiso gists) guardado en ESTE
  // navegador. El estado (mismo JSON del export) vive en un gist privado.
  const SYNC_KEY = 'miCartera.sync';
  const GIST_FILE = 'mi-cartera.json';
  let pushTimer = null;

  const getSync = () => {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; }
    catch { return {}; }
  };
  const setSync = (obj) => localStorage.setItem(SYNC_KEY, JSON.stringify(obj));
  const syncEnabled = () => !!getSync().token;
  const gistHeaders = (token) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  });

  function updateSyncStatus(kind, msg) {
    const el = document.getElementById('sync-status');
    if (el) {
      const cfg = getSync();
      const when = cfg.lastSync ? new Date(cfg.lastSync).toLocaleTimeString('es-ES') : '';
      el.className = `sync-status ${kind}`;
      el.textContent = kind === 'ok' ? `Sincronizado ${when ? '· ' + when : ''}`
        : kind === 'error' ? `Error de sync: ${msg || ''}`
        : kind === 'working' ? 'Sincronizando…'
        : '';
    }
    const dot = document.getElementById('sync-btn');
    if (dot) dot.classList.toggle('sync-on', syncEnabled());
  }

  // Aplica un estado que viene del gist SIN volver a empujarlo (evita ping-pong):
  // conserva el updatedAt remoto y guarda en local sin programar push.
  function applyRemote(data) {
    applyState(data);
    storeVersion = data.updatedAt || Date.now();
    saveStore({ portfolio, transactions, settings, updatedAt: storeVersion });
  }

  function syncSchedulePush() {
    if (!syncEnabled()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { syncPush(); }, 1500);
  }

  async function syncPush() {
    const cfg = getSync();
    if (!cfg.token) return;
    updateSyncStatus('working');
    const content = JSON.stringify(buildState(), null, 2);
    try {
      const url = cfg.gistId ? `https://api.github.com/gists/${cfg.gistId}` : 'https://api.github.com/gists';
      const res = await fetch(url, {
        method: cfg.gistId ? 'PATCH' : 'POST',
        headers: gistHeaders(cfg.token),
        body: JSON.stringify({
          description: 'Mi Cartera Crypto (sync)', public: false,
          files: { [GIST_FILE]: { content } },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const gist = await res.json();
      setSync({ ...cfg, gistId: gist.id, lastSync: Date.now() });
      updateSyncStatus('ok');
    } catch (e) {
      updateSyncStatus('error', e.message);
    }
  }

  async function syncPull() {
    const cfg = getSync();
    if (!cfg.token || !cfg.gistId) return;
    updateSyncStatus('working');
    try {
      const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, { headers: gistHeaders(cfg.token) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const gist = await res.json();
      const file = gist.files?.[GIST_FILE];
      if (!file) { updateSyncStatus('ok'); return; }
      const content = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
      const data = JSON.parse(content);
      if ((data.updatedAt || 0) > storeVersion) {
        applyRemote(data);
        render();
        fetchPrices();
      }
      setSync({ ...cfg, lastSync: Date.now() });
      updateSyncStatus('ok');
    } catch (e) {
      updateSyncStatus('error', e.message);
    }
  }

  // Conectar: guarda el token, busca un gist existente con nuestro archivo
  // (para enganchar un segundo dispositivo) o crea uno nuevo con el estado local.
  async function syncConnect(token) {
    setSync({ token, gistId: null });
    updateSyncStatus('working');
    try {
      const res = await fetch('https://api.github.com/gists?per_page=100', { headers: gistHeaders(token) });
      if (res.status === 401) throw new Error('Token inválido (401).');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const gists = await res.json();
      const found = gists.find(g => g.files && g.files[GIST_FILE]);
      if (found) {
        setSync({ token, gistId: found.id });
        await syncPull();          // ya había datos en la nube → los bajamos
      } else {
        await syncPush();          // primer dispositivo → creamos el gist
      }
      return true;
    } catch (e) {
      updateSyncStatus('error', e.message);
      throw e;
    }
  }

  function syncDisconnect() {
    localStorage.removeItem(SYNC_KEY);
    clearTimeout(pushTimer);
    updateSyncStatus('');
  }

  function openSyncModal() {
    const cfg = getSync();
    const connected = !!cfg.token;
    const ov = document.createElement('div');
    ov.className = 'modal-overlay open';
    ov.innerHTML = `
      <div class="modal" style="max-width:460px;">
        <div class="add-modal-head">
          <h3>Sync entre dispositivos</h3>
          <button type="button" class="modal-close" aria-label="Cerrar">&times;</button>
        </div>
        <p style="color:var(--text-secondary);font-size:13px;line-height:1.5;margin:0 0 14px;">
          Guarda tu cartera en un <strong>gist privado</strong> de GitHub para tenerla igual en todos tus dispositivos. Necesitas un token con permiso <strong>solo de gists</strong>.
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener" style="color:var(--accent-blue);">Crear token</a>.
        </p>
        ${connected ? `
          <div id="sync-status" class="sync-status ok"></div>
          <div class="sync-actions">
            <button type="button" id="sync-now-btn" class="add-submit">Sincronizar ahora</button>
            <button type="button" id="sync-disconnect-btn" class="add-cancel">Desconectar</button>
          </div>
        ` : `
          <label style="font-size:12px;color:var(--text-muted);">Token de GitHub</label>
          <input type="password" id="sync-token" placeholder="ghp_..." autocomplete="off" class="sync-input">
          <div id="sync-status" class="sync-status"></div>
          <div class="sync-actions">
            <button type="button" id="sync-connect-btn" class="add-submit">Conectar</button>
            <button type="button" class="add-cancel modal-close">Cancelar</button>
          </div>
        `}
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.modal-close')) close(); });
    updateSyncStatus(connected ? 'ok' : '');

    const connectBtn = ov.querySelector('#sync-connect-btn');
    if (connectBtn) connectBtn.addEventListener('click', async () => {
      const token = ov.querySelector('#sync-token').value.trim();
      if (!token) { updateSyncStatus('error', 'Pega un token.'); return; }
      connectBtn.disabled = true;
      try { await syncConnect(token); close(); openSyncModal(); }
      catch { connectBtn.disabled = false; }
    });
    const nowBtn = ov.querySelector('#sync-now-btn');
    if (nowBtn) nowBtn.addEventListener('click', async () => { await syncPull(); await syncPush(); });
    const disBtn = ov.querySelector('#sync-disconnect-btn');
    if (disBtn) disBtn.addEventListener('click', () => {
      if (confirm('¿Desconectar el sync de este dispositivo? No borra el gist ni tus datos.')) { syncDisconnect(); close(); }
    });
  }

  function importCsvFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('El CSV está vacío o mal formado.');
        const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        const idx = {};
        ['date', 'token', 'type', 'price', 'qty', 'totalUsd', 'totalEur'].forEach(f => { idx[f] = header.indexOf(f); });
        if (idx.token < 0 || idx.type < 0) throw new Error('Cabecera CSV no reconocida. Usa: date,token,type,price,qty,totalUsd');

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCsvLine(lines[i]);
          const get = (f) => (idx[f] >= 0 ? String(row[idx[f]] ?? '').replace(/^"|"$/g, '').trim() : '');
          const token = get('token').toUpperCase();
          const type = get('type');
          const date = get('date') || new Date().toISOString().slice(0, 10);
          const qty = parseFloat(get('qty'));
          const price = parseFloat(get('price'));
          const totalUsd = parseFloat(get('totalUsd')) || qty * price;
          // OJO: NO exigir price > 0. Los airdrops y las compras gratis (precio 0,
          // p.ej. ATOM/BTC recibidos) son tenencias reales; si se descartan aquí,
          // al reconstruir la cartera desde el CSV faltan y el total sale más bajo.
          if (!token || !type || !(qty > 0)) continue;
          const tx = { date, token, type, price: price > 0 ? price : 0, qty, totalUsd: totalUsd > 0 ? totalUsd : 0 };
          const totalEur = parseFloat(get('totalEur'));
          if (totalEur >= 0) tx.totalEur = totalEur;   // CSV antiguo sin la columna: lo rellena fillTotalEur
          parsed.push(tx);
        }
        fillTotalEur(parsed);
        if (!parsed.length) throw new Error('No se encontraron movimientos válidos en el CSV.');

        if (!confirm(`Se importarán ${parsed.length} movimientos y se reconstruirá la cartera. ¿Continuar?`)) return;

        // Reconstruye cartera desde cero aplicando los movimientos en orden cronológico.
        portfolio = [];
        const byDate = [...parsed].sort((a, b) => a.date.localeCompare(b.date));
        byDate.forEach(tx => {
          tx.applied = true;
          if (tx.id == null) tx.id = uid();
          applyMovement(tx);
        });
        transactions = byDate;
        persist();
        // Pide precios en vivo tras importar: si no, el P&L parte de los precios
        // de compra (cambio 0 → "$0.00 +0.00%") hasta que pulses refrescar a mano.
        fetchPrices();
        alert(`Importación completada: ${parsed.length} movimientos.`);
      } catch (e) {
        alert('Error al importar: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  // Restaura la app a cero: borra los movimientos de ESTE navegador, el service
  // worker y toda la caché del service worker (para que un deploy o archivos
  // nuevos no se queden atascados sirviendo la versión vieja).
  async function resetEverything() {
    const ok = confirm(
      '¿Poner la app a cero?\n\n' +
      'Se borrarán TODOS los movimientos, holdings y datos guardados en ESTE navegador.\n' +
      'También se elimina el service worker y toda la caché.\n\n' +
      '¿Continuar?'
    );
    if (!ok) return;
    // Cada paso de limpieza va aislado: si uno falla (SW/caché en mal estado o
    // bajo file://), NO debe impedir el reload final. Antes, un throw aquí dejaba
    // el localStorage borrado pero la vista intacta hasta pulsar F5 a mano.
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        regs.forEach((r) => r.unregister());
      }
    } catch (e) {
      console.warn('No se pudo desregistrar el service worker:', e);
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('No se pudo limpiar la caché:', e);
    }
    location.reload();
  }

  // ── INIT ──
  async function init() {
    renderSkeletons();

    // Arranque con lo que ya hay en disco: si existe snapshot de precios, se
    // pinta YA (en vez de dejar skeleton 10 s mientras el primer fetch agota
    // retries). El estado del punto refleja su antigüedad y el fetch siguiente
    // lo actualizará a los precios vivos.
    // Render siempre al arrancar — transacciones, cartera y movimientos
    // no necesitan precios. Si hay snapshot cacheado se usan; si no, los
    // valores monetarios quedan en '—' hasta que llega la API.
    {
      const mins = cachedPrices.ts
        ? Math.max(0, Math.floor((Date.now() - cachedPrices.ts) / 60000))
        : null;
      if (cachedPrices.ts && mins > CACHE_MAX_MIN) setLiveState('stale', mins);
      render();
    }
    fetchEurUsd();   // cambio €/$ en vivo; vuelve a pintar cuando llega

    const refreshBtn = document.getElementById('refresh-prices');
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchPrices());

    // Al volver a la pestaña (viene del background) refresca al momento; en
    // background los ticks se dilatan y era fácil quedarse con precios viejos.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) fetchPrices();
    });

    document.getElementById('currency-switch').addEventListener('click', () => {
      setCurrency(currency === 'USD' ? 'EUR' : 'USD');
    });

    // Tema claro/oscuro: preferencia local de este navegador (no viaja por el gist).
    // El icono muestra el estado: sol de día (claro), luna de noche (oscuro).
    const THEME_KEY = 'miCartera.theme';
    const sunSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    const moonSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
    const themeBtn = document.getElementById('theme-btn');
    const applyTheme = (t) => {
      document.body.classList.toggle('light', t === 'light');
      if (themeBtn) themeBtn.innerHTML = t === 'light' ? sunSvg : moonSvg;
    };
    applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const next = document.body.classList.contains('light') ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      render();   // redibuja los gráficos con el tema nuevo
    });

    setupSortable('asset-table');
    setupSortable('tx-table');

    const planBox = document.getElementById('plan-panel');
    planBox.addEventListener('change', onPlanPanelChange);

    document.getElementById('sec-cartera').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.card-edit');
      if (editBtn) {
        if (editBtn.id === 'core-edit')    editCoreTarget();
        else if (editBtn.id === 'sat-edit')    editSatTarget();
        else if (editBtn.id === 'defense-edit') editDefenseTarget();
        else if (editBtn.id === 'bolsa-edit') editBolsaTarget();
        return;
      }
      const card = e.target.closest('.card[data-bucket]');
      if (card) openBucketModal(card.dataset.bucket);
    });

    document.getElementById('asset-tbody').addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-token]');
      if (row) openTokenModal(row.dataset.token);
    });

    document.getElementById('export-btn').addEventListener('click', async () => {
      const fmt = await pickFormat('Exportar', '¿Qué quieres exportar?');
      if (fmt === 'json') exportState();
      else if (fmt === 'csv') exportCsv();
    });
    document.getElementById('import-btn').addEventListener('click', async () => {
      const fmt = await pickFormat('Importar', '¿Qué vas a importar?');
      if (!fmt) return;
      pendingImportFormat = fmt;
      const inp = document.getElementById('import-file');
      inp.accept = fmt === 'json' ? '.json,application/json' : '.csv,text/csv';
      inp.click();
    });
    document.getElementById('import-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) {
        if (pendingImportFormat === 'json') importState(f);
        else importCsvFile(f);
      }
      e.target.value = '';
      pendingImportFormat = null;
    });

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetEverything);

    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.addEventListener('click', openSyncModal);
    updateSyncStatus(syncEnabled() ? 'ok' : '');
    if (syncEnabled()) syncPull();   // al arrancar, baja lo último de la nube

    const searchInput = document.getElementById('tx-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        txFilter = e.target.value;
        renderTransactions();
      });
    }

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('[id^="sec-"]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-120px 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));

    // FAB + formulario "Añadir movimiento"
    document.getElementById('add-fab').addEventListener('click', () => openAddModal());
    document.getElementById('tx-tbody').addEventListener('click', (e) => {
      const del = e.target.closest('.tx-del');
      const ed = e.target.closest('.tx-edit');
      if (del) { if (confirm('¿Borrar este movimiento?')) deleteTx(del.dataset.txid); }
      else if (ed) { const t = transactions.find(x => x.id === ed.dataset.txid); if (t) openAddModal(t); }
    });
    document.getElementById('add-close').addEventListener('click', closeAddModal);
    document.getElementById('add-cancel').addEventListener('click', closeAddModal);
    document.getElementById('add-modal').addEventListener('click', (e) => {
      if (e.target.id === 'add-modal') closeAddModal();
    });
    document.getElementById('add-coin-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.coin-chip');
      if (!chip) return;
      selectToken(chip.dataset.token);
    });
    let esperaBusqueda;
    document.getElementById('add-coin-search').addEventListener('input', (e) => {
      clearTimeout(esperaBusqueda);
      const q = e.target.value.trim();
      if (q.length < 2) { renderCoinResults(null); return; }
      esperaBusqueda = setTimeout(() => Promise.allSettled([searchCoins(q), searchStocks(q)]).then(([cripto, bolsa]) => {
        if (cripto.status === 'rejected' && bolsa.status === 'rejected') { document.getElementById('add-error').textContent = 'No se pudo buscar ahora (límite de CoinGecko); prueba en un minuto.'; return; }
        renderCoinResults([...(bolsa.value || []), ...(cripto.value || [])]);   // la bolsa primero: la crypto trae muchos tokens que imitan acciones
      }), 450);
    });
    document.getElementById('add-type').addEventListener('change', (e) => {
      addState.type = e.target.value;
      updateTypeUI();
    });
    document.getElementById('add-qty').addEventListener('input', onQtyInput);
    document.getElementById('add-amount').addEventListener('input', onAmountInput);
    document.getElementById('add-form').addEventListener('submit', submitAdd);

    // Render inmediato con snapshot cacheado — no espera a la API.
    // El usuario ve sus movimientos y cartera al instante; los precios
    // se actualizan en cuanto llega la respuesta de CoinGecko.
    render();

    await fetchPrices();
    refreshInterval = setInterval(fetchPrices, 270000);  // 270s = ~320 llamadas/día a CoinGecko

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closeAddModal(); }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);

// ═══════════════════════════════════════════════════════════════
// PWA — registro del service worker (instalable en móvil)
// ═══════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const localOnly = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  window.addEventListener('load', () => {
    if (localOnly) {
      // En desarrollo (localhost) NUNCA se usa service worker: su caché solo
      // lía (sirve código viejo de visitas previas aunque cambies archivos).
      // Desregistra cualquier SW viejo que quede de pruebas anteriores.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    } else {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('No se pudo registrar el service worker:', err);
      });
    }
  });
}
