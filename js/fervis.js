/* Fervis, el asistente de la cartera — PASO 1: solo el botón de la cabecera y un aviso «Próximamente».
   Todavía no hay chat ni IA: el aviso evita que parezca un fallo. Los pasos siguientes (panel del chat, lectura de la cartera de
   este navegador, Groq) irán en este mismo archivo, sin tocar los modales que ya existen. */
(function () {
  const btn = document.getElementById('fervis-btn');
  if (!btn) return;
  let aviso = null, cierre = null;

  function ocultar() {
    clearTimeout(cierre);
    if (aviso) { aviso.remove(); aviso = null; }
    btn.setAttribute('aria-expanded', 'false');
  }

  function mostrar() {
    ocultar();
    aviso = document.createElement('div');
    aviso.id = 'fervis-aviso';
    aviso.className = 'fervis-aviso';
    aviso.setAttribute('role', 'status');
    aviso.textContent = 'Próximamente: Fervis, el asistente de tu cartera. Todavía no responde.';
    btn.parentElement.append(aviso);
    btn.setAttribute('aria-expanded', 'true');
    cierre = setTimeout(ocultar, 5000);   // se cierra solo
  }

  btn.addEventListener('click', (e) => { e.stopPropagation(); if (aviso) ocultar(); else mostrar(); });
  document.addEventListener('click', ocultar);   // tocar fuera lo cierra
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ocultar(); });
})();
