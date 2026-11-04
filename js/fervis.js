/* Fervis, el asistente de la cartera — PASO 2: el panel del chat, SIN IA todavía.
   Se abre con el botón redondo de la fila de pestañas y usa la misma ventana que el «+» (.modal-overlay / .modal), con el chat dentro.
   Aún no lee la cartera ni habla con ninguna IA: contesta con un texto fijo que lo dice, sin inventar ningún dato de la cartera.
   Los pasos siguientes (leer la cartera de este navegador, ajustes de la clave, Groq) irán en este mismo archivo. Todo el texto
   se pinta con textContent: nada de lo que se escribe se interpreta como HTML. */
(function () {
  const btn = document.getElementById('fervis-btn');
  if (!btn) return;

  const SUGERENCIAS = ['¿Cuánto vale mi cartera?', '¿Qué ha subido hoy?', '¿Cómo va el S&P 500?'];
  const BIENVENIDA = 'Hola, soy Fervis, el asistente de tu cartera. Todavía estoy en pruebas: aún no leo tu cartera ni tengo IA, así que no puedo darte datos. Puedes escribirme para ver cómo funciona el chat.';
  let overlay = null, msgs = null, chips = null, texto = null;

  const el = (tag, clase, contenido) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    if (contenido !== undefined) x.textContent = contenido;
    return x;
  };

  function mensaje(rol, contenido) {
    const m = el('div', 'fervis-msg ' + rol, contenido);
    msgs.append(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function reiniciar() {
    msgs.replaceChildren();
    mensaje('fervis', BIENVENIDA);
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
      mensaje('fervis', 'Esto es solo una prueba del panel: todavía no leo tu cartera ni tengo IA. Cuando esté lista, aquí te contestaré a «' + q + '».');
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
    tit.id = 'fervis-titulo';
    const acciones = el('div', 'fervis-acciones');
    const borrar = el('button', 'modal-close', '🗑');
    borrar.type = 'button'; borrar.title = 'Borrar la conversación'; borrar.setAttribute('aria-label', 'Borrar la conversación');
    const cerrar = el('button', 'modal-close', '×');
    cerrar.type = 'button'; cerrar.title = 'Cerrar (la conversación se queda)'; cerrar.setAttribute('aria-label', 'Cerrar el chat');
    acciones.append(borrar, cerrar);
    cab.append(tit, acciones);

    const aviso = el('p', 'fervis-prueba', 'Versión de prueba · sin IA todavía');
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

    modal.append(cab, aviso, msgs, chips, form, pie);
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
    texto.focus();
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
