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
