/* Pestañas laterales (Fervis IA y Añadir): al pulsar una, se deshace y sale su icono; pulsar el icono abre su acción (el «+» abre añadir, el robot abre el chat).
   Se vuelven a esconder a los 4 s o al tocar fuera. Va en fase de captura para quedarse con el primer toque y que no llegue a la acción. */
(function () {
  const pestanas = [...document.querySelectorAll('.pestana')];
  if (!pestanas.length) return;
  const cerrar = () => pestanas.forEach((p) => { p.classList.remove('abierto'); clearTimeout(p._t); });
  pestanas.forEach((p) => p.addEventListener('click', (e) => {
    if (p.classList.contains('abierto')) { cerrar(); return; }   // segundo toque, sobre el icono: deja pasar la acción
    e.preventDefault(); e.stopImmediatePropagation();
    cerrar(); p.classList.add('abierto'); p._t = setTimeout(cerrar, 4000);
  }, true));
  document.addEventListener('click', (e) => { if (!e.target.closest('.pestana')) cerrar(); });
})();
