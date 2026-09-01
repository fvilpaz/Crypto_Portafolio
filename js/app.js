// ═══════════════════════════════════════════════════════════════
// MI CARTERA CRYPTO — Datos + API + Lógica
// ═══════════════════════════════════════════════════════════════

const App = (() => {
  const EUR_USD = 0.85;
  const COINGECKO_IMG = 'https://coin-images.coingecko.com/coins/images';

  // Catálogo de las monedas que farmeo. Sirve para el selector de "Añadir" y
  // para crear la tenencia la primera vez que compro una nueva (p.ej. USDC).
  const COINS = {
    BTC:  { name: 'Bitcoin',  coingeckoId: 'bitcoin',  icon: `${COINGECKO_IMG}/1/small/bitcoin.png`,      color: '#f7931a', cssClass: 'btc' },
    ETH:  { name: 'Ethereum', coingeckoId: 'ethereum', icon: `${COINGECKO_IMG}/279/small/ethereum.png`,   color: '#627eea', cssClass: 'eth' },
    ATOM: { name: 'Cosmos',   coingeckoId: 'cosmos',   icon: `${COINGECKO_IMG}/1481/small/cosmos_hub.png`, color: '#8c94a8', cssClass: 'atom' },
    TIA:  { name: 'Celestia', coingeckoId: 'celestia', icon: `${COINGECKO_IMG}/31967/small/tia.jpg`,       color: '#cd9eff', cssClass: 'tia' },
    USDC: { name: 'USD Coin', coingeckoId: 'usd-coin', icon: `${COINGECKO_IMG}/6319/small/usdc.png`,       color: '#2775ca', cssClass: 'usdc' },
  };

  const airdrops = [
    { token: 'PI', name: 'Pi Network', qty: 969.79, priceUsd: 0.08997, note: 'Bloqueado ~4 años', coingeckoId: 'pi-network', icon: `${COINGECKO_IMG}/54342/small/pi_network.jpg`, color: '#0ecb81', cssClass: 'pi' },
    { token: 'ATONE', name: 'ATONE', qty: 13.27, priceUsd: 0.1357, note: 'Airdrop / staking', coingeckoId: 'atomone', icon: `${COINGECKO_IMG}/33230/small/atomone_200x200.jpg`, color: '#1e90ff', cssClass: 'atone' },
    { token: 'MODE', name: 'Mode', qty: 1271, priceUsd: 0.00007056, note: 'Airdrop', coingeckoId: 'mode', icon: `${COINGECKO_IMG}/34979/small/MODE.jpg`, color: '#f0b90b', cssClass: 'mode' },
  ];

  const staking = [
    { token: 'ATOM', qty: 698, apr: 0.1946, note: 'RE-STAKEAR (no aportar dinero nuevo)' },
    { token: 'TIA', qty: 420, apr: 0.0547, note: 'Mantener stakeado' },
  ];

  const custody = [
    { name: 'Bit2Me', type: 'Exchange regulado ES', pct: 0.333, color: '#f0b90b', purpose: 'Fiat / Hacienda' },
    { name: 'Autocustodia', type: 'Claves propias', pct: 0.333, color: '#0ecb81', purpose: 'Largo plazo' },
    { name: 'Bitget', type: 'Exchange earn', pct: 0.334, color: '#1e90ff', purpose: 'Earn / operativa' },
  ];

  const cosmosTopPct = 0.35;

  // ── PERSISTENCIA (localStorage) ──
  // Los holdings y movimientos viven ahora en el navegador. La primera vez se
  // siembran con los arrays de arriba; a partir de ahí mandan los datos guardados.
  const STORE_KEY = 'miCartera.v1';
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
          // Datos pre-sincronización: sin fecha → se tratan como SIEMPRE vigentes
          // para no pisarlos con la semilla.
          if (data.updatedAt == null) data.updatedAt = Date.now();
          return data;
        }
      }
    } catch (e) {
      console.warn('localStorage ilegible, uso la semilla:', e);
    }
    // Primera vez (o datos corruptos): parte de cartera vacía.
    const empty = { portfolio: [], transactions: [], updatedAt: 0 };
    saveStore(empty);
    return empty;
  }

  const _store = loadStore();
  let portfolio = _store.portfolio;
  let transactions = _store.transactions;
  let storeVersion = _store.updatedAt || 0;

  // Guarda el estado actual (holdings + movimientos) tras cada edición.
  function persist() {
    storeVersion = Date.now();
    saveStore({ portfolio, transactions, updatedAt: storeVersion });
    cloudPush(); // copia de seguridad en la nube, para el resto de dispositivos
  }

  // Cada movimiento necesita un id estable para poder editar/borrar por fila.
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  transactions.forEach(t => { if (t.id == null) t.id = uid(); });

  // ── ESTADO ──
  let currency = 'USD';
  let prices = {};
  let sparklineData = {};
  let chartInstance = null;
  let evolutionChart = null;
  let refreshInterval = null;
  let txFilter = '';
  let prevTotal = null;
  let prevPnl = null;
  let isInitialLoad = true;

  // ── FORMATEO ──
  const fmt = (n, decimals = 2) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtCurrency = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const symbol = currency === 'USD' ? '$' : '€';
    const value = currency === 'EUR' ? n * EUR_USD : n;
    if (Math.abs(value) >= 1) return symbol + fmt(value);
    if (Math.abs(value) >= 0.01) return symbol + fmt(value, 4);
    return symbol + fmt(value, 6);
  };

  const fmtPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return sign + (n * 100).toFixed(2) + '%';
  };

  const pnlClass = (n) => n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral';

  function iconHtml(token, cssClass, size = 32) {
    const all = [...portfolio, ...airdrops];
    const asset = all.find(a => a.token === token) || COINS[token];
    if (asset?.icon) {
      return `<img src="${asset.icon}" alt="${token}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="token-icon ${cssClass}" style="display:none;width:${size}px;height:${size}px;font-size:${size * 0.38}px;">${token.substring(0, 2)}</div>`;
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
  // CoinGecko SIEMPRE va la primera: con la API key de js/config.js ya responde
  // CORS desde el navegador, en cualquier sitio (GitHub Pages, Netlify, local).
  // El proxy de Netlify queda solo de respaldo, con URL absoluta. El _t= rompe
  // cualquier caché.
  const PROXY_LIVE = 'https://portafoliocrypto.netlify.app/.netlify/functions/coingecko';

  // ── SINCRONIZACIÓN EN LA NUBE (opcional) ──
  // La función vive en Netlify (netlify/functions/sync.js). Si está desplegada,
  // la cartera se comparte entre dispositivos; si no, la llamada falla en
  // silencio y cada navegador usa su copia local. URL siempre absoluta.
  const SYNC_LIVE = 'https://portafoliocrypto.netlify.app/.netlify/functions/sync';
  const syncUrl = () => SYNC_LIVE;

  let syncTimer = null;
  function cloudPush() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        await fetch(syncUrl(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-sync-token': SYNC_TOKEN },
          body: JSON.stringify({ portfolio, transactions, updatedAt: storeVersion }),
          cache: 'no-store',
        });
      } catch (e) {
        console.warn('No se pudo subir la cartera a la nube:', e);
      }
    }, 600);
  }

  async function cloudPull() {
    try {
      const res = await fetch(syncUrl(), {
        headers: { 'x-sync-token': SYNC_TOKEN },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || data.empty || !Array.isArray(data.portfolio) || !Array.isArray(data.transactions)) {
        // Nube vacía: sembramos con nuestra copia local (el conflicto lo
        // resolverá updatedAt si otra copia más actual la pisa luego).
        cloudPush();
        return;
      }
      if ((data.updatedAt || 0) > storeVersion) {
        portfolio = data.portfolio;
        transactions = data.transactions;
        storeVersion = data.updatedAt || 0;
        saveStore({ portfolio, transactions, updatedAt: storeVersion });
      } else if (storeVersion > (data.updatedAt || 0)) {
        cloudPush(); // la copia local es más nueva → la subimos
      }
    } catch (e) {
      console.warn('No se pudo descargar de la nube:', e);
    }
  }

  function coingeckoUrls(type, ids) {
    const key = COINGECKO_API_KEY ? `&${COINGECKO_API_PARAM}=${COINGECKO_API_KEY}` : '';
    const direct = (type === 'markets'
      ? `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h`
      : `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`) + key;
    const urls = [direct];
    urls.push(`${PROXY_LIVE}?type=${type}&ids=${ids}`);
    return urls.map(u => u + (u.includes('?') ? '&' : '?') + '_t=' + Date.now());
  }

  // Fetch a CoinGecko resistente al rate limit (HTTP 429): reintenta hasta 3
  // veces respetando la cabecera Retry-After (o backoff exponencial si no viene).
  // no-store evita que navegador o PWA sirvan una respuesta cacheada. Si tras
  // los reintentos la fuente sigue caída, probamos la siguiente URL (el proxy).
  async function fetchCoinGecko(urls, retries = 3) {
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

  // ── SPARKLINE DATA ──
  async function fetchSparklines() {
    try {
      const ids = portfolio.map(a => a.coingeckoId).join(',');
      const urls = coingeckoUrls('markets', ids);
      const res = await fetchCoinGecko(urls);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      data.forEach(coin => {
        const asset = portfolio.find(a => a.coingeckoId === coin.id);
        if (asset && coin.sparkline_in_7d?.price) {
          sparklineData[asset.token] = coin.sparkline_in_7d.price.slice(-24);
        }
      });
    } catch (err) {
      console.warn('Sparklines fetch failed:', err.message);
    }
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
  // Se recalcula en cada llamada para que una moneda recién añadida (p.ej. USDC)
  // reciba precio en el siguiente tick sin necesidad de recargar.
  const coingeckoIds = () => [...portfolio, ...airdrops]
    .filter(a => a.coingeckoId)
    .map(a => a.coingeckoId)
    .join(',');

  async function fetchPrices() {
    try {
      const urls = coingeckoUrls('price', coingeckoIds());
      const res = await fetchCoinGecko(urls);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      [...portfolio, ...airdrops].forEach(asset => {
        if (data[asset.coingeckoId]) {
          prices[asset.token] = {
            price: data[asset.coingeckoId].usd,
            change24h: data[asset.coingeckoId].usd_24h_change || 0,
          };
        }
      });

      setLiveState(true);
      updateLastUpdate();
      render();
      if (Object.keys(sparklineData).length === 0) {
        fetchSparklines().then(() => {
          render();
        });
      }
    } catch (err) {
      console.warn('CoinGecko fetch failed:', err.message);
      // Solo rellenamos con precio de compra los tokens que aún no tienen
      // NINGÚN precio (primera carga sin red). Si ya teníamos precio en vivo de
      // una vuelta anterior, lo conservamos en vez de pisarlo con el de compra.
      [...portfolio, ...airdrops].forEach(asset => {
        if (!prices[asset.token]) {
          prices[asset.token] = { price: asset.avgPrice || asset.priceUsd || 0, change24h: 0 };
        }
      });
      // Avisamos visualmente de que los precios NO son en vivo, para no confundir
      // un total con precio de compra con uno real.
      setLiveState(false);
      render();
    }
  }

  // ── CÁLCULOS ──
  function getAssetValue(asset) {
    const p = prices[asset.token]?.price || asset.avgPrice;
    return asset.qty * p;
  }

  function getAssetPnl(asset) {
    return getAssetValue(asset) - asset.costUsd;
  }

  function getAirdropValue(ad) {
    return ad.qty * (prices[ad.token]?.price || ad.priceUsd);
  }

  function getTotalPortfolioValue() {
    return portfolio.reduce((sum, a) => sum + getAssetValue(a), 0);
  }

  function getTotalCost() {
    return portfolio.reduce((sum, a) => sum + a.costUsd, 0);
  }

  function getTotalAirdropValue() {
    return airdrops.reduce((sum, a) => sum + getAirdropValue(a), 0);
  }

  function getTotalStakingIncomeYearly() {
    return staking.reduce((sum, s) => {
      const asset = portfolio.find(a => a.token === s.token);
      if (!asset) return sum;
      const p = prices[s.token]?.price || asset.avgPrice;
      return sum + (s.qty * p * s.apr);
    }, 0);
  }

  function getCosmosPct() {
    const total = getTotalPortfolioValue();
    if (total === 0) return 0;
    const atomVal = getAssetValue(portfolio.find(a => a.token === 'ATOM'));
    const tiaVal = getAssetValue(portfolio.find(a => a.token === 'TIA'));
    return (atomVal + tiaVal) / total;
  }

  // ── RENDER ──
  function render() {
    renderHero();
    renderCards();
    renderDcaSummary();
    renderCosmosBar();
    renderAssetTable();
    renderAllocation();
    renderEvolutionChart();
    renderStaking();
    renderAirdrops();
    renderCustody();
    renderTransactions();
    if (isInitialLoad) isInitialLoad = false;
  }

  function renderHero() {
    const totalValue = getTotalPortfolioValue() + getTotalAirdropValue();
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

  function renderCards() {
    const total = getTotalPortfolioValue();
    const btcEth = getAssetValue(portfolio.find(a => a.token === 'BTC')) + getAssetValue(portfolio.find(a => a.token === 'ETH'));
    const cosmosPct = getCosmosPct();
    const stakingMonthly = getTotalStakingIncomeYearly() / 12;
    const airdropVal = getTotalAirdropValue();

    document.getElementById('card-btceth-pct').textContent = fmtPct(btcEth / total);
    document.getElementById('card-cosmos-pct').textContent = fmtPct(cosmosPct);

    const cosmosCard = document.getElementById('card-cosmos-pct');
    cosmosCard.className = cosmosPct > cosmosTopPct ? 'card-value negative' : 'card-value';

    document.getElementById('card-staking').textContent = fmtCurrency(stakingMonthly);
    document.getElementById('card-airdrops').textContent = fmtCurrency(airdropVal);
  }

  function renderDcaSummary() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dcaTarget = 175;

    const investedUsd = transactions
      .filter(tx => tx.date.startsWith(monthKey) && tx.type === 'Compra' && tx.totalUsd > 0)
      .reduce((sum, tx) => sum + tx.totalUsd, 0);

    const symbol = currency === 'USD' ? '$' : '€';
    const investedConv = currency === 'EUR' ? investedUsd * EUR_USD : investedUsd;
    const targetConv = currency === 'EUR' ? dcaTarget * EUR_USD : dcaTarget;
    const pct = Math.min((investedConv / targetConv) * 100, 100);
    const remaining = Math.max(targetConv - investedConv, 0);

    const el = document.getElementById('dca-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="dca-header">
        <span class="dca-month">${now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        <span class="dca-amount">${symbol}${fmt(investedConv, 2)} / ${symbol}${fmt(targetConv, 2)}</span>
      </div>
      <div class="dca-bar">
        <div class="dca-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="dca-footer">
        ${pct >= 100
          ? '<span class="positive">✓ Mes completo</span>'
          : `<span style="color:var(--text-muted)">Faltan ${symbol}${fmt(remaining, 2)}</span>`}
      </div>
    `;
  }

  function renderCosmosBar() {
    const cosmosPct = getCosmosPct() * 100;
    const bar = document.getElementById('cosmos-bar-fill');
    const label = document.getElementById('cosmos-bar-label');
    const banner = document.getElementById('cosmos-warning');
    if (!bar || !label) return;

    bar.style.width = `${Math.min(cosmosPct, 100)}%`;

    if (cosmosPct > cosmosTopPct * 100) {
      bar.className = 'progress-fill red';
      label.textContent = `${cosmosPct.toFixed(1)}% / 35% — TOPE SUPERADO`;
      label.className = 'cosmos-label negative';
      if (banner) { banner.style.display = 'flex'; banner.innerHTML = '⚠️ Cosmos por encima del 35%. No añadir dinero nuevo.'; }
    } else if (cosmosPct > (cosmosTopPct - 0.05) * 100) {
      bar.className = 'progress-fill yellow';
      label.textContent = `${cosmosPct.toFixed(1)}% / 35% — Cerca del tope`;
      label.className = 'cosmos-label';
      label.style.color = 'var(--accent-yellow)';
      if (banner) banner.style.display = 'none';
    } else {
      bar.className = 'progress-fill green';
      label.textContent = `${cosmosPct.toFixed(1)}% / 35%`;
      label.className = 'cosmos-label';
      label.style.color = 'var(--accent-green)';
      if (banner) banner.style.display = 'none';
    }
  }

  function renderAssetTable() {
    const tbody = document.getElementById('asset-tbody');
    const total = getTotalPortfolioValue();

    const sorted = [...portfolio].sort((a, b) => getAssetValue(b) - getAssetValue(a));

    tbody.innerHTML = sorted.map((asset, i) => {
      const p = prices[asset.token]?.price || asset.avgPrice;
      const change = prices[asset.token]?.change24h || 0;
      const value = getAssetValue(asset);
      const pnl = getAssetPnl(asset);
      const pnlPct = asset.costUsd > 0 ? pnl / asset.costUsd : 0;
      const weight = total > 0 ? value / total : 0;

      return `
        <tr data-token="${asset.token}" class="fade-in-up" style="cursor:pointer;animation-delay:${i * 0.06}s">
          <td>
            <div class="token-cell">
              ${iconHtml(asset.token, asset.cssClass)}
              <div>
                <div class="token-name">${asset.name}</div>
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
    }).join('');

    setTimeout(drawSparklines, 50);
  }

  function renderAllocation() {
    const total = getTotalPortfolioValue() + getTotalAirdropValue();

    const segments = portfolio.map(a => ({
      token: a.token, value: getAssetValue(a), color: a.color,
    }));

    airdrops.forEach(a => {
      const v = getAirdropValue(a);
      if (v > 0) segments.push({ token: a.token, value: v, color: a.color });
    });

    segments.sort((a, b) => b.value - a.value);

    const ctx = document.getElementById('allocation-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: segments.map(s => s.token),
        datasets: [{
          data: segments.map(s => s.value),
          backgroundColor: segments.map(s => s.color),
          borderColor: '#1e2329',
          borderWidth: 3,
          hoverBorderColor: '#eaecef',
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

    const monthlyInvest = {};
    transactions.forEach(tx => {
      if (tx.type === 'Compra' && tx.totalUsd > 0) {
        const month = tx.date.substring(0, 7);
        monthlyInvest[month] = (monthlyInvest[month] || 0) + tx.totalUsd / EUR_USD;
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

    const totalNow = (getTotalPortfolioValue() + getTotalAirdropValue());
    const currentVal = currency === 'EUR' ? totalNow * EUR_USD : totalNow;

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
          legend: { labels: { color: '#848e9c', font: { size: 12 } } },
          tooltip: {
            backgroundColor: '#2b3139',
            titleColor: '#eaecef',
            bodyColor: '#eaecef',
            borderColor: '#363c45',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#5e6673', font: { size: 11 } }, grid: { color: 'rgba(43,49,57,0.5)' } },
          y: {
            ticks: { color: '#5e6673', font: { size: 11 }, callback: (v) => '$' + v.toLocaleString() },
            grid: { color: 'rgba(43,49,57,0.5)' },
          },
        },
      },
    });
  }

  function renderStaking() {
    document.getElementById('staking-grid').innerHTML = staking.map((s, i) => {
      const asset = portfolio.find(a => a.token === s.token);
      const p = prices[s.token]?.price || asset?.avgPrice || 0;
      const yearlyIncome = s.qty * p * s.apr;
      const monthlyIncome = yearlyIncome / 12;

      return `
        <div class="staking-card fade-in-up" style="animation-delay:${i * 0.08}s">
          <div class="staking-card-header">
            <div class="token-info">
              ${iconHtml(s.token, asset?.cssClass || '', 32)}
              <span class="token-name">${s.token} Staking</span>
            </div>
            <span class="staking-apr">${(s.apr * 100).toFixed(2)}% APR</span>
          </div>
          <div class="staking-stats">
            <div>
              <div class="staking-stat-label">Stakeado</div>
              <div class="staking-stat-value">${fmt(s.qty, 0)} ${s.token}</div>
            </div>
            <div>
              <div class="staking-stat-label">Valor</div>
              <div class="staking-stat-value">${fmtCurrency(s.qty * p)}</div>
            </div>
            <div>
              <div class="staking-stat-label">Ingreso/año</div>
              <div class="staking-stat-value positive">${fmtCurrency(yearlyIncome)}</div>
            </div>
            <div>
              <div class="staking-stat-label">Ingreso/mes</div>
              <div class="staking-stat-value positive">${fmtCurrency(monthlyIncome)}</div>
            </div>
          </div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">${s.note}</div>
        </div>
      `;
    }).join('');
  }

  function renderAirdrops() {
    document.getElementById('airdrop-tbody').innerHTML = airdrops.map(a => {
      const price = prices[a.token]?.price || a.priceUsd;
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
          <td style="color:var(--text-muted);font-size:12px;">${a.note}</td>
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
        <span><strong>${c.name}</strong> — ${c.purpose}</span>
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
      const allAssets = [...portfolio, ...airdrops];
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
        <td class="text-right">${tx.price > 0 ? fmtCurrency(tx.price) : '—'}</td>
        <td class="text-right">${fmt(tx.qty, tx.token === 'BTC' ? 8 : 2)}</td>
        <td class="text-right">${tx.totalUsd > 0 ? fmtCurrency(tx.totalUsd) : '—'}</td>
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

  // Marca visualmente si los precios son en vivo (punto verde) o si la última
  // llamada a CoinGecko falló y podrían estar desactualizados (punto rojo + aviso).
  function setLiveState(ok) {
    const dot = document.querySelector('.live-dot');
    if (dot) {
      dot.classList.toggle('offline', !ok);
      dot.title = ok ? 'Precios en vivo' : 'Sin conexión con CoinGecko — precios no actualizados';
    }
    if (!ok) {
      const el = document.getElementById('last-update');
      if (el) el.textContent = 'Sin conexión — reintentando…';
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

        rows.sort((a, b) => {
          let va = a.cells[idx]?.textContent.trim() || '';
          let vb = b.cells[idx]?.textContent.trim() || '';
          const na = parseFloat(va.replace(/[$€,%+\s]/g, ''));
          const nb = parseFloat(vb.replace(/[$€,%+\s]/g, ''));
          if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
          return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });

        rows.forEach(r => tbody.appendChild(r));
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

    const stakingInfo = staking.find(s => s.token === token);
    const yearlyIncome = stakingInfo ? stakingInfo.qty * p * stakingInfo.apr : 0;

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

      ${stakingInfo ? `
        <div class="modal-section">
          <div class="modal-section-label">Staking</div>
          <div class="modal-grid-3">
            <div class="modal-stat-card">
              <div class="modal-stat-label">Stakeado</div>
              <div class="modal-stat-big">${fmt(stakingInfo.qty, 0)} ${token}</div>
            </div>
            <div class="modal-stat-card">
              <div class="modal-stat-label">APR</div>
              <div class="modal-stat-big positive">${(stakingInfo.apr * 100).toFixed(2)}%</div>
            </div>
            <div class="modal-stat-card">
              <div class="modal-stat-label">Ingreso / año</div>
              <div class="modal-stat-big positive">${fmtCurrency(yearlyIncome)}</div>
              <div class="modal-stat-sub">${fmtCurrency(yearlyIncome / 12)}/mes</div>
            </div>
          </div>
          <div class="modal-staking-note">${stakingInfo.note}</div>
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
                  <div class="modal-tx-price">${tx.price > 0 ? fmtCurrency(tx.price) : '—'}</div>
                  <div class="modal-tx-total">${tx.totalUsd > 0 ? fmtCurrency(tx.totalUsd) : '—'}</div>
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

  // ── AÑADIR MOVIMIENTO (Compra / Venta) ──
  let addState = { token: 'BTC', type: 'Compra' };
  let editingId = null;

  function renderAddChips() {
    document.getElementById('add-coin-chips').innerHTML = Object.keys(COINS).map(t => `
      <button type="button" class="coin-chip${t === addState.token ? ' active' : ''}" data-token="${t}">
        ${iconHtml(t, COINS[t].cssClass, 20)}<span>${t}</span>
      </button>`).join('');
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
      : `Sin precio de ${addState.token} todavía — metelo a mano`;
  }

  function updateEffective() {
    const amount = parseNum(document.getElementById('add-amount').value);
    const qty = parseNum(document.getElementById('add-qty').value);
    document.getElementById('add-derived').textContent = (amount > 0 && qty > 0)
      ? `≈ ${(amount / qty).toLocaleString('es-ES', { maximumFractionDigits: 6 })} €/ud`
      : '';
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
    if (tx.type === 'Compra') {
      if (h) { h.qty += tx.qty; h.costUsd += tx.totalUsd; h.avgPrice = h.costUsd / h.qty; }
      else {
        const m = COINS[tx.token] || {};
        portfolio.push({ token: tx.token, name: m.name || tx.token, qty: tx.qty, costUsd: tx.totalUsd, avgPrice: tx.price, coingeckoId: m.coingeckoId, icon: m.icon, color: m.color, cssClass: m.cssClass });
      }
    } else { // Venta
      if (!h) return;
      h.qty -= tx.qty;
      if (h.qty <= 1e-9) portfolio = portfolio.filter(a => a.token !== tx.token);
      else h.costUsd = h.avgPrice * h.qty;
    }
  }

  // Deshace el efecto (para borrar o editar un movimiento).
  function reverseMovement(tx) {
    const h = portfolio.find(a => a.token === tx.token);
    if (tx.type === 'Compra') {
      if (!h) return;
      h.qty -= tx.qty; h.costUsd -= tx.totalUsd;
      if (h.qty <= 1e-9) portfolio = portfolio.filter(a => a.token !== tx.token);
      else h.avgPrice = h.costUsd / h.qty;
    } else { // revertir una Venta = devolver
      if (h) { h.qty += tx.qty; h.costUsd = h.avgPrice * h.qty; }
      else {
        const m = COINS[tx.token] || {};
        portfolio.push({ token: tx.token, name: m.name || tx.token, qty: tx.qty, costUsd: tx.price * tx.qty, avgPrice: tx.price, coingeckoId: m.coingeckoId, icon: m.icon, color: m.color, cssClass: m.cssClass });
      }
    }
  }

  function openAddModal(tx) {
    editingId = tx ? tx.id : null;
    addState = { token: tx ? tx.token : 'BTC', type: tx ? tx.type : 'Compra' };
    document.getElementById('add-title').textContent = tx ? 'Editar movimiento' : 'Añadir movimiento';
    document.getElementById('add-date').value = tx ? tx.date : new Date().toISOString().slice(0, 10);
    document.getElementById('add-qty').value = tx ? fmtInput(tx.qty, 8) : '';
    document.getElementById('add-amount').value = tx ? fmtInput(tx.totalUsd * EUR_USD, 2) : '';
    document.getElementById('add-error').textContent = '';
    document.getElementById('add-derived').textContent = '';
    renderAddChips();
    renderAddPrice();
    updateEffective();
    document.querySelectorAll('#add-type button').forEach(b => b.classList.toggle('active', b.dataset.type === addState.type));
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
    const qty = parseNum(document.getElementById('add-qty').value);
    const amountEur = parseNum(document.getElementById('add-amount').value);

    if (!date || !(qty > 0) || !(amountEur > 0)) {
      errEl.textContent = 'Rellena fecha, cantidad e importe (mayores que 0).';
      return;
    }

    const totalUsd = amountEur / EUR_USD;   // € → $ (la cartera calcula en USD)
    const priceUsd = totalUsd / qty;

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

    const newTx = { id: editingId || uid(), date, token, type, price: priceUsd, qty, totalUsd, applied: true };
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
    const header = ['date', 'token', 'type', 'price', 'qty', 'totalUsd'];
    const rows = transactions.map(t => [t.date, t.token, t.type, t.price, t.qty, t.totalUsd].map(csvEscape));
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

  function importCsvFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('El CSV está vacío o mal formado.');
        const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        const idx = {};
        ['date', 'token', 'type', 'price', 'qty', 'totalUsd'].forEach(f => { idx[f] = header.indexOf(f); });
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
          parsed.push({ date, token, type, price: price > 0 ? price : 0, qty, totalUsd: totalUsd > 0 ? totalUsd : 0 });
        }
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
        render();
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
      '¿Restaurar la app?\n\n' +
      'Se borrarán TODOS los movimientos y datos guardados en ESTE navegador.\n' +
      'También se elimina el service worker y su caché (adiós a cargar versiones viejas).\n\n' +
      '¿Continuar?'
    );
    if (!ok) return;
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    location.reload();
  }

  // ── INIT ──
  async function init() {
    renderSkeletons();

    document.getElementById('currency-switch').addEventListener('click', () => {
      setCurrency(currency === 'USD' ? 'EUR' : 'USD');
    });

    setupSortable('asset-table');
    setupSortable('tx-table');

    document.getElementById('asset-tbody').addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-token]');
      if (row) openTokenModal(row.dataset.token);
    });

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await fetchPrices();
        refreshBtn.classList.remove('spinning');
      });
    }

    document.getElementById('export-btn').addEventListener('click', exportCsv);
    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importCsvFile(f);
      e.target.value = '';
    });

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetEverything);

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
      addState.token = chip.dataset.token;
      renderAddChips();
      renderAddPrice();
      if (parseNum(document.getElementById('add-amount').value) > 0) onAmountInput();
      else if (parseNum(document.getElementById('add-qty').value) > 0) onQtyInput();
    });
    document.getElementById('add-type').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-type]');
      if (!b) return;
      addState.type = b.dataset.type;
      document.querySelectorAll('#add-type button').forEach(x => x.classList.toggle('active', x === b));
    });
    document.getElementById('add-qty').addEventListener('input', onQtyInput);
    document.getElementById('add-amount').addEventListener('input', onAmountInput);
    document.getElementById('add-form').addEventListener('submit', submitAdd);

    // Sincroniza con la nube antes del primer render (con tope de 4 s para no
    // retrasar la app si la función tarda o no hay red).
    await Promise.race([cloudPull(), new Promise((r) => setTimeout(r, 4000))]);

    await fetchPrices();
    refreshInterval = setInterval(fetchPrices, 60000);

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
if ('serviceWorker' in navigator) {
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
