/* Fervis, el asistente de la cartera — PASO 4: lee la cartera de ESTE navegador y contesta en local, SIN IA todavía.
   Se abre con el botón redondo fijo de arriba a la derecha y usa la misma ventana que el «+» (.modal-overlay / .modal), con el chat dentro.
   Lee solo lo que ya está guardado en este navegador (miCartera.v1 y el último caché de precios) y calcula con eso: no manda nada a ningún
   sitio. Los pasos siguientes (la llamada a Groq con la clave de ⚙ Ajustes) irán en este mismo archivo. Todo el texto se pinta con
   textContent: nada de lo que se escribe se interpreta como HTML. */
(function () {
  const btn = document.getElementById('fervis-btn');
  if (!btn) return;

  const SUGERENCIAS = ['¿Cuánto vale mi cartera?', '¿Qué ha subido hoy?', '¿Cómo va el S&P 500?'];

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
  const usd = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    return 'Tu cartera vale ' + usd(c.valor) + ' (en dólares) con ' + c.filas.length + ' posiciones. Invertido: ' + usd(c.coste) + ' → ' + (pnl >= 0 ? 'ganancia ' : 'pérdida ') + usd(Math.abs(pnl)) +
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
  // Pregunta → respuesta local, solo para lo que se puede contestar con la cartera guardada; lo demás sigue sin IA.
  function respuestaLocal(q) {
    const x = q.toLowerCase();
    if (/s&p|nasdaq|bolsa|mercado|bitcoin|btc|precio de/.test(x)) return null;
    if (/subid|bajad|sube|baja|hoy|24 ?h/.test(x)) return respuestaHoy();
    if (/cu[aá]nto|vale|valor|total|cartera|tengo|gan|p[eé]rdid/.test(x)) return respuestaValor();
    return null;
  }

  const bienvenida = () => 'Hola, soy Fervis, el asistente de tu cartera. Todavía estoy en pruebas: leo tu cartera guardada en este navegador y te contesto lo básico (valor y cambios de hoy), pero aún no tengo IA para conversar. Nada sale de aquí. ' +
    (leerClave() ? 'Tu clave de Groq está guardada, pero todavía no la uso: la conexión llega en el siguiente paso.'
                 : 'Para hablar conmigo hará falta tu clave gratuita de Groq: pégala en ⚙ Ajustes.');
  let overlay = null, msgs = null, chips = null, texto = null, ajustes = null, titulo = null, pintarEstado = () => {};

  const el = (tag, clase, contenido) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    if (contenido !== undefined) x.textContent = contenido;
    return x;
  };

  function mensaje(rol, contenido) {
    const m = el('div', 'fervis-msg ' + rol);
    // Lo que dice Fervis lleva delante su etiqueta amarilla con texto negro; lo que escribe la persona, no.
    if (rol.startsWith('fervis')) m.append(el('span', 'fervis-etiqueta', 'Fervis:'), ' ');
    m.append(contenido);
    msgs.append(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function reiniciar() {
    msgs.replaceChildren();
    mensaje('fervis', bienvenida());
    chips.hidden = false;
  }

  function preguntar(pregunta) {
    const q = pregunta.trim().slice(0, 200);
    if (!q) return;
    chips.hidden = true;
    mensaje('yo', q);
    const pensando = mensaje('fervis pensando', '…');
    setTimeout(() => {
      pensando.remove();
      const local = respuestaLocal(q);
      mensaje('fervis', local || 'De momento solo sé contestar con tu cartera guardada (prueba «¿Cuánto vale mi cartera?» o «¿Qué ha subido hoy?»). Para «' + q + '» hará falta la IA, que llega en el siguiente paso.');
    }, 600);
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
    const ajustar = el('button', 'modal-close', '⚙');
    ajustar.type = 'button'; ajustar.title = 'Ajustes de Fervis'; ajustar.setAttribute('aria-label', 'Ajustes de Fervis'); ajustar.setAttribute('aria-expanded', 'false');
    const borrar = el('button', 'modal-close', '🗑');
    borrar.type = 'button'; borrar.title = 'Borrar la conversación'; borrar.setAttribute('aria-label', 'Borrar la conversación');
    const cerrar = el('button', 'modal-close', '×');
    cerrar.type = 'button'; cerrar.title = 'Cerrar (la conversación se queda)'; cerrar.setAttribute('aria-label', 'Cerrar el chat');
    acciones.append(ajustar, borrar, cerrar);
    cab.append(tit, acciones);

    const aviso = el('p', 'fervis-prueba', 'Versión de prueba · lee tu cartera en local, sin IA todavía');

    // Ajustes: pegar (o quitar) la clave de Groq de este navegador
    ajustes = el('form', 'fervis-ajustes');
    ajustes.hidden = true; ajustes.autocomplete = 'off';
    const ayuda = el('p', 'fervis-ayuda', 'Pega tu clave gratuita de Groq (se crea en ');
    const enlace = el('a', '', 'console.groq.com');
    enlace.href = 'https://console.groq.com/keys'; enlace.target = '_blank'; enlace.rel = 'noopener noreferrer';
    ayuda.append(enlace, '). Se guarda solo en este navegador: no se sube a GitHub, ni se sincroniza, ni va en las exportaciones.');
    const campo = el('input', 'fervis-clave');
    campo.type = 'password'; campo.autocomplete = 'off'; campo.spellcheck = false; campo.maxLength = 220; campo.placeholder = 'gsk_…'; campo.setAttribute('aria-label', 'Clave de Groq');
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
        'Todavía no la uso: la conexión con Groq llega en el siguiente paso.');
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
    chips = el('div', 'fervis-chips');
    for (const s of SUGERENCIAS) {
      const c = el('button', 'fervis-chip', s);
      c.type = 'button';
      c.addEventListener('click', () => preguntar(s));
      chips.append(c);
    }
    const form = el('form', 'fervis-form');
    form.autocomplete = 'off';
    texto = el('input', 'fervis-texto');
    texto.type = 'text'; texto.maxLength = 200; texto.placeholder = 'Escribe aquí…'; texto.setAttribute('aria-label', 'Escribe tu mensaje');
    const enviar = el('button', 'fervis-enviar', '➤');
    enviar.type = 'submit'; enviar.setAttribute('aria-label', 'Enviar');
    form.append(texto, enviar);
    const pie = el('p', 'fervis-pie', 'Información de tu cartera, no consejos de inversión.');

    modal.append(cab, aviso, ajustes, msgs, chips, form, pie);
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
