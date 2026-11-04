/* Fervis, el asistente de la cartera — PASO 4: lee la cartera de ESTE navegador y contesta en local, SIN IA todavía.
   Se abre con el botón redondo fijo de arriba a la derecha y usa la misma ventana que el «+» (.modal-overlay / .modal), con el chat dentro.
   Lee solo lo que ya está guardado en este navegador (miCartera.v1 y el último caché de precios) y calcula con eso: no manda nada a ningún
   sitio. Los pasos siguientes (la llamada a Groq con la clave de ⚙ Ajustes) irán en este mismo archivo. Todo el texto se pinta con
   textContent: nada de lo que se escribe se interpreta como HTML. */
(function () {
  const btn = document.getElementById('fervis-btn');
  if (!btn) return;

  // La clave de Groq de ESTE navegador. Va fuera del prefijo «miCartera.»: la exportación y la sincronización usan buildState()
  // (un estado explícito, no recorren todo el almacenamiento), así que la clave no sale en archivos ni en el gist. Nunca se escribe
  // en la página entera: solo enmascarada (últimas 4 letras) y nunca va al código ni a GitHub.
  const CLAVE_KEY = 'fervis.groqKey';
  const leerClave = () => { try { return localStorage.getItem(CLAVE_KEY) || ''; } catch (e) { return ''; } };
  const guardarClave = (k) => { try { if (k) localStorage.setItem(CLAVE_KEY, k); else localStorage.removeItem(CLAVE_KEY); return true; } catch (e) { return false; } };
  // Lo que se pega suele venir de un .env: «GROQ_API_KEY=gsk_…», con comillas, con «export» delante o con saltos de línea. Se limpia solo.
  const limpiarClave = (texto) => String(texto || '').trim()
    .replace(/^export\s+/i, '').replace(/^bearer\s+/i, '')
    .replace(/^[A-Za-z][A-Za-z0-9_]*\s*=\s*/, '')   // «NOMBRE=» delante
    .replace(/^["'`]+|["'`]+$/g, '').trim();
  // Solo se comprueba que parezca una clave (sin espacios, longitud razonable); no que valga: eso se sabe al usarla.
  const claveValida = (k) => /^[\w.\-]{20,300}$/.test(k);
  const enmascarar = (k) => (k.startsWith('gsk_') ? 'gsk_' : '') + '…' + k.slice(-4);

  // ── Lectura de la cartera (solo local, solo lectura) ──
  // Mismo cálculo que el encabezado de la app: valor = cantidad × precio, con el precio de mercado guardado; si no hay, el que pusiste a mano;
  // si no, el de compra. Todo en dólares (la app los convierte a € solo al pintar).
  // Moneda que la persona tiene elegida en la app en este momento (USD o EUR). El factor es € por $, el mismo tipo que usa la app (miCartera.rate.v1).
  const monedaApp = () => {
    try {
      if (localStorage.getItem('miCartera.moneda') === 'EUR') return { codigo: 'EUR', factor: parseFloat(localStorage.getItem('miCartera.rate.v1')) || 0.85 };
    } catch (e) { /* sin almacenamiento: dólares */ }
    return { codigo: 'USD', factor: 1 };
  };
  const usd = (n) => {
    const m = monedaApp(), v = Number(n) * m.factor;
    return m.codigo === 'EUR' ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const nombreMoneda = () => (monedaApp().codigo === 'EUR' ? 'euros' : 'dólares');
  const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  function leerCartera() {
    try {
      const s = JSON.parse(localStorage.getItem('miCartera.v1') || '{}');
      const lista = Array.isArray(s.portfolio) ? s.portfolio.filter((a) => a && a.token && Number(a.qty) > 0) : [];
      if (!lista.length) return { vacia: true };
      let pr = {}, ts = 0;
      try { const c = JSON.parse(localStorage.getItem('miCartera.prices.v1') || '{}'); pr = c.prices || {}; ts = Number(c.ts) || 0; } catch (e) { /* sin caché */ }
      const manual = (s.settings && s.settings.manualPrices) || {};
      const filas = lista.map((a) => {
        const vivo = pr[a.token] && pr[a.token].price > 0 ? pr[a.token] : null;
        const precio = vivo ? vivo.price : (manual[a.token] && manual[a.token].usd) || Number(a.avgPrice) || 0;
        return { token: String(a.token), valor: Number(a.qty) * precio, coste: Number(a.costUsd) || 0, cambio: vivo ? Number(vivo.change24h) || 0 : null };
      });
      return { vacia: false, filas, ts, valor: filas.reduce((x, f) => x + f.valor, 0), coste: filas.reduce((x, f) => x + f.coste, 0) };
    } catch (e) { return { vacia: true }; }
  }
  const hace = (ts) => { if (!ts) return 'sin precios guardados (se usan los de compra)'; const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); return m < 1 ? 'precios de hace menos de 1 min' : m < 90 ? 'precios de hace ' + m + ' min' : 'precios de hace ' + Math.round(m / 60) + ' h (puede que no estén al día)'; };
  function respuestaValor() {
    const c = leerCartera();
    if (c.vacia) return 'Tu cartera está vacía en este navegador: añade alguna moneda con el «+» y te cuento.';
    const pnl = c.valor - c.coste;
    const top = c.filas.slice().sort((a, b) => b.valor - a.valor).slice(0, 3).map((f) => f.token + ' ' + usd(f.valor)).join(', ');
    return 'Tu cartera vale ' + usd(c.valor) + ' (en ' + nombreMoneda() + ') con ' + c.filas.length + ' posiciones. Invertido: ' + usd(c.coste) + ' → ' + (pnl >= 0 ? 'ganancia ' : 'pérdida ') + usd(Math.abs(pnl)) +
      (c.coste > 0 ? ' (' + pct(pnl / c.coste * 100) + ')' : '') + '. Mayores: ' + top + '. Datos: ' + hace(c.ts) + '.';
  }
  function respuestaHoy() {
    const c = leerCartera();
    if (c.vacia) return 'Tu cartera está vacía en este navegador: añade alguna moneda con el «+» y te cuento.';
    const con = c.filas.filter((f) => f.cambio !== null).sort((a, b) => b.cambio - a.cambio);
    if (!con.length) return 'Aún no tengo cambios de 24 h guardados de tus monedas (abre la app unos segundos para que cargue los precios y vuelve a preguntarme).';
    const f = (x) => x.token + ' ' + pct(x.cambio);
    const suben = con.filter((x) => x.cambio > 0).slice(0, 3), bajan = con.filter((x) => x.cambio < 0).reverse().slice(0, 3);
    return 'En tu cartera, en 24 h: ' + (suben.length ? 'suben ' + suben.map(f).join(', ') : 'no sube ninguna moneda') + '; ' +
      (bajan.length ? 'bajan ' + bajan.map(f).join(', ') : 'no baja ninguna') + '. Datos: ' + hace(c.ts) + '.';
  }
  // Operaciones guardadas en este navegador (compras, ventas, recompensas): las N últimas, de un tipo si se pide.
  const NUMEROS = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  const cant = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 });
  function respuestaOperaciones(q) {
    const x = q.toLowerCase();
    const m = x.match(/\b(\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
    const n = Math.min(20, m ? (NUMEROS[m[1]] || Number(m[1])) : 5) || 5;
    const tipo = /venta/.test(x) ? 'Venta' : /compra/.test(x) ? 'Compra' : null;
    let lista = [];
    try { const s = JSON.parse(localStorage.getItem('miCartera.v1') || '{}'); lista = Array.isArray(s.transactions) ? s.transactions : []; } catch (e) { /* sin datos */ }
    lista = lista.filter((o) => o && o.token && (!tipo || o.type === tipo))
      .map((o, i) => ({ o, i })).sort((a, b) => String(b.o.date).localeCompare(String(a.o.date)) || b.i - a.i).slice(0, n).map((e) => e.o);
    if (!lista.length) return tipo ? 'No tengo ' + (tipo === 'Venta' ? 'ventas' : 'compras') + ' guardadas en este navegador.' : 'No tengo operaciones guardadas en este navegador.';
    const uno = lista.length === 1;
    return (uno ? 'Tu última ' : 'Tus ' + lista.length + ' últimas ') + (tipo === 'Venta' ? (uno ? 'venta' : 'ventas') : tipo === 'Compra' ? (uno ? 'compra' : 'compras') : (uno ? 'operación' : 'operaciones')) + ':\n' +
      lista.map((o) => '• ' + o.date + ' · ' + o.type + ' · ' + cant(o.qty) + ' ' + o.token + ' a ' + usd(o.price) + ' (total ' + usd(o.totalUsd) + ')').join('\n');
  }

  // Diagnóstico técnico con los datos que ya publica la app (data/tecnico.json y data/precios.json). El S&P 500 se mide con SPY, el ETF que lo replica.
  let datosMercado = null;
  async function cargarMercado() {
    if (datosMercado) return datosMercado;
    const [t, p] = await Promise.all(['data/tecnico.json', 'data/precios.json'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })));
    datosMercado = { tec: t.simbolos || {}, precios: p.precios || {}, fecha: t.updated || '' };
    return datosMercado;
  }
  async function respuestaDiagnostico(simbolo, etiqueta) {
    let d;
    try { d = await cargarMercado(); } catch (e) { return 'No he podido cargar los datos de mercado de la app ahora mismo. Inténtalo en un momento.'; }
    const t = d.tec[simbolo], p = d.precios[simbolo];
    if (!t || !p || !(p.price > 0)) return 'No tengo datos de ' + etiqueta + ' en la app.';
    const precio = p.price, serie = Array.isArray(t.serie) ? t.serie.filter((v) => v > 0) : [];
    const lineas = ['Diagnóstico técnico de ' + etiqueta + (simbolo !== etiqueta ? ' (' + simbolo + ')' : '') + ', con los datos de la app' + (d.fecha ? ' del ' + d.fecha.slice(0, 10) : '') + ':',
      '• Precio: ' + usd(precio) + (typeof p.change === 'number' ? ' (' + pct(p.change) + ' hoy)' : ''),
      '• Fondo: ' + (precio > t.sma200 ? 'por encima' : 'por debajo') + ' de su media de 200 días (' + usd(t.sma200) + '): tendencia de fondo ' + (precio > t.sma200 ? 'alcista' : 'bajista'),
      '• Corto plazo: ' + (precio > t.sma50 ? 'por encima' : 'por debajo') + ' de su media de 50 días (' + usd(t.sma50) + ')',
      '• RSI 14: ' + t.rsi14.toFixed(0) + (t.rsi14 >= 70 ? ' (sobrecompra)' : t.rsi14 <= 30 ? ' (sobreventa)' : ' (zona neutral)')];
    if (serie.length > 1) lineas.push('• Últimas ' + serie.length + ' sesiones: ' + pct((serie[serie.length - 1] / serie[0] - 1) * 100));
    lineas.push('Ojo: no tengo la rentabilidad del último año completo, solo estas medias y las últimas sesiones. Es una lectura técnica, no un consejo de inversión.');
    return lineas.join('\n');
  }

  // Pregunta → respuesta local (texto, promesa o null), solo para lo que se puede contestar con los datos de la app; lo demás sigue sin IA.
  function respuestaLocal(q) {
    const x = q.toLowerCase();
    if (/(últim|ultim|recient).*(compra|venta|operaci|movimiento)|(compra|venta|operaci|movimiento).*(últim|ultim|recient)/.test(x)) return respuestaOperaciones(q);
    if (/s&p|sp ?500|\bspy\b/.test(x)) return respuestaDiagnostico('SPY', 'S&P 500');
    if (/diagn|an[aá]lisis|tendencia|c[oó]mo va/.test(x)) {
      const s = (q.match(/\b[A-Z]{2,6}\b/g) || []).find((w) => datosMercado ? datosMercado.tec[w] : true);
      if (s) return respuestaDiagnostico(s, s);
    }
    if (/precio de/.test(x)) return null;
    if (/subid|bajad|sube|baja|hoy|24 ?h/.test(x)) return respuestaHoy();
    if (/cu[aá]nto|vale|valor|total|cartera|tengo|gan|p[eé]rdid/.test(x)) return respuestaValor();
    return null;
  }

  // ── IA (Groq) con herramientas ──
  // El modelo NO ve la cartera entera: solo la pregunta y lo que devuelven las herramientas que él decide llamar (con los parámetros que
  // entienda de la pregunta: cuántas, compras o ventas, bolsa o cripto…). Las herramientas leen los datos de ESTE navegador y de los JSON de la app.
  // A Groq la clave solo va en la cabecera de la petición; el resto de la cartera no se envía.
  const GROQ = 'https://api.groq.com/openai/v1';
  const MODELOS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];   // el primero que tenga la cuenta
  const SISTEMA = 'Eres Fervis, el asistente de la cartera de inversión de esta persona. Responde siempre en castellano, breve y claro, sin markdown. ' +
    'Para cualquier dato (valor de la cartera, operaciones, precios, indicadores) usa SIEMPRE las herramientas; nunca inventes cifras ni recuerdes datos de memoria. ' +
    'Si ninguna herramienta puede darte lo que piden, dilo con sinceridad y explica qué sí puedes consultar. Cada herramienta devuelve sus importes ya en la moneda indicada en su campo «moneda» (la que la persona tiene elegida en la app); exprésalos siempre en esa moneda, con € o $. ' +
    'El S&P 500 se consulta con el símbolo SPY (ETF que lo replica). No des consejos de inversión: describe los datos.';
  const HERRAMIENTAS = [
    { type: 'function', function: { name: 'resumen_cartera', description: 'Valor total de la cartera, lo invertido, ganancia o pérdida, posiciones con su valor y su cambio de 24 h, y la antigüedad de los precios.', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'operaciones', description: 'Últimas operaciones guardadas (más recientes primero), con filtros opcionales.', parameters: { type: 'object', properties: {
      n: { type: 'integer', description: 'cuántas devolver (1 a 50; 5 si no se dice)' },
      tipo: { type: 'string', enum: ['Compra', 'Venta', 'Recompensa'], description: 'solo de este tipo' },
      clase: { type: 'string', enum: ['bolsa', 'cripto'], description: 'bolsa = acciones y ETF; cripto = criptomonedas' },
      token: { type: 'string', description: 'símbolo concreto, p. ej. BTC o NVDA' } } } } },
    { type: 'function', function: { name: 'diagnostico_tecnico', description: 'Datos técnicos de una acción o ETF de la app: precio, cambio de hoy, medias de 50 y 200 días, RSI de 14 y variación de las últimas sesiones. No incluye rentabilidad del último año completo.', parameters: { type: 'object', properties: { simbolo: { type: 'string', description: 'símbolo, p. ej. NVDA o SPY (S&P 500)' } }, required: ['simbolo'] } } },
  ];
  const sinNaN = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
  const aMoneda = (x) => sinNaN(Number(x) * monedaApp().factor);   // importe de la app (en $) → moneda elegida
  const esBolsa = (token, portfolio, d) => { const p = portfolio.find((a) => a && a.token === token); return p ? p.kind === 'stock' : !!(d && d.tec[token]); };
  const FUNCIONES = {
    resumen_cartera: async () => {
      const c = leerCartera();
      if (c.vacia) return { vacia: true };
      return { moneda: monedaApp().codigo, valor: aMoneda(c.valor), invertido: aMoneda(c.coste), ganancia: aMoneda(c.valor - c.coste), antiguedad_precios_min: c.ts ? Math.round((Date.now() - c.ts) / 60000) : null,
        posiciones: c.filas.map((f) => ({ token: f.token, valor: aMoneda(f.valor), invertido: aMoneda(f.coste), cambio_24h_pct: f.cambio === null ? null : sinNaN(f.cambio) })) };
    },
    operaciones: async (a) => {
      let s = {}; try { s = JSON.parse(localStorage.getItem('miCartera.v1') || '{}'); } catch (e) { /* sin datos */ }
      const lista = Array.isArray(s.transactions) ? s.transactions : [], port = Array.isArray(s.portfolio) ? s.portfolio : [];
      let d = null; if (a.clase) { try { d = await cargarMercado(); } catch (e) { /* sin mercado: solo vale la cartera */ } }
      const n = Math.min(50, Math.max(1, parseInt(a.n, 10) || 5));
      const sel = lista.filter((o) => o && o.token && (!a.tipo || o.type === a.tipo) && (!a.token || String(o.token).toUpperCase() === String(a.token).toUpperCase()) &&
        (!a.clase || esBolsa(o.token, port, d) === (a.clase === 'bolsa')))
        .map((o, i) => ({ o, i })).sort((x, y) => String(y.o.date).localeCompare(String(x.o.date)) || y.i - x.i).slice(0, n)
        .map(({ o }) => ({ fecha: o.date, tipo: o.type, token: o.token, cantidad: o.qty, precio: aMoneda(o.price), total: aMoneda(o.totalUsd) }));
      return { moneda: monedaApp().codigo, cuantas: sel.length, operaciones: sel };
    },
    diagnostico_tecnico: async (a) => {
      const sim = String(a.simbolo || '').toUpperCase();
      let d; try { d = await cargarMercado(); } catch (e) { return { error: 'No se pudieron cargar los datos de mercado' }; }
      const t = d.tec[sim], p = d.precios[sim];
      if (!t || !p || !(p.price > 0)) return { error: 'Sin datos de ' + sim + ' en la app' };
      const serie = Array.isArray(t.serie) ? t.serie.filter((v) => v > 0) : [];
      return { moneda: monedaApp().codigo, simbolo: sim, fecha: d.fecha.slice(0, 10), precio: aMoneda(p.price), cambio_hoy_pct: typeof p.change === 'number' ? sinNaN(p.change) : null, media_50d: aMoneda(t.sma50), media_200d: aMoneda(t.sma200), rsi14: t.rsi14,
        sesiones: serie.length, variacion_sesiones_pct: serie.length > 1 ? sinNaN((serie[serie.length - 1] / serie[0] - 1) * 100) : null };
    },
  };

  let modeloGroq = null, historial = [];
  async function pedirGroq(clave, cuerpo) {
    let r;
    try { r = await fetch(GROQ + cuerpo.ruta, { method: cuerpo.body ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + clave }, cuerpo.body ? { 'Content-Type': 'application/json' } : {}), body: cuerpo.body, signal: AbortSignal.timeout(30000) }); }
    catch (e) { throw new Error('No he podido conectar con Groq (¿sin internet?).'); }
    if (r.status === 401) throw new Error('Groq no acepta tu clave (401). Revisa que esté entera en Ajustes.');
    if (r.status === 429) throw new Error('Has llegado al límite gratuito de Groq (429). Espera un minuto y vuelve a preguntar.');
    if (!r.ok) throw new Error('Groq ha fallado (código ' + r.status + ').');
    return r.json();
  }
  async function responderConIA(pregunta) {
    const clave = leerClave();
    if (!modeloGroq) {
      const lista = ((await pedirGroq(clave, { ruta: '/models' })).data || []).map((m) => m.id);
      modeloGroq = MODELOS.find((m) => lista.includes(m));
      if (!modeloGroq) throw new Error('Tu cuenta de Groq no tiene ninguno de los modelos que uso con herramientas.');
    }
    const turno = [{ role: 'user', content: pregunta }];
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const r = await pedirGroq(clave, { ruta: '/chat/completions', body: JSON.stringify({ model: modeloGroq, temperature: 0.2, max_tokens: 700, tools: HERRAMIENTAS, tool_choice: 'auto',
        messages: [{ role: 'system', content: SISTEMA }].concat(historial, turno) }) });
      const m = r.choices && r.choices[0] && r.choices[0].message;
      if (!m) throw new Error('Groq ha contestado algo vacío.');
      if (!m.tool_calls || !m.tool_calls.length) {
        const texto = String(m.content || '').trim() || 'No he sabido qué contestar a eso.';
        historial = historial.concat(turno[0], { role: 'assistant', content: texto }).slice(-10);
        return texto;
      }
      turno.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
      for (const tc of m.tool_calls) {
        let salida;
        try {
          const fn = FUNCIONES[tc.function.name];
          salida = fn ? await fn(JSON.parse(tc.function.arguments || '{}') || {}) : { error: 'Herramienta desconocida' };
        } catch (e) { salida = { error: 'No se pudo ejecutar la herramienta' }; }
        turno.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(salida) });
      }
    }
    throw new Error('No he conseguido cerrar la respuesta. Prueba a preguntarlo de otra forma.');
  }

  const bienvenida = () => leerClave()
    ? 'Hola, soy Fervis. Pregúntame lo que quieras de tu cartera, tus operaciones o el mercado de la app. Para contestarte envío a Groq tu pregunta y los datos que consulte para responder (nunca tu clave ni el resto de la cartera). Todavía estoy en pruebas.'
    : 'Hola, soy Fervis, el asistente de tu cartera. Sin clave solo sé respuestas básicas (valor de la cartera y cambios de hoy). Para hablar conmigo de verdad hará falta tu clave gratuita de Groq: pégala en Ajustes (el primer icono de arriba a la derecha).';
  let overlay = null, msgs = null, texto = null, ajustes = null, titulo = null, pintarEstado = () => {};

  const el = (tag, clase, contenido) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    if (contenido !== undefined) x.textContent = contenido;
    return x;
  };

  // Iconos de trazo (como los del resto de la app), dibujados con el DOM: nada de emojis, que cada sistema pinta distinto y feo.
  const ICONOS = {
    ajustes: [['line', { x1: 4, y1: 21, x2: 4, y2: 14 }], ['line', { x1: 4, y1: 10, x2: 4, y2: 3 }], ['line', { x1: 12, y1: 21, x2: 12, y2: 12 }], ['line', { x1: 12, y1: 8, x2: 12, y2: 3 }], ['line', { x1: 20, y1: 21, x2: 20, y2: 16 }], ['line', { x1: 20, y1: 12, x2: 20, y2: 3 }], ['line', { x1: 1, y1: 14, x2: 7, y2: 14 }], ['line', { x1: 9, y1: 8, x2: 15, y2: 8 }], ['line', { x1: 17, y1: 16, x2: 23, y2: 16 }]],
    papelera: [['polyline', { points: '3 6 5 6 21 6' }], ['path', { d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }], ['line', { x1: 10, y1: 11, x2: 10, y2: 17 }], ['line', { x1: 14, y1: 11, x2: 14, y2: 17 }]],
    cerrar: [['line', { x1: 18, y1: 6, x2: 6, y2: 18 }], ['line', { x1: 6, y1: 6, x2: 18, y2: 18 }]],
  };
  function icono(nombre) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    for (const [tag, attrs] of ICONOS[nombre]) {
      const p = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
      svg.append(p);
    }
    return svg;
  }

  function mensaje(rol, contenido) {
    const m = el('div', 'fervis-msg ' + rol);
    // Lo que dice Fervis lleva delante su etiqueta amarilla con texto negro; lo que escribe la persona, no.
    // La etiqueta va una sola vez por tanda: si el mensaje anterior ya era de Fervis, no se repite.
    const previo = msgs.lastElementChild;
    const sigueTanda = previo && previo.classList.contains('fervis') && !previo.classList.contains('pensando');
    if (rol.startsWith('fervis') && !sigueTanda) m.append(el('span', 'fervis-etiqueta', 'Fervis'));
    m.append(contenido);
    msgs.append(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function reiniciar() {
    msgs.replaceChildren();
    historial = [];
    mensaje('fervis', bienvenida());
  }

  function preguntar(pregunta) {
    const q = pregunta.trim().slice(0, 200);
    if (!q) return;
    mensaje('yo', q);
    const pensando = mensaje('fervis pensando', '…');
    if (leerClave()) {
      responderConIA(q).catch((e) => e.message).then((txt) => { pensando.remove(); mensaje('fervis', txt); });
      return;
    }
    const ruta = respuestaLocal(q);   // sin clave: respuestas básicas locales
    Promise.resolve(ruta).then((local) => new Promise((ok) => setTimeout(() => ok(local), 500))).catch(() => null).then((local) => {
      pensando.remove();
      mensaje('fervis', local || 'Sin clave de Groq solo sé respuestas básicas (prueba «¿Cuánto vale mi cartera?» o «¿Qué ha subido hoy?»). Para «' + q + '» pega tu clave gratuita en Ajustes.');
    });
  }

  function construir() {
    overlay = el('div', 'modal-overlay');
    overlay.id = 'fervis-modal';
    const modal = el('div', 'modal fervis-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'fervis-titulo');

    const cab = el('div', 'add-modal-head');
    const tit = el('h3', '', 'Fervis');
    tit.id = 'fervis-titulo'; tit.tabIndex = -1; titulo = tit;
    const acciones = el('div', 'fervis-acciones');
    const ajustar = el('button', 'modal-close'); ajustar.append(icono('ajustes'));
    ajustar.type = 'button'; ajustar.title = 'Ajustes de Fervis'; ajustar.setAttribute('aria-label', 'Ajustes de Fervis'); ajustar.setAttribute('aria-expanded', 'false');
    const borrar = el('button', 'modal-close'); borrar.append(icono('papelera'));
    borrar.type = 'button'; borrar.title = 'Borrar la conversación'; borrar.setAttribute('aria-label', 'Borrar la conversación');
    const cerrar = el('button', 'modal-close'); cerrar.append(icono('cerrar'));
    cerrar.type = 'button'; cerrar.title = 'Cerrar (la conversación se queda)'; cerrar.setAttribute('aria-label', 'Cerrar el chat');
    acciones.append(ajustar, borrar, cerrar);
    cab.append(tit, acciones);


    // Ajustes: pegar (o quitar) la clave de Groq de este navegador
    ajustes = el('form', 'fervis-ajustes');
    ajustes.hidden = true; ajustes.autocomplete = 'off';
    const ayuda = el('p', 'fervis-ayuda', 'Pega tu clave gratuita de Groq (se crea en ');
    const enlace = el('a', '', 'console.groq.com');
    enlace.href = 'https://console.groq.com/keys'; enlace.target = '_blank'; enlace.rel = 'noopener noreferrer';
    ayuda.append(enlace, '). Se guarda solo en este navegador: no se sube a GitHub, ni se sincroniza, ni va en las exportaciones. Al preguntar, a Groq se envían tu pregunta y los datos que Fervis consulte para contestarte (nunca tu clave ni el resto de la cartera).');
    const campo = el('input', 'fervis-clave');
    campo.type = 'text'; campo.autocomplete = 'off'; campo.name = 'fervis-clave-groq'; campo.autocapitalize = 'off'; campo.setAttribute('data-lpignore', 'true'); campo.setAttribute('data-1p-ignore', 'true');   // tipo texto (se ve con puntos por CSS): así el gestor de contraseñas del navegador no la ofrece guardar ni rellenar
     campo.spellcheck = false; campo.maxLength = 220; campo.placeholder = 'gsk_…'; campo.setAttribute('aria-label', 'Clave de Groq');
    const guardar = el('button', 'fervis-mini', 'Guardar'); guardar.type = 'submit';
    const quitar = el('button', 'fervis-mini sec', 'Quitar clave'); quitar.type = 'button';
    const fila = el('div', 'fervis-fila'); fila.append(campo, guardar);
    const estado = el('p', 'fervis-estado'); estado.setAttribute('role', 'status');
    pintarEstado = () => { const k = leerClave(); estado.textContent = k ? 'Clave guardada: ' + enmascarar(k) : 'Sin clave todavía.'; quitar.hidden = !k; };
    ajustes.append(ayuda, fila, estado, quitar);
    pintarEstado();
    ajustes.addEventListener('submit', (e) => {
      e.preventDefault();
      const k = limpiarClave(campo.value);
      if (!k) { estado.textContent = 'Pega primero tu clave de Groq en el campo.'; return; }
      if (!claveValida(k)) { estado.textContent = 'Eso no parece una clave: tiene espacios o no mide entre 20 y 300 caracteres. No se ha guardado.'; return; }
      if (!guardarClave(k)) { estado.textContent = 'No se ha podido guardar: el navegador no lo permite (¿modo privado?).'; return; }
      campo.value = '';   // la clave ya no se queda escrita en la página
      pintarEstado();
      mensaje('fervis', 'Clave guardada ✓ (' + enmascarar(k) + '). ' + (k.startsWith('gsk_') ? '' : 'Ojo: no empieza por gsk_, que es como empiezan las de Groq; si no funciona, revisa que la hayas copiado entera. ') +
        'Ya puedo contestar con IA: se envían a Groq tu pregunta y los datos que consulte.');
    });
    quitar.addEventListener('click', () => { guardarClave(''); campo.value = ''; pintarEstado(); mensaje('fervis', 'Clave quitada de este navegador.'); });
    ajustar.addEventListener('click', () => {
      ajustes.hidden = !ajustes.hidden;
      ajustar.setAttribute('aria-expanded', String(!ajustes.hidden));
      if (!ajustes.hidden) campo.focus();
    });
    msgs = el('div', 'fervis-msgs');
    msgs.setAttribute('role', 'log');
    msgs.setAttribute('aria-live', 'polite');
    const form = el('form', 'fervis-form');
    form.autocomplete = 'off';
    texto = el('input', 'fervis-texto');
    texto.type = 'text'; texto.maxLength = 200; texto.placeholder = 'Escribe aquí…'; texto.setAttribute('aria-label', 'Escribe tu mensaje');
    const enviar = el('button', 'fervis-enviar', '➤');
    enviar.type = 'submit'; enviar.setAttribute('aria-label', 'Enviar');
    form.append(texto, enviar);
    const pie = el('p', 'fervis-pie', 'Información de tu cartera, no consejos de inversión.');

    modal.append(cab, ajustes, msgs, form, pie);
    overlay.append(modal);
    document.body.append(overlay);

    borrar.addEventListener('click', reiniciar);
    cerrar.addEventListener('click', ocultar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) ocultar(); });   // tocar fuera, como los demás modales
    form.addEventListener('submit', (e) => { e.preventDefault(); const q = texto.value; texto.value = ''; preguntar(q); });
    reiniciar();
  }

  function abrir() {
    if (!overlay) construir();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    btn.setAttribute('aria-expanded', 'true');
    // En el móvil, poner el cursor en la casilla saca el teclado y esconde el saludo: ahí el foco va al título (lo anuncian los lectores de
    // pantalla) y el teclado sale solo al tocar la casilla. Con ratón (escritorio) sí se escribe directamente.
    if (window.matchMedia('(pointer: fine)').matches) texto.focus(); else titulo.focus();
  }

  function ocultar() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  btn.setAttribute('aria-controls', 'fervis-modal');
  btn.addEventListener('click', abrir);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) ocultar(); });
})();
