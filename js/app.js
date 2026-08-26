// ═══════════════════════════════════════════════════════════════
// MI CARTERA CRYPTO — Datos + API + Lógica
// ═══════════════════════════════════════════════════════════════

const App = (() => {
  const EUR_USD = 0.85;
  const COINGECKO_IMG = 'https://coin-images.coingecko.com/coins/images';

  const portfolio = [
    { token: 'BTC', name: 'Bitcoin', qty: 0.014246, costUsd: 879.44, avgPrice: 61732.42, coingeckoId: 'bitcoin', icon: `${COINGECKO_IMG}/1/small/bitcoin.png`, color: '#f7931a', cssClass: 'btc' },
    { token: 'ETH', name: 'Ethereum', qty: 0.5145, costUsd: 968.17, avgPrice: 1881.78, coingeckoId: 'ethereum', icon: `${COINGECKO_IMG}/279/small/ethereum.png`, color: '#627eea', cssClass: 'eth' },
    { token: 'ATOM', name: 'Cosmos', qty: 713.68, costUsd: 1123.15, avgPrice: 1.5737, coingeckoId: 'cosmos', icon: `${COINGECKO_IMG}/1481/small/cosmos_hub.png`, color: '#8c94a8', cssClass: 'atom' },
    { token: 'TIA', name: 'Celestia', qty: 423.85, costUsd: 213.47, avgPrice: 0.5036, coingeckoId: 'celestia', icon: `${COINGECKO_IMG}/31967/small/tia.jpg`, color: '#cd9eff', cssClass: 'tia' },
  ];

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

  const transactions = [
    { date: '2024-02-03', token: 'BTC', type: 'Compra', price: 43.18, qty: 0.000532, totalUsd: 0.02 },
    { date: '2024-02-28', token: 'BTC', type: 'Compra', price: 0, qty: 0.00023, totalUsd: 0 },
    { date: '2024-09-16', token: 'MODE', type: 'Compra', price: 0, qty: 349, totalUsd: 0 },
    { date: '2024-09-16', token: 'MODE', type: 'Compra', price: 0, qty: 676, totalUsd: 0 },
    { date: '2024-10-21', token: 'MODE', type: 'Compra', price: 0, qty: 246, totalUsd: 0 },
    { date: '2025-09-01', token: 'PI', type: 'Compra', price: 0, qty: 969.79, totalUsd: 0 },
    { date: '2025-09-01', token: 'ETH', type: 'Compra', price: 1539.8, qty: 0.274, totalUsd: 421.91 },
    { date: '2025-09-02', token: 'ETH', type: 'Compra', price: 4629.12, qty: 0.0192, totalUsd: 88.88 },
    { date: '2025-10-01', token: 'ETH', type: 'Compra', price: 4629.12, qty: 0.018, totalUsd: 83.32 },
    { date: '2025-10-15', token: 'ATONE', type: 'Airdrop', price: 0, qty: 10.27, totalUsd: 0 },
    { date: '2025-10-31', token: 'ATOM', type: 'Compra', price: 2.9952, qty: 18.19, totalUsd: 54.48 },
    { date: '2025-10-31', token: 'TIA', type: 'Compra', price: 0.9103, qty: 56.25, totalUsd: 51.2 },
    { date: '2025-11-04', token: 'TIA', type: 'Compra', price: 0.57, qty: 31, totalUsd: 17.67 },
    { date: '2025-12-06', token: 'TIA', type: 'Compra', price: 0.5765, qty: 60.46, totalUsd: 34.86 },
    { date: '2025-12-06', token: 'ATOM', type: 'Compra', price: 2.2432, qty: 9.25, totalUsd: 20.75 },
    { date: '2025-12-06', token: 'ATOM', type: 'Compra', price: 2.2432, qty: 15.53, totalUsd: 34.84 },
    { date: '2026-01-27', token: 'TIA', type: 'Compra', price: 0.438, qty: 136, totalUsd: 59.58 },
    { date: '2026-01-27', token: 'ATOM', type: 'Compra', price: 2.2049, qty: 27, totalUsd: 59.53 },
    { date: '2026-02-27', token: 'BTC', type: 'Compra', price: 65992.28, qty: 0.001714, totalUsd: 113.11 },
    { date: '2026-03-01', token: 'BTC', type: 'Compra', price: 66557.79, qty: 0.0031, totalUsd: 206.33 },
    { date: '2026-04-02', token: 'ATOM', type: 'Compra', price: 1.6438, qty: 30, totalUsd: 49.31 },
    { date: '2026-04-21', token: 'ATOM', type: 'Compra', price: 1.8064, qty: 93, totalUsd: 167.99 },
    { date: '2026-06-02', token: 'ATOM', type: 'Compra', price: 1.886, qty: 51, totalUsd: 96.19 },
    { date: '2026-06-02', token: 'TIA', type: 'Compra', price: 0.3927, qty: 57, totalUsd: 22.39 },
    { date: '2026-06-02', token: 'BTC', type: 'Compra', price: 69395.87, qty: 0.0007, totalUsd: 48.58 },
    { date: '2026-06-02', token: 'ETH', type: 'Compra', price: 1977.56, qty: 0.025, totalUsd: 49.44 },
    { date: '2026-06-04', token: 'ETH', type: 'Compra', price: 1751.03, qty: 0.06, totalUsd: 105.06 },
    { date: '2026-06-04', token: 'BTC', type: 'Compra', price: 62719.33, qty: 0.0012, totalUsd: 75.26 },
    { date: '2026-07-02', token: 'ETH', type: 'Compra', price: 1654.52, qty: 0.016, totalUsd: 26.47 },
    { date: '2026-07-02', token: 'BTC', type: 'Compra', price: 61242.18, qty: 0.0004, totalUsd: 24.5 },
    { date: '2026-07-02', token: 'ATOM', type: 'Compra', price: 1.559, qty: 17.71, totalUsd: 27.61 },
    { date: '2026-07-02', token: 'TIA', type: 'Compra', price: 0.3745, qty: 74.14, totalUsd: 27.77 },
    { date: '2026-07-17', token: 'ATOM', type: 'Compra', price: 0, qty: 45, totalUsd: 0 },
    { date: '2026-07-17', token: 'ATOM', type: 'Compra', price: 1.5048, qty: 407, totalUsd: 612.45 },
    { date: '2026-07-20', token: 'BTC', type: 'Compra', price: 64793.41, qty: 0.00517, totalUsd: 334.98 },
    { date: '2026-07-20', token: 'ETH', type: 'Compra', price: 1887.94, qty: 0.0593, totalUsd: 111.95 },
    { date: '2026-07-31', token: 'ETH', type: 'Compra', price: 1887.06, qty: 0.043, totalUsd: 81.14 },
    { date: '2026-07-31', token: 'BTC', type: 'Compra', price: 63885.09, qty: 0.0012, totalUsd: 76.66 },
  ];

  // ── ESTADO ──
  let currency = 'USD';
  let prices = {};
  let chartInstance = null;
  let evolutionChart = null;
  let refreshInterval = null;
  let txFilter = '';

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
    const asset = all.find(a => a.token === token);
    if (asset?.icon) {
      return `<img src="${asset.icon}" alt="${token}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="token-icon ${cssClass}" style="display:none;width:${size}px;height:${size}px;font-size:${size * 0.38}px;">${token.substring(0, 2)}</div>`;
    }
    return `<div class="token-icon ${cssClass}" style="width:${size}px;height:${size}px;font-size:${size * 0.38}px;">${token.substring(0, 2)}</div>`;
  }

  // ── COINGECKO API ──
  const COINGECKO_IDS = [...portfolio, ...airdrops]
    .filter(a => a.coingeckoId)
    .map(a => a.coingeckoId)
    .join(',');

  async function fetchPrices() {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(url);
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

      updateLastUpdate();
      render();
    } catch (err) {
      console.warn('CoinGecko fetch failed:', err.message);
      [...portfolio, ...airdrops].forEach(asset => {
        if (!prices[asset.token]) {
          prices[asset.token] = { price: asset.avgPrice || asset.priceUsd || 0, change24h: 0 };
        }
      });
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
  }

  function renderHero() {
    const totalValue = getTotalPortfolioValue() + getTotalAirdropValue();
    const totalCost = getTotalCost();
    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : 0;

    document.getElementById('hero-value').textContent = fmtCurrency(totalValue);

    const pnlEl = document.getElementById('hero-pnl');
    pnlEl.className = `hero-pnl ${pnlClass(totalPnl)}`;
    pnlEl.innerHTML = `
      <span>${fmtCurrency(totalPnl)}</span>
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

    tbody.innerHTML = portfolio.map(asset => {
      const p = prices[asset.token]?.price || asset.avgPrice;
      const change = prices[asset.token]?.change24h || 0;
      const value = getAssetValue(asset);
      const pnl = getAssetPnl(asset);
      const pnlPct = asset.costUsd > 0 ? pnl / asset.costUsd : 0;
      const weight = total > 0 ? value / total : 0;

      return `
        <tr>
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
          <td class="text-right">${fmtCurrency(value)}</td>
          <td class="text-right ${pnlClass(pnl)}">${fmtCurrency(pnl)}</td>
          <td class="text-right ${pnlClass(pnlPct)}">${fmtPct(pnlPct)}</td>
          <td class="text-right">${(weight * 100).toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
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
    document.getElementById('staking-grid').innerHTML = staking.map(s => {
      const asset = portfolio.find(a => a.token === s.token);
      const p = prices[s.token]?.price || asset?.avgPrice || 0;
      const yearlyIncome = s.qty * p * s.apr;
      const monthlyIncome = yearlyIncome / 12;

      return `
        <div class="staking-card">
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
      </tr>
      `;
    }).join('');
  }

  function updateLastUpdate() {
    const now = new Date();
    document.getElementById('last-update').textContent =
      `Actualizado: ${now.toLocaleTimeString('es-ES')} ${now.toLocaleDateString('es-ES')}`;
  }

  // ── TOGGLE MONEDA ──
  function setCurrency(c) {
    currency = c;
    document.querySelectorAll('.currency-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.currency === c);
    });
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

  // ── INIT ──
  async function init() {
    document.querySelectorAll('.currency-toggle button').forEach(btn => {
      btn.addEventListener('click', () => setCurrency(btn.dataset.currency));
    });

    setupSortable('asset-table');
    setupSortable('tx-table');

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await fetchPrices();
        refreshBtn.classList.remove('spinning');
      });
    }

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

    await fetchPrices();
    refreshInterval = setInterval(fetchPrices, 60000);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
