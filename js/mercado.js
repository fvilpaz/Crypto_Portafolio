(function () {

const WHO={BR:'Bridgewater (Dalio)',BK:'Berkshire (Buffett)',TG:'Tiger Global',DC:'D1 Capital',GF:'Gates Foundation'};
document.querySelectorAll('#mercado .token-icon').forEach(d=>d.title=WHO[d.textContent]||'');
function mkSw(n){[1,2].forEach(i=>{document.getElementById('mkv'+i).classList.toggle('on',i===n);document.getElementById('mkb'+i).classList.toggle('on',i===n)})}
const F={
CEG:{n:'Constellation Energy',t:'Eléctrica nuclear; contratos de energía para centros de datos de IA.',h:['Bridgewater · 2,9 % · desde T3 2024 · ▲','Berkshire · 2,1 % · desde T1 2025 · ▲','Tiger Global · 2,6 % · desde T2 2025 · ▲','D1 Capital · 2,0 % · NUEVA']},
VST:{n:'Vistra',t:'Generación eléctrica con fuerte exposición a la demanda de centros de datos.',h:['Bridgewater · 2,2 % · NUEVA','Tiger Global · 2,0 % · NUEVA','D1 Capital · 1,6 % · sin cambios']},
NEE:{n:'NextEra Energy',t:'Mayor eléctrica renovable de EE. UU.',h:['Berkshire · 1,5 % · ▲','D1 Capital · 1,1 % · =','Tiger Global · 1,0 % · =']},
DE:{n:'Deere & Co',t:'Maquinaria agrícola; ciclo ligado a precios de cultivos y tipos de interés.',h:['Berkshire · 1,4 % · ▼','Bridgewater · 0,6 % · ▼','Gates Foundation · 0,7 % · =']}};
function mkFicha(k){const f=F[k],d=document.getElementById('mkdrw');
d.innerHTML=`<h3>${k} · ${f.n}</h3><div style="color:var(--text-secondary);font-size:13px">${f.t}</div>
<div class="cols"><div><small>QUIÉN LA TIENE</small><ul style="padding-left:16px;margin:6px 0 0">${f.h.map(x=>'<li>'+x+'</li>').join('')}</ul></div>
<div><small>NOTICIAS RECIENTES</small><ul style="padding-left:16px;margin:6px 0 0"><li>Titular de ejemplo 1 (fuente, fecha)</li><li>Titular de ejemplo 2 (fuente, fecha)</li><li>Titular de ejemplo 3 (fuente, fecha)</li></ul></div>
<div><small>FUNDAMENTALES</small><ul style="padding-left:16px;margin:6px 0 0"><li>PER: 24</li><li>Deuda/EBITDA: 2,8</li><li>Crec. ingresos: +11 %</li><li>Dividendo: 0,6 %</li></ul></div></div>
<div style="margin-top:14px"><div class="add-actions"><button type="button" class="add-submit">+ Añadir a mi Bolsa</button> <button type="button" class="add-cancel" onclick="this.closest('.drawer').classList.remove('open')">Cerrar</button></div></div>`;
d.classList.add('open');d.scrollIntoView({behavior:'smooth',block:'nearest'})}

window.mkSw = mkSw; window.mkFicha = mkFicha;

})();

(function () {
  const btn = document.getElementById('mk-btn');
  const view = document.getElementById('mercado');
  const main = document.querySelector('main.container:not(#mercado)');
  function show(on) {
    main.style.display = on ? 'none' : '';
    view.hidden = !on;
    btn.classList.toggle('active', on);
    const svg = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const g = (d, w) => `<span class="currency-switch__glyph">${svg(d)}</span><span class="currency-switch__code">${w}</span>`;
    btn.innerHTML = on ? g('<path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 000 4h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7"/><circle cx="17" cy="14" r="1"/>', 'Cartera') : g('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>', 'Mercado');
    btn.title = on ? 'Volver a mi cartera' : 'Mercado: grandes inversores y crypto';
    window.scrollTo(0, 0);
  }
  btn.addEventListener('click', () => show(view.hidden));
})();

/* Datos reales: ultimo 13F de cada gestor (los genera scripts/update_13f.py). Se cargan al abrir Mercado por primera vez. */
(function () {
  const fx = window.mkFx, view = document.getElementById('mercado'), cont = document.getElementById('b13f');
  let datos = null, indice = null, coin = null;
  // Las empresas que sigo en bolsa las define scripts/update_13f.py (SEGUIDAS) y llegan en coin.seguidas.
  const sigo = (emisor) => listaSeguimiento().some((x) => { const a = norm(x.n), b = norm(emisor); return !!a && !!b && (a === b || b.startsWith(a + ' ') || a.startsWith(b + ' ')); });
  const el = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; };
  const billones = (usd) => (fx.toCur(usd) / 1e9).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' mil M' + (fx.cur() === 'EUR' ? '€' : '$');
  const dia = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  // Todas las posiciones de cada inversor (data/13f_posiciones.json): las usan el buscador y el botón "Ver la lista completa" de cada tabla.
  let posAll = null;
  const cargaPos = () => (posAll ? Promise.resolve(posAll) : fetch('data/13f_posiciones.json').then((r) => r.json()).then((x) => { posAll = x; return x; }));
  // Ficha de cada inversor (data/gestores_info.json, escrita a mano: quién es, sede, estilo) y, debajo, un resumen de lo que ha hecho este trimestre calculado
  // con sus posiciones del 13F (data/13f_posiciones.json): compras nuevas, ventas enteras, subidas y bajadas.
  let infoAll = null;
  const cargaInfo = () => (infoAll ? Promise.resolve(infoAll) : fetch('data/gestores_info.json').then((r) => r.json()).then((x) => { infoAll = x; return x; }).catch(() => (infoAll = {})));
  function rellenaFicha(d, clave, ficha, quienEl) {
    Promise.all([cargaInfo(), cargaPos()]).then(([info, pos]) => {
      const i = info[clave]; if (!i) return;
      quienEl.textContent = i.persona;
      const cab = el('div', '', ''); cab.style.cssText = 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap';
      const grande = el('span', i.persona, ''); grande.style.cssText = 'font-size:20px;font-weight:700;color:var(--text-primary)';
      cab.append(grande, el('span', 'en ' + i.titulo, 'nm'));
      const datos = document.createElement('div'); datos.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:10px 0';
      i.datos.forEach(([k, v]) => { const c = document.createElement('span'); c.className = 'chip'; c.append(el('b', k + ': '), v); datos.append(c); });
      const texto = el('p', i.resumen, ''); texto.style.cssText = 'margin:0 0 10px;line-height:1.5;color:var(--text-secondary)';
      ficha.replaceChildren(cab, datos, texto);
      // lo que ha hecho este trimestre, de sus posiciones reales
      const filas = Object.entries(pos.filas).filter(([, por]) => por[clave]).map(([emisor, por]) => ({ emisor, peso: por[clave][0], c: por[clave][2] }));
      const vivas = filas.filter((f) => f.c !== 'salio').sort((a, b) => b.peso - a.peso);
      const cuenta = (test) => filas.filter((f) => test(f.c)).length;
      const nuevas = cuenta((c) => c === 'nueva'), vendidas = cuenta((c) => c === 'salio'), suben = cuenta((c) => typeof c === 'number' && c > 0), bajan = cuenta((c) => typeof c === 'number' && c < 0);
      const chip = (cls, txt) => { const c = el('span', txt, 'chip ' + cls); return c; };
      const mov = document.createElement('div'); mov.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';
      mov.append(el('b', 'Este trimestre:', ''), chip('new', `★ ${nuevas} ${nuevas === 1 ? 'compra nueva' : 'compras nuevas'}`), chip('up', `▲ ${suben} ${suben === 1 ? 'aumenta' : 'aumentan'}`), chip('dn', `▼ ${bajan} ${bajan === 1 ? 'reduce' : 'reducen'}`), chip('dn', `✖ ${vendidas} ${vendidas === 1 ? 'vendida entera' : 'vendidas enteras'}`));
      const top10 = vivas.slice(0, 10).reduce((s, f) => s + f.peso, 0);
      const pie = el('p', `Su mayor posición es ${vivas[0].emisor} (${vivas[0].peso.toLocaleString('es-ES')} % de su cartera) y las 10 mayores suman el ${top10.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %. Ficha escrita a mano; las cifras salen del 13F de la SEC.`, 'nm');
      pie.style.margin = '8px 0 0';
      ficha.append(mov, pie);
    });
  }
  function seccion(d, clave) {
    const sec = document.createElement('details');
    sec.className = 'card mk-desplegable'; sec.style.cssText = 'margin-top:12px;padding:12px 16px';
    const badge = el('span', '13F · SEC', 'section-badge');
    badge.style.cssText = 'background:var(--accent-green-bg);color:var(--accent-green);';
    const h = document.createElement('summary');
    h.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    const nombre = el('span', d.gestor, ''); nombre.style.cssText = 'font-weight:700;font-size:15px;color:var(--text-primary)';
    const resumen = document.createElement('span'); resumen.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:auto;color:var(--text-muted);font-size:12px';
    const chipInv = el('span', 'Inversiones', 'section-badge'); chipInv.style.cssText = 'background:var(--bg-input);color:var(--text-secondary);';
    resumen.append(chipInv, `${d.n_emisores} empresas · ${billones(d.total_usd)}`);
    const flecha = document.createElement('span'); flecha.innerHTML = '<svg class="strat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    const quienEl = el('span', '', ''); quienEl.style.cssText = 'color:var(--text-secondary);font-size:13px';   // la persona (Warren Buffett...), en cuanto cargue su ficha
    h.append(nombre, quienEl, badge, resumen, flecha);
    const ficha = document.createElement('div'); ficha.style.cssText = 'margin-top:14px;padding:14px 16px;border-radius:12px;background:var(--bg-input)'; rellenaFicha(d, clave, ficha, quienEl);
    const cuantas = d.top.length < d.n_emisores ? `Las ${d.top.length} mayores de las ${d.n_emisores} empresas` : `Las ${d.n_emisores} empresas`;
    const hint = el('p', `${cuantas} en las que ha invertido (${billones(d.total_usd)} en total). Informe 13F a la SEC con cierre el ${dia(d.periodo)}, presentado el ${dia(d.presentado)}: es lo que tenían entonces, no lo que tienen hoy. Fuente: ${d.fuente}.`, 'reparto-hint');
    const tbody = document.createElement('tbody');
    d.top.forEach((t) => {
      const c = t.cambio_acciones_pct, tr = document.createElement('tr'), cambio = document.createElement('td');
      if (sigo(t.emisor)) tr.className = 'sigo';
      if (c === 'nueva') cambio.append(el('span', '★ Compra nueva', 'chip new'));
      else if (c === 0) cambio.textContent = 'Sin cambios';
      else cambio.append(el('span', (c > 0 ? '▲ +' : '▼ ') + c.toLocaleString('es-ES') + ' % acciones', 'chip ' + (c > 0 ? 'up' : 'dn')));
      const num = (txt) => el('td', txt, 'text-right');
      tr.append(el('td', t.emisor, 'tk'), num(billones(t.valor_usd)), num(t.peso_pct.toLocaleString('es-ES') + ' %'), num(t.acciones.toLocaleString('es-ES')), cambio);
      tbody.append(tr);
    });
    const tabla = document.createElement('table');
    tabla.innerHTML = '<thead><tr><th>Empresa en la que invierte</th><th class="text-right">Valor invertido</th><th class="text-right">% de su cartera</th><th class="text-right">Nº de acciones</th><th>Cambio frente al trimestre anterior</th></tr></thead>';
    tabla.append(tbody);
    const wrap = el('div', '', 'table-wrapper'); wrap.append(tabla); wrap.style.marginTop = '12px';
    sec.append(h, ficha, hint, wrap);
    if (d.n_emisores > d.top.length) {   // más empresas que las 10 mayores: página propia con todas (buscador y orden) y, aparte, la tabla original de la SEC
      const pie = document.createElement('div'); pie.style.cssText = 'display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:12px';
      const todas = el('a', `Ver la lista completa (${d.n_emisores} empresas) ↗`, ''); todas.href = 'gestor.html?g=' + encodeURIComponent(clave);   // misma pestaña: la flecha de esa página vuelve a Mercado
      todas.style.cssText = 'font-weight:600;color:var(--accent-blue)'; pie.append(todas);
      if (d.tabla_url) { const sec13 = el('a', 'Tabla original de la SEC ↗', ''); sec13.href = d.tabla_url; sec13.target = '_blank'; sec13.rel = 'noopener'; sec13.style.cssText = 'font-size:12px;color:var(--text-muted)'; pie.append(sec13); }
      sec.append(pie);
    }
    return sec;
  }
  function pintar() {
    if (!datos || !coin) return;
    cont.replaceChildren(...datos.map((d, i) => seccion(d, indice[i].clave)));
  }
  const pct = (n) => n.toLocaleString('es-ES') + ' %';
  // Personas que no presentan 13F (p. ej. Elon Musk): lo que declaran a la SEC en los Schedule 13D/13G (pasar del 5 % de una empresa) y en los Form 4
  // (operaciones de directivos y grandes accionistas). Los genera scripts/update_insiders.py.
  const CODIGOS = { P: 'Compra en mercado', S: 'Venta en mercado', A: 'Concesión de acciones', M: 'Ejercicio de opciones', X: 'Ejercicio de opciones', F: 'Retención para impuestos',
    G: 'Donación', C: 'Conversión de otro valor', D: 'Devolución a la empresa', J: 'Otra operación' };
  function seccionPersona(p) {
    const sec = document.createElement('details');
    sec.className = 'card mk-desplegable'; sec.style.cssText = 'margin-top:12px;padding:12px 16px';
    const badge = el('span', 'Form 4 · 13D/G · SEC', 'section-badge');
    badge.style.cssText = 'background:var(--accent-green-bg);color:var(--accent-green);';
    const h = document.createElement('summary');
    h.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    const nombre = el('span', p.nombre, ''); nombre.style.cssText = 'font-weight:700;font-size:15px;color:var(--text-primary)';
    const resumen = el('span', `${p.participaciones.length} empresas con más del 5 %${p.operaciones.length ? ' · última operación ' + dia(p.operaciones[0].fecha) : ''}`, '');
    resumen.style.cssText = 'margin-left:auto;color:var(--text-muted);font-size:12px';
    const flecha = document.createElement('span'); flecha.innerHTML = '<svg class="strat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    h.append(nombre, badge, resumen, flecha);
    const num = (txt) => el('td', txt, 'text-right');
    const tabla = (cabecera, filas) => {
      const t = document.createElement('table'); t.innerHTML = `<thead><tr>${cabecera}</tr></thead>`;
      const tb = document.createElement('tbody'); tb.append(...filas); t.append(tb);
      const w = el('div', '', 'table-wrapper'); w.append(t); w.style.marginTop = '12px'; return w;
    };
    const filaPart = (x) => { const tr = document.createElement('tr'); if (sigo(x.emisor)) tr.className = 'sigo';
      tr.append(el('td', x.emisor, 'tk'), num(x.acciones === null ? '—' : x.acciones.toLocaleString('es-ES')), num(x.pct === null ? '—' : pct(x.pct)), el('td', x.formulario), el('td', dia(x.presentado))); return tr; };
    const filaOp = (x) => { const tr = document.createElement('tr'); if (sigo(x.emisor)) tr.className = 'sigo';
      const que = el('td', ''); que.append(el('span', (x.tipo === 'A' ? '▲ ' : '▼ ') + (CODIGOS[x.codigo] || 'Código ' + x.codigo), 'chip ' + (x.tipo === 'A' ? 'up' : 'dn')));
      tr.append(el('td', dia(x.fecha)), el('td', x.simbolo || x.emisor, 'tk'), que, num(x.acciones.toLocaleString('es-ES')), num(x.precio > 0 ? '$' + x.precio.toLocaleString('es-ES') : '—'), num(x.tras.toLocaleString('es-ES'))); return tr; };
    sec.append(h,
      el('p', 'Lo que declara a la SEC: los Schedule 13D/13G (quien pasa del 5 % de una empresa) y los Form 4 (sus operaciones, que se presentan en 2 días). Acciones y % son de la fecha de cada informe.', 'reparto-hint'),
      tabla('<th>Empresa</th><th class="text-right">Nº de acciones</th><th class="text-right">% de la empresa</th><th>Informe</th><th>Presentado</th>', p.participaciones.map(filaPart)));
    if (p.operaciones.length) sec.append(
      el('p', 'Últimas operaciones (Form 4). "Retención para impuestos" y "Ejercicio de opciones" no son compras ni ventas en el mercado; "Conversión" es cambiar un tipo de acción por otro.', 'reparto-hint'),
      tabla('<th>Fecha</th><th>Empresa</th><th>Qué hizo</th><th class="text-right">Acciones</th><th class="text-right">Precio</th><th class="text-right">Tiene después</th>', p.operaciones.map(filaOp)));
    return sec;
  }
  // Rastreo: busca CUALQUIER empresa (nombre o símbolo) y muestra su precio si lo tenemos y, con un indicador por inversor, cuáles de tus gestores
  // la tienen en su 13F (todas sus posiciones, no solo las 10 mayores: data/13f_posiciones.json). Las empresas salen del 13F y de la búsqueda de Twelve Data (EE. UU.).
  let preciosAcc = null;
  let noticiasAcc = null;   // titulares recientes por empresa (data/noticias.json, de Google Noticias): se cargan al abrir la primera ficha
  const cargaNoticias = () => (noticiasAcc ? Promise.resolve(noticiasAcc) : fetch('data/noticias.json').then((r) => r.json()).then((x) => { noticiasAcc = x.noticias || {}; return noticiasAcc; }).catch(() => (noticiasAcc = {})));
  let tecAcc = {};   // análisis técnico (medias, RSI, serie de un año): data/tecnico.json
  let tickerDeEmisor = {};   // nombre del emisor en el 13F -> ticker (data/acciones_13f.json): así las empresas del 13F también llevan precio, técnico y fundamentales
  let fundAcc = {};   // fundamentales (data/fundamentales.json); sin el archivo, esas celdas salen como "—"
  const cargaPrecios = () => (preciosAcc ? Promise.resolve(preciosAcc) : fetch('data/precios.json').then((r) => r.json()).then((x) => { preciosAcc = x.precios || {}; return preciosAcc; }).catch(() => (preciosAcc = {}))
    .then((p) => Promise.all([fetch('data/fundamentales.json').then((r) => r.json()).then((f) => { fundAcc = f.empresas || {}; }).catch(() => {}), fetch('data/tecnico.json').then((r) => r.json()).then((t) => { tecAcc = t.simbolos || {}; }).catch(() => {}), fetch('data/acciones_13f.json').then((r) => r.json()).then((a) => { Object.entries(a.origen || {}).forEach(([tk, em]) => { tickerDeEmisor[em] = tk; }); }).catch(() => {})]).then(() => p)));
  const SUFIJOS = new Set(['INC', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'HOLDINGS', 'HLDGS', 'GROUP', 'THE', 'NV', 'SA', 'AG', 'LLC', 'LP']);
  const norm = (s) => String(s).toUpperCase().replace(/[.,&'()/-]/g, ' ').split(/\s+/).filter((w) => w && !SUFIJOS.has(w)).join(' ');
  // Análisis técnico de Rastreo: RSI, tendencia (precio frente a las medias de 50 y 200 días) y la mini gráfica del último año (los calcula la Action con un año de cierres de Yahoo).
  function rsiCelda(pr0, simbolo) {
    const pr = pr0 && { ...pr0, ...(tecAcc[simbolo] || {}) };
    const c = el('td', '', 'text-right');
    if (!pr || pr.rsi14 == null) { c.textContent = '—'; return c; }
    c.append(`${Math.round(pr.rsi14)} `);
    if (pr.rsi14 >= 70) { const t = el('span', 'sobrecompra', 'chip new'); c.append(t); c.title = 'RSI alto: la acción ha subido muy rápido en las últimas semanas'; }
    else if (pr.rsi14 <= 30) { const t = el('span', 'sobreventa', 'chip dn'); c.append(t); c.title = 'RSI bajo: la acción ha bajado muy rápido en las últimas semanas'; }
    else c.title = 'RSI normal (entre 30 y 70)';
    return c;
  }
  function tendenciaCelda(pr0, simbolo) {
    const pr = pr0 && { ...pr0, ...(tecAcc[simbolo] || {}) };
    const c = document.createElement('td');
    if (!pr || pr.sma50 == null || pr.sma200 == null) { c.textContent = '—'; return c; }
    const alcista = pr.price > pr.sma50 && pr.sma50 > pr.sma200, bajista = pr.price < pr.sma50 && pr.sma50 < pr.sma200;
    c.append(alcista ? el('span', '▲ Alcista', 'chip up') : bajista ? el('span', '▼ Bajista', 'chip dn') : el('span', 'Mixta', 'chip'));
    c.title = 'Precio ' + n2g(pr.price) + ' · media 50 d ' + n2g(pr.sma50) + ' · media 200 d ' + n2g(pr.sma200);
    return c;
  }
  function serieCelda(pr0, simbolo) {
    const c = document.createElement('td');
    const s = (tecAcc[simbolo] || {}).serie;
    if (!s || s.length < 5) { c.textContent = '—'; return c; }
    const lo = Math.min(...s), hi = Math.max(...s), w = 96, h = 30, rg = hi - lo || 1;
    const pts = s.map((v, i) => `${(i / (s.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / rg * (h - 4)).toFixed(1)}`).join(' ');
    const sube = s[s.length - 1] >= s[0], col = sube ? 'var(--accent-green)' : 'var(--accent-red)';
    c.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    c.title = `Último año: de ${n2g(s[0])} a ${n2g(s[s.length - 1])} (${sube ? '+' : ''}${n2g((s[s.length - 1] / s[0] - 1) * 100)} %)`;
    return c;
  }
  // "Desde cuándo": el 13F trae el periodo (fecha de cierre del trimestre); con '<' delante significa que la tiene desde ese trimestre o desde antes (solo se miran seis).
  const trimestre = (iso) => { const [a, mes] = iso.split('-'); return 'T' + Math.ceil(+mes / 3) + ' ' + a; };
  const desdeTexto = (d) => (d && d.startsWith('<') ? `la tiene desde ${trimestre(d.slice(1))} o antes` : d ? `la tiene desde ${trimestre(d)}` : '');
  const n2g = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  // Fundamentales: Yahoo da capitalización, PER y BPA de los últimos 12 meses de empresas de cualquier país (en la moneda de cada una); si no hay, se calcula con los datos de la SEC.
  const simMon = (c) => (c === 'USD' || !c ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : c);
  const grandeMon = (v, c) => { const s = simMon(c), sep = s.length > 1 ? ' ' : ''; return v >= 1e9 ? `${n2g(v / 1e9)} mil M${sep}${s}` : v >= 1e6 ? `${n2g(v / 1e6)} M${sep}${s}` : `${n2g(v)}${sep}${s}`; };
  const capDe = (pr, fu) => (fu && fu.cap ? { txt: grandeMon(fu.cap, fu.moneda || (pr && pr.currency)), tip: 'Valor de toda la empresa en bolsa (Yahoo Finance)' }
    : pr && pr.currency !== 'EUR' && fu && fu.acciones ? { txt: grandeUsd(pr.price * fu.acciones), tip: `${fu.acciones.toLocaleString('es-ES')} acciones × precio de hoy` } : null);
  const perDe = (pr, fu) => (fu && fu.per != null ? { v: fu.per, tip: 'PER de los últimos 12 meses (Yahoo Finance)' } : pr && fu && fu.bpa > 0 ? { v: pr.price / fu.bpa, tip: 'Precio / beneficio por acción del último ejercicio' } : null);
  const finMon = (fu) => fu.moneda_fin || fu.moneda || 'USD';
  const grandeUsd = (v) => (v >= 1e9 ? n2g(v / 1e9) + ' mil M$' : v >= 1e6 ? n2g(v / 1e6) + ' M$' : n2g(v) + ' $');   // 'mil M' = miles de millones, como en el resto de Mercado
  const cambioChip = (c) => c === 'nueva' ? el('span', '★ nueva', 'chip new') : c === 'salio' ? el('span', '✖ vendió todo', 'chip dn') : c === 0 ? el('span', '=', 'chip') : el('span', (c > 0 ? '▲ +' : '▼ ') + c.toLocaleString('es-ES') + ' %', 'chip ' + (c > 0 ? 'up' : 'dn'));
  // Celda con un chip por inversor que tiene la empresa (o que la vendió entera): lo usan el Rastreo y el Seguimiento.
  function chipsPoseedores(por, gestores) {
    const td = document.createElement('td');
    gestores.filter((g) => por && por[g.clave]).forEach((g) => {
      const v = por[g.clave], chip = document.createElement('span'); chip.className = 'chip'; chip.style.cssText = 'margin:0 6px 4px 0;display:inline-flex;gap:6px;align-items:center';
      const salio = v[2] === 'salio';   // ya no la tiene: v[3] y v[4] son el peso y las acciones que tenía el trimestre anterior
      chip.title = salio ? `${g.nombre}: la vendió entera este trimestre (tenía ${v[3].toLocaleString('es-ES')} % de su cartera · ${v[4].toLocaleString('es-ES')} acciones)` : `${g.nombre}: ${v[0].toLocaleString('es-ES')} % de su cartera · ${v[1].toLocaleString('es-ES')} acciones${v[3] ? ' · ' + desdeTexto(v[3]) : ''}`;
      chip.append(el('b', g.corto), salio ? `tenía ${v[3].toLocaleString('es-ES')} %` : `${v[0].toLocaleString('es-ES')} %`, cambioChip(v[2])); td.append(chip);
    });
    if (!td.hasChildNodes()) { td.textContent = 'Ninguno de tus inversores'; td.style.color = 'var(--text-muted)'; }
    return td;
  }
  // Seguimiento (watchlist): las acciones de tu cartera se siguen solas y el resto se marca con la estrella del Rastreo (se guarda en este navegador).
  const SEG_KEY = 'miCartera.seguimiento';
  const leeSeg = () => { try { const a = JSON.parse(localStorage.getItem(SEG_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => x && /^[A-Z0-9.]{1,10}$/.test(x.s)) : []; } catch (e) { return []; } };
  const guardaSeg = (a) => { try { localStorage.setItem(SEG_KEY, JSON.stringify(a)); } catch (e) { /* sin almacenamiento: no se guarda */ } };
  const carteraAcc = () => { try { const s = JSON.parse(localStorage.getItem('miCartera.v1') || '{}'); return (s.portfolio || []).filter((a) => a.kind === 'stock' && /^[A-Z0-9.]{1,10}$/.test(a.token)).map((a) => ({ s: a.token, n: String(a.name || a.token).replace(/&amp;/g, '&') })); } catch (e) { return []; } };
  function listaSeguimiento() {
    const mapa = new Map();
    carteraAcc().forEach((x) => mapa.set(x.s, { s: x.s, n: x.n, auto: true }));
    leeSeg().forEach((x) => { if (!mapa.has(x.s)) mapa.set(x.s, { s: x.s, n: String(x.n || x.s), auto: false }); });
    return [...mapa.values()];
  }
  function botonEstrella(simbolo, nombre) {
    const b = document.createElement('button'); b.type = 'button'; b.style.cssText = 'border:0;background:none;cursor:pointer;font-size:17px;line-height:1;margin-right:8px;color:var(--accent-yellow);padding:0';
    const auto = carteraAcc().some((x) => x.s === simbolo);
    const pon = () => { const sigue = auto || leeSeg().some((x) => x.s === simbolo); b.textContent = sigue ? '★' : '☆'; b.title = auto ? 'Está en tu cartera: se sigue sola' : sigue ? 'Dejar de seguir' : 'Seguir esta empresa'; };
    pon();
    b.addEventListener('click', (ev) => {
      ev.stopPropagation(); if (auto) return;
      const l = leeSeg(), i = l.findIndex((x) => x.s === simbolo);
      if (i >= 0) l.splice(i, 1); else l.push({ s: simbolo, n: nombre });
      guardaSeg(l); pon(); pintarSeguimiento();
    });
    return b;
  }
  let idxNombres = null;   // nombre normalizado de emisor -> {inversor: [peso, acciones, cambio]} (del 13F)
  function poseedoresDe(pos, nombre) {
    if (!idxNombres) { idxNombres = new Map(); Object.entries(pos.filas).forEach(([e, por]) => { const k = norm(e); if (k && !idxNombres.has(k)) idxNombres.set(k, por); }); }
    const k = norm(nombre); if (!k) return null;
    if (idxNombres.has(k)) return idxNombres.get(k);
    for (const [kk, v] of idxNombres) if (kk.startsWith(k + ' ') || k.startsWith(kk + ' ')) return v;
    return null;
  }
  function pintarSeguimiento() {
    const tb = document.getElementById('b13f-seguidas'); if (!tb) return;
    Promise.all([cargaPrecios(), cargaPos()]).then(([pr, pos]) => {
      const l = listaSeguimiento();
      const poner = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
      poner('k-seguimiento-resumen', l.length ? `${l.length} empresa${l.length === 1 ? '' : 's'}` : 'ninguna todavía');
      poner('b13f-sigues', 'Las acciones de tu cartera se siguen solas. Para seguir otra, pulsa la ☆ junto a su nombre en el Rastreo. Donde aparecen en las tablas de Mercado se marcan en turquesa.');
      if (!l.length) { const tr = document.createElement('tr'), td = el('td', 'Todavía no sigues ninguna empresa: busca una en el Rastreo y pulsa la ☆.', 'nm'); td.colSpan = 7; tr.append(td); tb.replaceChildren(tr); return; }
      tb.replaceChildren(...l.map((x) => {
        const p = pr[x.s], fu = fundAcc[x.s], usd = !!p && p.currency !== 'EUR', mon = p && p.currency === 'EUR' ? '€' : '$';
        const num = (txt, titulo) => { const c = el('td', txt == null ? '—' : txt, 'text-right'); if (titulo) c.title = titulo; return c; };
        const tr = document.createElement('tr'); tr.className = 'sigo';
        const emp = document.createElement('td');
        emp.append(x.auto ? el('span', '★', '') : botonEstrella(x.s, x.n)); if (x.auto) emp.firstChild.style.cssText = 'color:var(--accent-yellow);margin-right:8px';
        emp.append(el('span', x.n, 'tk')); const sg = el('span', x.s, 'section-badge'); sg.style.cssText = 'margin-left:8px;background:var(--bg-input);color:var(--text-secondary);'; emp.append(sg);
        if (x.auto) { const t = el('span', 'en tu cartera', 'section-badge'); t.style.cssText = 'margin-left:6px;background:var(--accent-green-bg);color:var(--accent-green);'; emp.append(t); }
        const rango = p && p.min_52s != null && p.max_52s > p.min_52s ? Math.round((p.price - p.min_52s) / (p.max_52s - p.min_52s) * 100) : null;
        const cv = document.createElement('td'); cv.className = 'text-right'; if (p) { if (p.change) cv.append(cambioChip(Math.round(p.change * 100) / 100)); else cv.textContent = '0 %'; } else cv.textContent = '—';
        tr.append(emp, num(p ? `${n2g(p.price)} ${mon}` : null, p ? '' : 'Sin dato: no está en la lista de precios automáticos'), cv, num(rango !== null ? rango + ' %' : null, 'Dónde está el precio entre el mínimo (0 %) y el máximo (100 %) de las últimas 52 semanas'),
          capDe(p, fu) ? num(capDe(p, fu).txt, capDe(p, fu).tip) : num(null), perDe(p, fu) ? num(n2g(perDe(p, fu).v), perDe(p, fu).tip) : num(null), chipsPoseedores(poseedoresDe(pos, x.n), pos.gestores));
        return tr;
      }));
    });
  }
  // Ficha de una empresa (se despliega bajo su fila del Rastreo): gráfico del último año con las medias de 10 y 40 semanas (≈ 50 y 200 días), rango de 52 semanas,
  // cifras y quién la tiene. La serie es semanal (data/tecnico.json); sin ella se avisa y se muestran solo las cifras.
  function fichaEmpresa(f, pr, tec, fu, gestores, columnas) {
    const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = columnas; tr.append(td);
    const caja = document.createElement('div');
    const ancho = (document.querySelector('#b13f-buscar .table-wrapper') || {}).clientWidth || 800;   // la tabla es más ancha que la pantalla: la ficha se queda en la parte visible
    caja.style.cssText = `display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;padding:14px 8px;align-items:start;position:sticky;left:0;box-sizing:border-box;white-space:normal;width:${Math.max(ancho - 28, 280)}px`;
    const izq = document.createElement('div'), der = document.createElement('div');
    const s = tec.serie;
    if (s && s.length >= 10 && typeof Chart !== 'undefined') {
      const lienzo = document.createElement('div'); lienzo.style.cssText = 'position:relative;height:240px'; const cv = document.createElement('canvas'); lienzo.append(cv); izq.append(lienzo);
      const media = (n) => s.map((_, i) => (i + 1 >= n ? s.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n : null));
      const css = getComputedStyle(document.body), c = (v, d) => css.getPropertyValue(v).trim() || d;
      tr._grafica = new Chart(cv.getContext('2d'), { type: 'line', data: { labels: s.map((_, i) => `hace ${s.length - 1 - i} sem.`), datasets: [
        { label: 'Precio', data: s, borderColor: c('--accent-blue', '#4c8dff'), borderWidth: 2, pointRadius: 0, tension: 0.15 },
        { label: 'Media 10 sem. (≈ 50 d)', data: media(10), borderColor: c('--accent-yellow', '#f0b90b'), borderWidth: 1.4, pointRadius: 0, tension: 0.15 },
        { label: 'Media 40 sem. (≈ 200 d)', data: media(40), borderColor: '#cd9eff', borderWidth: 1.4, pointRadius: 0, tension: 0.15 }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: c('--text-secondary', '#a0a8b8'), boxWidth: 12 } } },
          scales: { x: { display: false }, y: { ticks: { color: c('--text-secondary', '#a0a8b8') }, grid: { color: 'rgba(128,128,128,.15)' } } } } });
    } else izq.append(el('p', 'Sin gráfica: no hay datos de un año de esta empresa.', 'nm'));
    const kv = (k, v, t) => { const r = document.createElement('div'); r.style.cssText = 'display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--border)'; r.append(el('span', k, 'nm'), el('b', v == null ? '—' : v)); if (t) r.title = t; return r; };
    const mon = pr && pr.currency === 'EUR' ? '€' : '$', usd = !!pr && pr.currency !== 'EUR';
    der.append(el('div', f.nombre, ''), kv('Precio', pr ? `${n2g(pr.price)} ${mon}` : null),
      kv('Rango de 52 semanas', pr && pr.min_52s != null ? `${n2g(pr.min_52s)} – ${n2g(pr.max_52s)}` : null),
      kv('Media 50 d / 200 d', tec.sma50 != null ? `${n2g(tec.sma50)} / ${n2g(tec.sma200)}` : null), kv('RSI 14', tec.rsi14 != null ? String(Math.round(tec.rsi14)) : null),
      kv('Capitalización', capDe(pr, fu) ? capDe(pr, fu).txt : null), kv('PER', perDe(pr, fu) ? n2g(perDe(pr, fu).v) : null),
      kv('Ingresos', fu && fu.ingresos ? grandeMon(fu.ingresos, finMon(fu)) : null), kv('Beneficio', fu && fu.beneficio != null ? grandeMon(fu.beneficio, finMon(fu)) : null),
      kv('Margen neto', fu && fu.margen != null ? n2g(fu.margen * 100) + ' %' : null, 'Beneficio neto sobre ingresos'), kv('Dividendo', fu && fu.dividendo != null ? n2g(fu.dividendo * 100) + ' %' : null, 'Rentabilidad por dividendo anual'));
    der.firstChild.style.cssText = 'font-weight:700;font-size:16px;margin-bottom:6px';
    const poseedores = chipsPoseedores(f.por, gestores); poseedores.style.cssText += ';display:block;padding-top:10px;white-space:normal'; der.append(el('div', 'Quién la tiene', 'nm'), poseedores);
    caja.append(izq, der); td.append(caja);
    // noticias recientes (solo titular y enlace al medio); ocupan todo el ancho de la ficha
    if (f.simbolo) {
      const nt = document.createElement('div'); nt.style.cssText = 'grid-column:1/-1;border-top:1px solid var(--border);padding-top:10px;min-width:0';
      nt.append(el('div', 'Noticias recientes', 'nm')); caja.append(nt);
      cargaNoticias().then((todas) => {
        const l = todas[f.simbolo];
        if (!l || !l.length) { nt.append(el('p', 'Sin noticias recientes en la última actualización.', 'nm')); return; }
        l.forEach(([titulo, url, fuente, fecha, idioma]) => {
          const fila = document.createElement('div'); fila.style.cssText = 'padding:5px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:baseline';
          const a = el('a', titulo, ''); if (/^https:\/\//.test(url)) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
          a.style.cssText = 'color:var(--text-primary);text-decoration:none;font-weight:600;max-width:100%;min-width:0;overflow-wrap:anywhere';
          fila.append(a, el('span', `${fuente || 'medio'} · ${new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`, 'nm')); if (idioma === 'en') { const en = el('span', 'inglés', 'chip'); en.title = 'Titular en inglés'; fila.append(en); } nt.append(fila);
        });
      });
    }
    return tr;
  }
  function buscador(d) {
    const caja = document.getElementById('b13f-buscar');
    const sec = document.createElement('details'); sec.className = 'card mk-desplegable'; sec.open = true; sec.style.cssText = 'margin-top:12px;padding:12px 16px';
    const h = document.createElement('summary'); h.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    const nombre = el('span', 'Rastreo', ''); nombre.style.cssText = 'font-weight:700;font-size:15px;color:var(--text-primary)';
    const resumen = el('span', 'cualquier empresa · quién la tiene de tus inversores', ''); resumen.style.cssText = 'margin-left:auto;color:var(--text-muted);font-size:12px';
    const flecha = document.createElement('span'); flecha.innerHTML = '<svg class="strat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    h.append(nombre, resumen, flecha);
    const campo = document.createElement('div'); campo.className = 'add-field'; campo.style.marginTop = '12px';
    const entrada = document.createElement('input'); entrada.type = 'text'; entrada.placeholder = 'Busca una empresa: Amazon, Vistra, Chevron, AAPL…'; entrada.autocomplete = 'off'; campo.append(entrada);
    const res = el('div', '', 'table-wrapper'); res.style.marginTop = '12px';
    const cambio = cambioChip;
    // 13F: emisor → {clave: [peso, acciones, cambio]}; índice por nombre normalizado para unir con los resultados de la búsqueda por símbolo
    const porNorm = new Map(); Object.entries(d.filas).forEach(([e, por]) => { const k = norm(e); if (k && !porNorm.has(k)) porNorm.set(k, [e, por]); });
    const dePorNombre = (nombreEmpresa) => { const k = norm(nombreEmpresa); if (!k) return null; if (porNorm.has(k)) return porNorm.get(k); for (const [kk, v] of porNorm) if (kk.startsWith(k + ' ') || k.startsWith(kk + ' ')) return v; return null; };
    let remotos = [], ultima = '';
    function pintarRes() {
      const q = entrada.value.trim().toUpperCase();
      if (q.length < 2) { res.replaceChildren(); return; }
      const filas = [], usados = new Set();
      remotos.forEach((r) => { const m = dePorNombre(r.name); if (m) usados.add(m[0]); filas.push({ nombre: r.name, simbolo: r.symbol, por: m ? m[1] : null }); });
      Object.entries(d.filas).filter(([e]) => e.includes(q) && !usados.has(e))
        .sort((x, y) => Object.values(y[1]).reduce((s, v) => s + v[0], 0) - Object.values(x[1]).reduce((s, v) => s + v[0], 0))
        .slice(0, 25).forEach(([e, por]) => filas.push({ nombre: e, simbolo: tickerDeEmisor[e] || null, por }));
      if (!filas.length) { res.replaceChildren(el('p', 'No encuentro ninguna empresa con ese nombre.', 'reparto-hint')); return; }
      res.querySelectorAll('canvas').forEach((cv) => { const g = typeof Chart !== 'undefined' && Chart.getChart(cv); if (g) g.destroy(); });
      const t = document.createElement('table'); t.innerHTML = '<thead><tr><th title="">Empresa</th><th class="text-right" title="Último precio conocido">Precio</th><th class="text-right" title="Cambio del precio frente al cierre anterior">Variación</th><th class="text-right" title="Precio más bajo de hoy">Mín. día</th><th class="text-right" title="Precio más alto de hoy">Máx. día</th><th class="text-right" title="Precio más bajo de las últimas 52 semanas">Mín. 52 sem.</th><th class="text-right" title="Precio más alto de las últimas 52 semanas">Máx. 52 sem.</th><th class="text-right" title="Dónde está el precio entre el mínimo (0 %) y el máximo (100 %) de las últimas 52 semanas. 99 % = casi en máximos del año; 5 % = casi en mínimos">En el rango anual</th><th class="text-right" title="Media del precio de cierre de los últimos 50 días de mercado">Media 50 d</th><th class="text-right" title="Media del precio de cierre de los últimos 200 días de mercado">Media 200 d</th><th class="text-right" title="RSI de 14 días (0-100). Por encima de 70 suele leerse como una subida muy rápida (sobrecompra) y por debajo de 30 como una bajada muy rápida (sobreventa). Es un indicador técnico, no una recomendación">RSI 14</th><th title="Alcista: el precio está por encima de la media de 50 días y esta por encima de la de 200. Bajista: al revés. Mixta: cualquier otro caso. Es una lectura técnica, no una recomendación">Tendencia</th><th title="Evolución del precio en el último año (un punto por semana)">Último año</th><th class="text-right" title="Acciones negociadas hoy">Volumen</th><th class="text-right" title="Valor de toda la empresa en bolsa: acciones en circulación × precio de hoy">Capitalización</th><th class="text-right" title="Precio / beneficio por acción del último ejercicio. Cuántos años de beneficio se pagan">PER</th><th class="text-right" title="Beneficio por acción del último ejercicio fiscal">BPA</th><th class="text-right" title="Ventas del último ejercicio fiscal">Ingresos</th><th class="text-right" title="Beneficio neto del último ejercicio fiscal">Beneficio</th><th title="Cuáles de tus tres inversores la tienen (o la vendieron entera) en su último 13F">Poseedores</th></tr></thead>';
      const tb = document.createElement('tbody');
      filas.slice(0, 30).forEach((f) => {
        const tr = document.createElement('tr'); if (sigo(f.nombre)) tr.className = 'sigo';
        const emp = document.createElement('td'); emp.append(el('span', f.nombre, 'tk')); if (f.simbolo) { const s = el('span', f.simbolo, 'section-badge'); s.style.cssText = 'margin-left:8px;background:var(--bg-input);color:var(--text-secondary);'; emp.append(s); }
        if (f.simbolo) emp.prepend(botonEstrella(f.simbolo, f.nombre));   // ☆ seguir / ★ ya la sigues
        const pr = f.simbolo && preciosAcc && preciosAcc[f.simbolo], fu = (f.simbolo && fundAcc[f.simbolo]) || null, tec = (f.simbolo && tecAcc[f.simbolo]) || {};
        const n2 = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 }), usd = pr && pr.currency !== 'EUR';
        const mon = pr && pr.currency === 'EUR' ? '€' : '$';
        const celda = (txt, titulo) => { const c = el('td', txt == null ? '—' : txt, 'text-right'); if (titulo) c.title = titulo; return c; };
        const grande = (v) => (v >= 1e9 ? n2(v / 1e9) + ' mil M$' : v >= 1e6 ? n2(v / 1e6) + ' M$' : n2(v) + ' $');   // 'mil M' = miles de millones, como en el resto de Mercado
        const sinDato = pr || !f.simbolo ? '' : 'Sin dato: este valor no está en la lista de precios automáticos (data/acciones.json)';
        const vacio = (titulo) => celda(null, titulo || sinDato);
        const ejercicio = fu && fu.ejercicio_fin ? `Ejercicio fiscal cerrado el ${dia(fu.ejercicio_fin)} (informe 10-K a la SEC)` : '';
        const sinFund = pr && !fu ? 'Sin dato: Yahoo no da fundamentales de este valor (fondos y ETF no los tienen)' : sinDato;
        const rango = pr && pr.min_52s != null && pr.max_52s > pr.min_52s ? Math.round((pr.price - pr.min_52s) / (pr.max_52s - pr.min_52s) * 100) : null;
        const cp = capDe(pr, fu), pe = perDe(pr, fu);
        const capi = cp ? celda(cp.txt, cp.tip) : vacio(sinFund);
        const per = pe ? celda(n2(pe.v), pe.tip) : fu && fu.bpa != null && fu.bpa <= 0 ? celda('n/a', 'Beneficio por acción negativo: no hay PER') : vacio(sinFund);
        tr.append(emp, pr ? celda(`${n2(pr.price)} ${mon}`) : vacio(),
          pr ? (() => { const c = document.createElement('td'); c.className = 'text-right'; if (pr.change) c.append(cambio(Math.round(pr.change * 100) / 100)); else c.textContent = '0 %'; return c; })() : vacio(),
          pr && pr.dia_min != null ? celda(n2(pr.dia_min)) : vacio(), pr && pr.dia_max != null ? celda(n2(pr.dia_max)) : vacio(),
          pr && pr.min_52s != null ? celda(n2(pr.min_52s)) : vacio(), pr && pr.max_52s != null ? celda(n2(pr.max_52s)) : vacio(),
          rango !== null ? celda(rango + ' %', rango >= 90 ? 'Cerca del máximo del año' : rango <= 10 ? 'Cerca del mínimo del año' : 'A mitad del rango del año') : vacio(),
          tec.sma50 != null && pr ? celda(n2(tec.sma50), pr.price > tec.sma50 ? 'El precio está por encima de su media de 50 días' : 'El precio está por debajo de su media de 50 días') : vacio(),
          tec.sma200 != null && pr ? celda(n2(tec.sma200), pr.price > tec.sma200 ? 'El precio está por encima de su media de 200 días' : 'El precio está por debajo de su media de 200 días') : vacio(),
          rsiCelda(pr, f.simbolo), tendenciaCelda(pr, f.simbolo), serieCelda(pr, f.simbolo),
          pr && pr.volumen ? celda(pr.volumen >= 1e6 ? n2(pr.volumen / 1e6) + ' M' : pr.volumen.toLocaleString('es-ES')) : vacio(), capi, per,
          fu && fu.bpa != null ? celda(n2(fu.bpa) + ' ' + simMon(fu.moneda || (pr && pr.currency)), fu.fuente === 'Yahoo' ? 'Beneficio por acción de los últimos 12 meses (Yahoo Finance)' : ejercicio) : vacio(sinFund),
          fu && fu.ingresos ? celda(grandeMon(fu.ingresos, finMon(fu)), fu.fuente === 'Yahoo' ? 'Ingresos de los últimos 12 meses (Yahoo Finance)' : ejercicio) : vacio(sinFund),
          fu && fu.beneficio != null ? celda(grandeMon(fu.beneficio, finMon(fu)), fu.fuente === 'Yahoo' ? 'Beneficio neto de los últimos 12 meses (Yahoo Finance)' : ejercicio) : vacio(sinFund));
        const quien = chipsPoseedores(f.por, d.gestores);
        tr.append(quien); tb.append(tr);
        const nombreEl = emp.querySelector('.tk'); nombreEl.style.cursor = 'pointer'; nombreEl.title = 'Ver la ficha y el gráfico';
        let abierta = null;
        nombreEl.addEventListener('click', () => {   // pulsar el nombre despliega (o pliega) su ficha debajo de la fila
          if (abierta) { if (abierta._grafica) abierta._grafica.destroy(); abierta.remove(); abierta = null; return; }
          abierta = fichaEmpresa(f, pr, tec, fu, d.gestores, t.querySelectorAll('thead th').length); tr.after(abierta);
        });
      });
      t.append(tb); res.replaceChildren(t);
    }
    let espera = null;
    entrada.addEventListener('input', () => {
      remotos = [];   // los resultados de la búsqueda anterior no valen para lo nuevo que se escribe
      pintarRes();
      clearTimeout(espera); const q = entrada.value.trim();
      if (q.length < 2) { remotos = []; return; }
      espera = setTimeout(() => {   // búsqueda por nombre o símbolo (Twelve Data, solo EE. UU. y símbolos que empiezan por letra); si falla, quedan los resultados del 13F
        ultima = q;
        Promise.all([fetch(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=30`).then((r) => r.json()), cargaPrecios()])
          .then(([r]) => { if (ultima !== q) return; const vistos = new Set();
            remotos = (r.data || []).filter((x) => x.country === 'United States' && /^[A-Z][A-Z0-9.]{0,9}$/.test(x.symbol) && !/\.(PR|W|WS|U|R)(\.|$)/.test(x.symbol) && !vistos.has(x.symbol) && vistos.add(x.symbol)).slice(0, 6).map((x) => ({ symbol: x.symbol, name: x.instrument_name })); pintarRes(); })
          .catch(() => {});
      }, 400);
    });
    cargaPrecios().then(pintarRes);
    sec.append(h, campo, res); caja.replaceChildren(sec);
  }
  function pintarPersonas(d) { document.getElementById('b13f-insiders').replaceChildren(...d.personas.map(seccionPersona)); }
  const MOVIMIENTOS = [   // [simbolo, singular, plural, clase del chip, test sobre cambio_acciones_pct]
    ['★', 'nueva', 'nuevas', 'new', (c) => c === 'nueva'], ['▲', 'sube', 'suben', 'up', (c) => c > 0], ['▼', 'baja', 'bajan', 'dn', (c) => c !== 'nueva' && c < 0],
  ];
  function filaCoinciden(f) {
    const gestor = (clave) => indice.find((g) => g.clave === clave);
    const quien = el('div', '', 'who');
    f.gestores.forEach((g) => { const i = el('span', gestor(g.clave).corto, 'token-icon'); i.title = gestor(g.clave).nombre + ' · ' + pct(g.peso_pct); quien.append(i); });
    const mayor = f.gestores.reduce((a, b) => (b.peso_pct > a.peso_pct ? b : a));
    const mov = el('td', '');
    MOVIMIENTOS.forEach(([simbolo, uno, varios, cls, test]) => {
      const n = f.gestores.filter((g) => test(g.cambio_acciones_pct)).length;
      if (n) mov.append(el('span', `${simbolo} ${n} ${n === 1 ? uno : varios}`, 'chip ' + cls), ' ');
    });
    if (!mov.hasChildNodes()) mov.textContent = 'Sin cambios';
    const celdaQuien = el('td', ''); celdaQuien.append(quien);
    const tr = document.createElement('tr');
    if (sigo(f.emisor)) tr.className = 'sigo';
    tr.append(el('td', f.emisor, 'tk'), celdaQuien, el('td', f.gestores.length, 'text-right'), el('td', `${pct(mayor.peso_pct)} (${gestor(mayor.clave).corto})`, 'text-right'), mov);
    return tr;
  }
  function filaSeguida(s) {
    if (s.gestores.length) { const tr = filaCoinciden({ emisor: s.nombre, gestores: s.gestores }); tr.className = 'sigo'; return tr; }
    const tr = document.createElement('tr'); tr.className = 'sigo';
    const sin = el('td', 'Ningún inversor de la lista la tiene entre sus posiciones', 'nm'); sin.colSpan = 4;
    tr.append(el('td', s.nombre, 'tk'), sin);
    return tr;
  }
  // Leyenda de las tablas de coincidencias: un chip por inversor (sigla + nombre) y otro por cada movimiento, en una fila que se reparte (flex) y baja de línea.
  function pintaLeyenda(id) {
    const caja = document.getElementById(id); if (!caja) return;
    caja.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';
    const chip = (cls, ...partes) => { const c = document.createElement('span'); c.className = 'chip' + (cls ? ' ' + cls : ''); c.append(...partes); return c; };
    const grupo = (...hijos) => { const g = document.createElement('div'); g.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center'; g.append(...hijos); return g; };
    caja.replaceChildren(
      grupo(...indice.map((g) => chip('', el('b', g.corto), ' ' + g.nombre))),
      grupo(el('span', 'En movimientos:', 'nm'), chip('up', '▲ aumenta su posición'), chip('dn', '▼ la reduce'), chip('new', '★ compra nueva'), el('span', 'el número es cuántos de ellos', 'nm')));
  }
  function pintarCoinciden() {
    if (!coin) return;
    const poner = (id, txt) => { document.getElementById(id).textContent = txt; };
    const [anio, mes] = coin.periodo.split('-');
    poner('k-gestores', coin.gestores_seguidos); poner('k-periodo', 'T' + Math.ceil(+mes / 3) + ' ' + anio);
    poner('k-2mas', coin.en_2_o_mas); poner('k-todas', coin.en_todas);
    document.getElementById('b13f-coinciden').replaceChildren(...coin.filas.map(filaCoinciden));
    poner('k-coinciden-resumen', `${coin.en_2_o_mas} empresas en 2 o más carteras`);
    if (indice) ['b13f-leyenda', 'b13f-leyenda2'].forEach(pintaLeyenda);
    pintarSeguimiento();
  }
  document.getElementById('mk-btn').addEventListener('click', () => {
    if (view.hidden || datos) return;
    const json = (url) => fetch(url).then((r) => r.json());
    json('data/13f_indice.json')
      .then((ix) => { indice = ix; return Promise.all([json('data/13f_coinciden.json'), ...ix.map((g) => json('data/13f_' + encodeURIComponent(g.clave) + '.json'))]); })
      .then(([c, ...ds]) => { coin = c; datos = ds; pintar(); pintarCoinciden(); })
      .catch(() => { cont.textContent = 'No se pudieron cargar los datos de los gestores.'; });
    cargaPos().then(buscador).catch(() => {});   // aparte: si falta, la pestaña sigue igual
    json('data/insiders.json').then(pintarPersonas).catch(() => {});   // aparte: si falta, la pestaña sigue igual
  });
  fx.onChange(pintar);
})();

/* Crypto: datos de DefiLlama y CoinGecko (los genera scripts/update_crypto.py). Se cargan al abrir la pestaña Crypto por primera vez. */
(function () {
  const fx = window.mkFx;
  let datos = null;
  const $ = (id) => document.getElementById(id);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; };
  const celda = (x, cls) => { const t = el('td', '', cls); t.append(x); return t; };
  const num = (txt) => celda(txt, 'text-right');
  const fila = (...celdas) => { const t = document.createElement('tr'); t.append(...celdas); return t; };
  const n1 = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const compacto = (usd) => {   // 92,1 mil M$ · 6,2 M$ · 48.469 $ (en la moneda elegida)
    const v = fx.toCur(usd), m = fx.cur() === 'EUR' ? '€' : '$';
    return v >= 1e9 ? `${n1(v / 1e9)} mil M${m}` : v >= 1e6 ? `${n1(v / 1e6)} M${m}` : `${Math.round(v).toLocaleString('es-ES')} ${m}`;
  };
  const pct = (v) => n1(v) + ' %';
  const pct2 = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' %';   // el % de suministro es pequeño: 0,21 % no es 0,2 %
  const chip = (v) => el('span', (v > 0 ? '▲ +' : '▼ ') + pct(v), 'chip ' + (v > 0 ? 'up' : 'dn'));
  const opcional = (v, f) => (v === null || v === undefined ? num('sin datos') : num(f(v)));
  const CABECERA = '<thead><tr><th>Empresa</th><th class="text-right">Cantidad</th><th class="text-right">% suministro</th><th class="text-right">Coste de compra</th><th class="text-right">Valor hoy</th></tr></thead>';

  function tenedores(t, simbolo, nombre) {
    const kpi = (etiqueta, valor) => { const c = el('div', '', 'card'); c.append(el('div', etiqueta, 'card-label'), el('div', valor, 'card-value')); return c; };
    const kpis = el('div', '', 'kpis'); kpis.style.marginBottom = '12px';
    kpis.append(kpi(`${simbolo} en empresas cotizadas`, `${Math.round(t.total).toLocaleString('es-ES')} ${simbolo}`), kpi('Valor', compacto(t.valor_usd)), kpi('% del suministro', pct2(t.pct_suministro)), kpi('Empresas', t.n_empresas));
    const tbody = document.createElement('tbody');
    t.top.forEach((c) => {
      const empresa = celda(''); empresa.append(el('span', c.simbolo, 'tk'), el('div', `${c.nombre} (${c.pais})`, 'nm'));
      const valor = num(compacto(c.valor_usd));
      if (c.coste_usd) valor.append(' ', chip(Math.round((c.valor_usd / c.coste_usd - 1) * 100)));
      tbody.append(fila(empresa, num(Math.round(c.cantidad).toLocaleString('es-ES')), num(pct2(c.pct_suministro)), c.coste_usd ? num(compacto(c.coste_usd)) : num('—'), valor));
    });
    const tabla = document.createElement('table'); tabla.innerHTML = CABECERA; tabla.append(tbody);
    const wrap = el('div', '', 'table-wrapper'); wrap.append(tabla);
    return [el('h2', `${nombre} en empresas cotizadas`, 'section-title'), kpis, wrap];
  }

  function pintar() {
    if (!datos) return;
    const { tvl_total: tvl, stablecoins: st } = datos;
    $('c-tvl').textContent = tvl ? compacto(tvl.usd) : 'sin datos';
    $('c-tvl-sub').textContent = tvl ? `${tvl.cambio_7d_pct > 0 ? '+' : ''}${pct(tvl.cambio_7d_pct)} en 7 días` : '';
    $('c-stable').textContent = st ? compacto(st.usd) : 'sin datos';
    $('c-flujo').textContent = st ? (st.flujo_7d_usd >= 0 ? '+' : '−') + compacto(Math.abs(st.flujo_7d_usd)) : 'sin datos';
    $('c-flujo').style.color = st ? (st.flujo_7d_usd >= 0 ? 'var(--accent-green)' : 'var(--accent-red)') : '';
    $('c-fecha').textContent = new Date(datos.actualizado).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    $('c-monedas').replaceChildren(...datos.monedas.map((m) => {
      const moneda = celda(''); moneda.append(el('span', m.simbolo, 'tk'), el('div', m.nombre, 'nm'));
      const cambio = m.comisiones_cambio_7d_pct === null ? num('sin datos') : celda(chip(m.comisiones_cambio_7d_pct), 'text-right');
      return fila(moneda, opcional(m.tvl_usd, compacto), opcional(m.comisiones_30d_usd, compacto), cambio, opcional(m.ingresos_30d_usd, compacto));
    }));
    $('c-tenedores').replaceChildren(...[['bitcoin', 'BTC', 'Bitcoin'], ['ethereum', 'ETH', 'Ether']].flatMap(([k, simbolo, nombre]) =>
      datos.tenedores[k] ? tenedores(datos.tenedores[k], simbolo, nombre) : [el('p', `${nombre}: sin datos`, 'reparto-hint')]));
  }
  $('mkb2').addEventListener('click', () => {
    if (datos) return;
    fetch('data/crypto.json').then((r) => r.json()).then((d) => { datos = d; pintar(); })
      .catch(() => { $('c-tenedores').textContent = 'No se pudieron cargar los datos de crypto.'; });
  });
  fx.onChange(pintar);
})();

/* Centro de operaciones: vista aparte que se abre con su botón de la cabecera, igual que Mercado. Solo una vista abierta a la vez. */
(function () {
  const btn = document.getElementById('op-btn'), vista = document.getElementById('operaciones'), mk = document.getElementById('mercado');
  const cartera = document.querySelector('main.container:not(#mercado):not(#operaciones)');
  const mkBtn = document.getElementById('mk-btn');
  const svg = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const g = (d, w) => `<span class="currency-switch__glyph">${svg(d)}</span><span class="currency-switch__code">${w}</span>`;
  const ICONO = '<path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="9"/>';
  function mostrar(on) {
    if (on && !mk.hidden) mkBtn.click();   // cierra Mercado (su botón alterna) antes de abrir esta vista
    cartera.style.display = on ? 'none' : '';
    vista.hidden = !on;
    btn.classList.toggle('active', on);
    btn.innerHTML = on ? g('<path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 000 4h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7"/><circle cx="17" cy="14" r="1"/>', 'Cartera') : g(ICONO, 'Operaciones');
    btn.title = on ? 'Volver a mi cartera' : 'Centro de operaciones: aportación, ratio, proyección y plantillas';
    window.scrollTo(0, 0);
  }
  btn.addEventListener('click', () => mostrar(vista.hidden));
  // Si se abre Mercado con esta vista abierta, esta se cierra (Mercado ya oculta la cartera).
  mkBtn.addEventListener('click', () => { if (!vista.hidden) { vista.hidden = true; btn.classList.remove('active'); btn.innerHTML = g(ICONO, 'Operaciones'); btn.title = 'Centro de operaciones: aportación, ratio, proyección y plantillas'; } }, true);
})();

/* Selector de vista Cartera | Operaciones | Mercado: acciona los botones de la cabecera (que siguen ahí, ocultos) y se mantiene en sincronía. */
(function () {
  const seg = document.getElementById('seg-vista'), mk = document.getElementById('mercado'), op = document.getElementById('operaciones');
  const mkBtn = document.getElementById('mk-btn'), opBtn = document.getElementById('op-btn');
  const actual = () => (!mk.hidden ? 'mercado' : !op.hidden ? 'operaciones' : 'cartera');
  const sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.g === actual()));
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.dataset.g === actual()) return;
    const quiere = b.dataset.g;
    if (quiere === 'operaciones') opBtn.click();                        // abre Operaciones (cierra Mercado si estaba abierto)
    else if (quiere === 'mercado') mkBtn.click();                       // abre Mercado (cierra Operaciones si estaba abierta)
    else (!mk.hidden ? mkBtn : opBtn).click();                          // Cartera: cierra la vista que esté abierta
    sync();
  });
})();

/* Volver desde otra página (p. ej. la lista completa de un inversor, gestor.html) con index.html#mercado: abre directamente la vista Mercado. */
(function () {
  const abre = () => { if (location.hash !== '#mercado') return; const seg = document.querySelector('#seg-vista [data-g="mercado"]'); if (seg && !seg.classList.contains('on')) seg.click(); };
  abre(); window.addEventListener('hashchange', abre);
})();
