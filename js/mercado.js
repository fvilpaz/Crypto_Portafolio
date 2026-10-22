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
  const sigo = (emisor) => !!coin && coin.seguidas.some((s) => emisor.toUpperCase().includes(s.patron));
  const el = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; };
  const billones = (usd) => (fx.toCur(usd) / 1e9).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' mil M' + (fx.cur() === 'EUR' ? '€' : '$');
  const dia = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  // Todas las posiciones de cada inversor (data/13f_posiciones.json): las usan el buscador y el botón "Ver la lista completa" de cada tabla.
  let posAll = null;
  const cargaPos = () => (posAll ? Promise.resolve(posAll) : fetch('data/13f_posiciones.json').then((r) => r.json()).then((x) => { posAll = x; return x; }));
  function listaCompleta(d, clave, hueco, boton) {
    if (hueco.hasChildNodes()) { hueco.replaceChildren(); boton.textContent = `Ver la lista completa (${d.n_emisores} empresas)`; return; }
    boton.textContent = 'Cargando…';
    cargaPos().then((x) => {
      const filas = Object.entries(x.filas).filter(([, por]) => por[clave]).sort((p, q) => q[1][clave][0] - p[1][clave][0]);
      const tbody = document.createElement('tbody');
      filas.forEach(([emisor, por]) => {
        const f = por[clave], c = f[2], tr = document.createElement('tr'), cel = document.createElement('td');
        if (sigo(emisor)) tr.className = 'sigo';
        if (c === 'nueva') cel.append(el('span', '★ Compra nueva', 'chip new'));
        else if (c === 0) cel.textContent = 'Sin cambios';
        else cel.append(el('span', (c > 0 ? '▲ +' : '▼ ') + c.toLocaleString('es-ES') + ' % acciones', 'chip ' + (c > 0 ? 'up' : 'dn')));
        const num = (txt) => el('td', txt, 'text-right');
        tr.append(el('td', emisor, 'tk'), num(billones(d.total_usd * f[0] / 100)), num(f[0].toLocaleString('es-ES') + ' %'), num(f[1].toLocaleString('es-ES')), cel);
        tbody.append(tr);
      });
      const tabla = document.createElement('table');
      tabla.innerHTML = '<thead><tr><th>Empresa en la que invierte</th><th class="text-right">Valor invertido</th><th class="text-right">% de su cartera</th><th class="text-right">Nº de acciones</th><th>Cambio frente al trimestre anterior</th></tr></thead>';
      tabla.append(tbody);
      const wrap = el('div', '', 'table-wrapper'); wrap.style.cssText = 'margin-top:12px;max-height:520px;overflow:auto'; wrap.append(tabla);
      hueco.replaceChildren(wrap);
      boton.textContent = 'Ocultar la lista completa';
    }).catch(() => { boton.textContent = 'No se pudo cargar la lista'; });
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
    h.append(nombre, badge, resumen, flecha);
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
    sec.append(h, hint, wrap);
    if (d.n_emisores > d.top.length) {   // más empresas que las 10 mayores: botón para ver todas (y enlace al informe original)
      const pie = document.createElement('div'); pie.style.cssText = 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:12px';
      const boton = el('button', `Ver la lista completa (${d.n_emisores} empresas)`, 'add-submit'); boton.type = 'button';
      const hueco = document.createElement('div');
      boton.addEventListener('click', () => listaCompleta(d, clave, hueco, boton));
      const enlace = el('a', 'Informe original en la SEC', ''); enlace.href = `https://www.sec.gov/Archives/edgar/data/${parseInt(d.cik, 10)}/${d.accesion.replace(/-/g, '')}/`; enlace.target = '_blank'; enlace.rel = 'noopener';
      enlace.style.cssText = 'font-size:12px;color:var(--text-muted)';
      pie.append(boton, enlace); sec.append(pie, hueco);
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
  // Buscador "¿Quién tiene esta empresa?": sobre TODAS las posiciones de cada inversor (no solo las 10 mayores). Lo genera scripts/update_13f.py.
  function buscador(d) {
    const caja = document.getElementById('b13f-buscar');
    const sec = document.createElement('details'); sec.className = 'card mk-desplegable'; sec.open = true; sec.style.cssText = 'margin-top:12px;padding:12px 16px';
    const h = document.createElement('summary'); h.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    const nombre = el('span', '¿Quién tiene esta empresa?', ''); nombre.style.cssText = 'font-weight:700;font-size:15px;color:var(--text-primary)';
    const n = Object.keys(d.filas).length;
    const resumen = el('span', `${n.toLocaleString('es-ES')} empresas · ${d.gestores.length} inversores`, ''); resumen.style.cssText = 'margin-left:auto;color:var(--text-muted);font-size:12px';
    const flecha = document.createElement('span'); flecha.innerHTML = '<svg class="strat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    h.append(nombre, resumen, flecha);
    const campo = document.createElement('div'); campo.className = 'add-field'; campo.style.marginTop = '12px';
    const entrada = document.createElement('input'); entrada.type = 'text'; entrada.placeholder = 'Empresa, p. ej. Vistra, Apple, Chevron'; entrada.autocomplete = 'off'; campo.append(entrada);
    const nota = el('p', `Busca entre todas las posiciones de sus 13F, no solo las 10 mayores. Peso = % de la cartera de cada inversor; el cambio es en nº de acciones frente al trimestre anterior. Informes con cierre el ${dia(d.periodo)}.`, 'reparto-hint');
    const res = el('div', '', 'table-wrapper'); res.style.marginTop = '12px';
    const cambio = (c) => c === 'nueva' ? el('span', '★ nueva', 'chip new') : c === 0 ? el('span', '=', 'chip') : el('span', (c > 0 ? '▲ +' : '▼ ') + c.toLocaleString('es-ES') + ' %', 'chip ' + (c > 0 ? 'up' : 'dn'));
    function pintarRes() {
      const q = entrada.value.trim().toUpperCase();
      if (q.length < 2) { res.replaceChildren(el('p', 'Escribe al menos 2 letras.', 'reparto-hint')); return; }
      const hallados = Object.entries(d.filas).filter(([e]) => e.includes(q))
        .sort((x, y) => Object.values(y[1]).reduce((s, v) => s + v[0], 0) - Object.values(x[1]).reduce((s, v) => s + v[0], 0)).slice(0, 25);
      if (!hallados.length) { res.replaceChildren(el('p', 'Ningún inversor de la lista tiene una empresa con ese nombre.', 'reparto-hint')); return; }
      const t = document.createElement('table');
      t.innerHTML = `<thead><tr><th>Empresa</th>${d.gestores.map((g) => `<th>${g.nombre}</th>`).join('')}</tr></thead>`;
      const tb = document.createElement('tbody');
      hallados.forEach(([emisor, por]) => {
        const tr = document.createElement('tr'); if (sigo(emisor)) tr.className = 'sigo';
        tr.append(el('td', emisor, 'tk'));
        d.gestores.forEach((g) => {
          const f = por[g.clave], td = document.createElement('td');
          if (f) td.append(`${f[0].toLocaleString('es-ES')} % · ${f[1].toLocaleString('es-ES')} acc. `, cambio(f[2])); else td.textContent = '—';
          tr.append(td);
        });
        tb.append(tr);
      });
      t.append(tb); res.replaceChildren(t);
    }
    entrada.addEventListener('input', pintarRes); pintarRes();
    sec.append(h, campo, nota, res); caja.replaceChildren(sec);
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
  function pintarCoinciden() {
    if (!coin) return;
    const poner = (id, txt) => { document.getElementById(id).textContent = txt; };
    const [anio, mes] = coin.periodo.split('-');
    poner('k-gestores', coin.gestores_seguidos); poner('k-periodo', 'T' + Math.ceil(+mes / 3) + ' ' + anio);
    poner('k-2mas', coin.en_2_o_mas); poner('k-todas', coin.en_todas);
    document.getElementById('b13f-coinciden').replaceChildren(...coin.filas.map(filaCoinciden));
    poner('k-coinciden-resumen', `${coin.en_2_o_mas} empresas en 2 o más carteras`);
    if (indice) { const ley = indice.map((g) => `${g.corto} = ${g.nombre}`).join(' · ') + '. En movimientos: ▲ aumenta su posición, ▼ la reduce, ★ compra nueva (el número es cuántos de ellos).'; poner('b13f-leyenda', ley); poner('b13f-leyenda2', ley); }
    poner('k-seguimiento-resumen', `${coin.seguidas.filter((s) => s.gestores.length).length} de ${coin.seguidas.length} las tiene algún inversor`);
    poner('b13f-sigues', `Tus empresas en seguimiento: ${coin.seguidas.map((s) => s.nombre).join(', ')}. Donde aparecen en las tablas de Mercado, se marcan en turquesa.`);
    document.getElementById('b13f-seguidas').replaceChildren(...coin.seguidas.map(filaSeguida));
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
