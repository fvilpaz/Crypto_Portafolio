/* Modelo jerárquico de la cartera: lado (crypto / bolsa) → cubo (crypto: núcleo, satélites, refugio; bolsa: núcleo, satélites) → posición.
   UNA sola base (todo lo invertido) y UNA sola función de cálculo: la pantalla (tarjetas, reparto del mes, proyección)
   solo lee su resultado. Así no hay varios sitios que midan con bases distintas y acaben chocando. */
(function (raiz) {
  const LADOS = ['crypto', 'bolsa'];
  const CUBOS = ['nucleo', 'satelites', 'refugio'];
  // En bolsa no hay refugio: un refugio en efectivo seria en dolares y la inflacion se lo come (decision de Nando).
  const CUBOS_POR_LADO = { crypto: CUBOS, bolsa: ['nucleo', 'satelites'] };
  const suma = (xs) => xs.reduce((a, b) => a + b, 0);

  // Reparte `dinero` entre hojas según lo que le falta a cada una para su objetivo tras aportar (el mecanismo de la
  // plantilla "objetivos" de la app): la que está más lejos recibe más; si todas llegan, se reparte por objetivo.
  function repartirPorHuecos(valores, objetivos, dinero, total) {
    if (dinero <= 0) return objetivos.map(() => 0);
    const despues = total + dinero;
    const huecos = objetivos.map((t, i) => Math.max(t * despues - valores[i], 0));
    const g = suma(huecos);
    return objetivos.map((t, i) => (g >= dinero ? dinero * huecos[i] / g : huecos[i] + (dinero - g) * t));
  }

  // Normaliza unos pesos a fracciones que suman 1 (y avisa si no sumaban 100).
  function normalizar(pesos, nombre, avisos, cubos) {
    const s = suma(cubos.map((c) => pesos[c] || 0));
    if (Math.abs(s - 100) > 0.05) avisos.push(`${nombre}: los pesos suman ${+s.toFixed(1)} %, no 100 %; se escalan.`);
    return cubos.map((c) => (s > 0 ? (pesos[c] || 0) / s : 1 / cubos.length));
  }

  /* p = { mensual, ratioCrypto (0-100), pesos: {crypto:{nucleo,satelites,refugio}, bolsa:{...}} (% dentro de cada lado),
           valores: {crypto:{nucleo,...}, bolsa:{...}} (lo que hay hoy, en la moneda de `mensual`) } */
  function modelo(p) {
    const avisos = [];
    const r = Math.min(Math.max(p.ratioCrypto, 0), 100) / 100;
    const ratio = { crypto: r, bolsa: 1 - r };
    const hojas = [];
    LADOS.forEach((lado) => {
      const cubos = CUBOS_POR_LADO[lado];
      const w = normalizar(p.pesos[lado], lado === 'crypto' ? 'Dentro de crypto' : 'Dentro de bolsa', avisos, cubos);
      cubos.forEach((cubo, i) => hojas.push({ lado, cubo, objetivo: ratio[lado] * w[i], valor: p.valores[lado][cubo] || 0 }));
    });
    // El total de cada lado es el de TODA la cartera de ese lado (p.totalReal), no la suma de sus cubos: una moneda que no es núcleo, satélite
    // ni refugio sigue siendo tuya y cuenta, aunque el modelo no sepa en qué cubo recomendar comprarla (hallazgo de Nando, 9-nov-2026). Si
    // falta p.totalReal (código viejo que llame a modelo() sin pasarlo), se cae a sumar los cubos, como antes.
    const valorLado = {};
    LADOS.forEach((l) => { valorLado[l] = (p.totalReal && p.totalReal[l] != null) ? p.totalReal[l] : suma(hojas.filter((h) => h.lado === l).map((h) => h.valor)); });
    const total = suma(LADOS.map((l) => valorLado[l]));
    const recLado = repartirPorHuecos(LADOS.map((l) => valorLado[l]), LADOS.map((l) => ratio[l]), p.mensual, total);
    LADOS.forEach((lado, k) => {
      const hs = hojas.filter((h) => h.lado === lado);
      const w = hs.map((h) => (ratio[lado] > 0 ? h.objetivo / ratio[lado] : 1 / hs.length));   // peso dentro del lado
      repartirPorHuecos(hs.map((h) => h.valor), w, recLado[k], valorLado[lado]).forEach((x, i) => { hs[i].rec = x; });
    });
    hojas.forEach((h) => {
      h.peso = total > 0 ? h.valor / total : 0;
      // lo que habría que comprar SOLO de este cubo para que su peso llegue al objetivo (como "Faltan" de la tarjeta Refugio)
      h.falta = h.objetivo > 0 && h.objetivo < 1 ? Math.max((h.objetivo * total - h.valor) / (1 - h.objetivo), 0) : 0;
    });
    const lados = {};
    LADOS.forEach((lado) => {
      const hs = hojas.filter((h) => h.lado === lado);
      const valor = valorLado[lado];   // el real (toda la cartera de ese lado), no la suma de cubos: así coincide con los chips Crypto/Bolsa
      lados[lado] = { valor, peso: total > 0 ? valor / total : 0, objetivo: ratio[lado], rec: suma(hs.map((h) => h.rec)), cubos: hs };
    });
    return { total, mensual: p.mensual, lados, hojas, avisos };
  }

  // Proyección mes a mes con el mismo reparto (sin variaciones de precio): pesos de cada lado a 12 y 24 meses y el mes en que
  // el reparto entre crypto y bolsa llega al ratio (con una décima de punto de margen). null si no llega en 20 años.
  function proyeccion(p, meses) {
    const valores = JSON.parse(JSON.stringify(p.valores));
    // El total real de cada lado (p.totalReal) también crece mes a mes, lo mismo que crecen sus cubos (m.lados[l].rec): si no, el total se quedaría
    // fijo en el de hoy mientras los cubos suben con la simulación, y acabaría siendo menor que la suma de sus propios cubos. Sin monedas sin
    // cubo, totalReal arranca igual que la suma de hojas y crece igual, así que el resultado no cambia (mismo comportamiento que antes).
    const totalReal = p.totalReal ? { ...p.totalReal } : null;
    const resultado = { pesos: {}, llega: null };
    const cerca = (m) => Math.abs(m.lados.crypto.peso - m.lados.crypto.objetivo) <= 0.001;
    if (cerca(modelo({ ...p, valores, totalReal }))) resultado.llega = 0;
    for (let mes = 1; mes <= 240; mes++) {
      const m = modelo({ ...p, valores, totalReal });
      m.hojas.forEach((h) => { valores[h.lado][h.cubo] += h.rec; });
      if (totalReal) LADOS.forEach((l) => { totalReal[l] += m.lados[l].rec; });
      const despues = modelo({ ...p, valores, mensual: 0, totalReal });
      if (resultado.llega === null && cerca(despues)) resultado.llega = mes;
      if (meses.indexOf(mes) >= 0) resultado.pesos[mes] = { crypto: despues.lados.crypto.peso, bolsa: despues.lados.bolsa.peso };
    }
    return resultado;
  }

  const api = { LADOS, CUBOS, CUBOS_POR_LADO, modelo, proyeccion, repartirPorHuecos };
  if (typeof module !== 'undefined') module.exports = api; else raiz.Plan = api;
})(typeof window !== 'undefined' ? window : globalThis);
