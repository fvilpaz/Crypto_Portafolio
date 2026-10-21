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
  const el = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; };
  const billones = (usd) => (fx.toCur(usd) / 1e9).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' mil M' + (fx.cur() === 'EUR' ? '€' : '$');
  const dia = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  function seccion(d) {
    const sec = document.createElement('section');
    const badge = el('span', '13F · SEC', 'section-badge');
    badge.style.cssText = 'background:var(--accent-green-bg);color:var(--accent-green);';
    const h = el('h2', d.gestor + ' · datos reales ', 'section-title'); h.append(badge);
    const hint = el('p', `Presentado el ${dia(d.presentado)} · cierre de ${dia(d.periodo)} · ${d.n_emisores} empresas · total ${billones(d.total_usd)} · fuente: ${d.fuente}. Es lo que tenían a esa fecha, no lo que tienen hoy.`, 'reparto-hint');
    const tbody = document.createElement('tbody');
    d.top.forEach((t) => {
      const c = t.cambio_acciones_pct, tr = document.createElement('tr'), cambio = document.createElement('td');
      if (c === 'nueva') cambio.append(el('span', '★ Compra nueva', 'chip new'));
      else if (c === 0) cambio.textContent = 'Sin cambios';
      else cambio.append(el('span', (c > 0 ? '▲ +' : '▼ ') + c.toLocaleString('es-ES') + ' % acciones', 'chip ' + (c > 0 ? 'up' : 'dn')));
      const num = (txt) => el('td', txt, 'text-right');
      tr.append(el('td', t.emisor, 'tk'), num(billones(t.valor_usd)), num(t.peso_pct.toLocaleString('es-ES') + ' %'), num(t.acciones.toLocaleString('es-ES')), cambio);
      tbody.append(tr);
    });
    const tabla = document.createElement('table');
    tabla.innerHTML = '<thead><tr><th>Empresa</th><th class="text-right">Valor</th><th class="text-right">Peso</th><th class="text-right">Acciones</th><th>Cambio frente al trimestre anterior</th></tr></thead>';
    tabla.append(tbody);
    const wrap = el('div', '', 'table-wrapper'); wrap.append(tabla);
    sec.append(h, hint, wrap);
    return sec;
  }
  function pintar() { if (datos) cont.replaceChildren(...datos.map(seccion)); }
  const pct = (n) => n.toLocaleString('es-ES') + ' %';
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
    tr.append(el('td', f.emisor, 'tk'), celdaQuien, el('td', f.gestores.length, 'text-right'), el('td', `${pct(mayor.peso_pct)} (${gestor(mayor.clave).corto})`, 'text-right'), mov);
    return tr;
  }
  function pintarCoinciden() {
    if (!coin) return;
    const poner = (id, txt) => { document.getElementById(id).textContent = txt; };
    const [anio, mes] = coin.periodo.split('-');
    poner('k-gestores', coin.gestores_seguidos); poner('k-periodo', 'T' + Math.ceil(+mes / 3) + ' ' + anio);
    poner('k-2mas', coin.en_2_o_mas); poner('k-todas', coin.en_todas);
    document.getElementById('b13f-coinciden').replaceChildren(...coin.filas.map(filaCoinciden));
  }
  document.getElementById('mk-btn').addEventListener('click', () => {
    if (view.hidden || datos) return;
    const json = (url) => fetch(url).then((r) => r.json());
    json('data/13f_indice.json')
      .then((ix) => { indice = ix; return Promise.all([json('data/13f_coinciden.json'), ...ix.map((g) => json('data/13f_' + encodeURIComponent(g.clave) + '.json'))]); })
      .then(([c, ...ds]) => { coin = c; datos = ds; pintar(); pintarCoinciden(); })
      .catch(() => { cont.textContent = 'No se pudieron cargar los datos de los gestores.'; });
  });
  fx.onChange(pintar);
})();
