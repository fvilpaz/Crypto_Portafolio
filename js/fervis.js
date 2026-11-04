/* Fervis, el asistente de la cartera — PASO 2: el panel del chat, SIN IA todavía.
   Se abre con el botón redondo de la fila de pestañas y usa la misma ventana que el «+» (.modal-overlay / .modal), con el chat dentro.
   Aún no lee la cartera ni habla con ninguna IA: contesta con un texto fijo que lo dice, sin inventar ningún dato de la cartera.
   Los pasos siguientes (leer la cartera de este navegador, ajustes de la clave, Groq) irán en este mismo archivo. Todo el texto
   se pinta con textContent: nada de lo que se escribe se interpreta como HTML. */
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
  const claveValida = (k) => /^gsk_[\w-]{16,200}$/.test(k);   // forma de las claves de Groq; no comprueba que valga (eso, al usarla)
  const enmascarar = (k) => 'gsk_…' + k.slice(-4);

  const bienvenida = () => 'Hola, soy Fervis, el asistente de tu cartera. Todavía estoy en pruebas: aún no leo tu cartera ni tengo IA, así que no puedo darte datos. ' +
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
    const m = el('div', 'fervis-msg ' + rol, contenido);
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

    const aviso = el('p', 'fervis-prueba', 'Versión de prueba · sin IA todavía');

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
      const k = campo.value.trim();
      if (!claveValida(k)) { estado.textContent = 'Esa clave no tiene la forma de una clave de Groq (empieza por gsk_). No se ha guardado.'; return; }
      if (!guardarClave(k)) { estado.textContent = 'No se ha podido guardar: el navegador no lo permite.'; return; }
      campo.value = '';   // la clave ya no se queda escrita en la página
      pintarEstado();
      mensaje('fervis', 'Clave guardada ✓ (' + enmascarar(k) + '). Todavía no la uso: la conexión con Groq llega en el siguiente paso.');
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
