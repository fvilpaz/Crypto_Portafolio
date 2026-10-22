/* Página con TODAS las posiciones de un inversor (gestor.html?g=bridgewater): datos del último 13F que bajan los scripts de Mercado
   (data/13f_<clave>.json y data/13f_posiciones.json). Buscador, orden por cualquier columna y opción de incluir las que vendió entera. */
(function () {
  try { if (localStorage.getItem('miCartera.theme') === 'light') document.body.classList.add('light'); } catch (e) { /* sin acceso al almacenamiento: tema oscuro */ }
  const $ = (id) => document.getElementById(id);
  const clave = new URLSearchParams(location.search).get('g') || '';
  const el = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; };
  const dia = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const dinero = (usd) => (usd >= 1e9 ? (usd / 1e9).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' mil M$' : usd >= 1e6 ? (usd / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' M$' : Math.round(usd).toLocaleString('es-ES') + ' $');
  const orden = { col: 'peso', dir: -1 };
  let filas = [], datos = null;

  const trimestre = (iso) => { const [a, mes] = iso.split('-'); return 'T' + Math.ceil(+mes / 3) + ' ' + a; };
  const desdeTxt = (d) => (!d ? '—' : d.startsWith('<') ? 'desde ' + trimestre(d.slice(1)) + ' o antes' : trimestre(d));
  const cambioNum = (c) => (c === 'nueva' ? 1e9 : c === 'salio' ? -1e9 : c);   // para ordenar: las nuevas arriba, las vendidas abajo
  function chipCambio(c) {
    if (c === 'nueva') return el('span', '★ Compra nueva', 'chip new');
    if (c === 'salio') return el('span', '✖ Vendió todo', 'chip dn');
    if (c === 0) return document.createTextNode('Sin cambios');
    return el('span', (c > 0 ? '▲ +' : '▼ ') + c.toLocaleString('es-ES') + ' % acciones', 'chip ' + (c > 0 ? 'up' : 'dn'));
  }

  function pintar() {
    const q = $('g-buscar').value.trim().toUpperCase(), conSalidas = $('g-salidas').checked;
    let lista = filas.filter((f) => (conSalidas || !f.salio) && f.emisor.includes(q));
    const v = (f) => (orden.col === 'emisor' ? f.emisor : orden.col === 'cambio' ? cambioNum(f.cambio) : orden.col === 'desde' ? (!f.desde ? '9999' : f.desde.startsWith('<') ? f.desde.slice(1) + '-0' : f.desde + '-1') : f[orden.col]);   // desde: las de racha más antigua primero
    lista.sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * orden.dir || a.emisor.localeCompare(b.emisor); });
    const tbody = document.createDocumentFragment();
    lista.forEach((f) => {
      const tr = document.createElement('tr'), num = (t) => el('td', t, 'text-right'), cel = document.createElement('td');
      cel.append(chipCambio(f.cambio));
      if (f.salio) tr.style.opacity = '.65';
      tr.append(el('td', f.emisor, 'tk'), num(f.salio ? '—' : dinero(f.valor)), num(f.salio ? `0 % (tenía ${f.pesoAntes.toLocaleString('es-ES')} %)` : f.peso.toLocaleString('es-ES') + ' %'),
        num(f.salio ? '0' : f.acciones.toLocaleString('es-ES')), cel, el('td', f.salio ? '—' : desdeTxt(f.desde)));
      tbody.append(tr);
    });
    $('g-filas').replaceChildren(tbody);
    $('g-contador').textContent = `${lista.length.toLocaleString('es-ES')} empresa${lista.length === 1 ? '' : 's'}${q ? ' con ese nombre' : ''}.`;
    document.querySelectorAll('th[data-col]').forEach((th) => {
      th.textContent = th.textContent.replace(/ [▲▼]$/, '');
      if (th.dataset.col === orden.col) th.textContent += orden.dir < 0 ? ' ▼' : ' ▲';
    });
  }

  Promise.all([fetch('data/13f_' + encodeURIComponent(clave) + '.json').then((r) => { if (!r.ok) throw new Error('sin datos'); return r.json(); }), fetch('data/13f_posiciones.json').then((r) => r.json())])
    .then(([g, p]) => {
      datos = g;
      document.title = `${g.gestor} · todas sus posiciones · Mi Cartera`;
      $('g-titulo').textContent = g.gestor;
      const hoy = Object.entries(p.filas).filter(([, por]) => por[clave]).length;
      $('g-resumen').textContent = `Informe 13F a la SEC con cierre el ${dia(g.periodo)}, presentado el ${dia(g.presentado)}: es lo que tenían entonces, no lo que tienen hoy. ${g.n_emisores} empresas en total (${dinero(g.total_usd)}). Ordena pulsando una columna.`;
      filas = Object.entries(p.filas).filter(([, por]) => por[clave]).map(([emisor, por]) => {
        const f = por[clave], salio = f[2] === 'salio';
        return { emisor, salio, peso: f[0], valor: g.total_usd * f[0] / 100, acciones: f[1], cambio: f[2], pesoAntes: salio ? f[3] : 0, desde: salio ? null : f[3] };
      });
      if (g.tabla_url) { const a = el('a', 'Tabla original de la SEC ↗', ''); a.href = g.tabla_url; a.target = '_blank'; a.rel = 'noopener'; $('g-pie').append('Fuente: SEC EDGAR, formulario 13F-HR. ', a); }
      $('g-buscar').addEventListener('input', pintar); $('g-salidas').addEventListener('change', pintar);
      document.querySelectorAll('th[data-col]').forEach((th) => th.addEventListener('click', () => {
        orden.dir = orden.col === th.dataset.col ? -orden.dir : (th.dataset.col === 'emisor' ? 1 : -1); orden.col = th.dataset.col; pintar();
      }));
      pintar();
    })
    .catch(() => { $('g-titulo').textContent = 'No encuentro ese inversor'; $('g-resumen').textContent = 'Abre la lista desde Mercado, pulsando "Ver la lista completa" bajo la tabla de un inversor.'; });
})();
