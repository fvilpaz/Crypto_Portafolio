/* Moneda de la simulacion: lee el MISMO estado que la app (selector #currency-code y el cambio
   guardado en miCartera.rate.v1, en euros por dolar), asi € y $ siguen funcionando igual.
   Formato identico al fmtCurrency de app.js: 2 decimales, "$1,234.50" o "1,234.50 €". */
window.mkFx = (function () {
  const num = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fx = {
    cur: () => (document.getElementById('currency-code')?.textContent.trim() === 'EUR' ? 'EUR' : 'USD'),
    eurPerUsd: () => parseFloat(localStorage.getItem('miCartera.rate.v1')) || 0.85,
    fmt: (n) => (fx.cur() === 'EUR' ? num(n) + ' €' : '$' + num(n)),
    toCur: (usd) => (fx.cur() === 'EUR' ? usd * fx.eurPerUsd() : usd),
    fromUsd: (usd) => fx.fmt(fx.toCur(usd)),
    fromEur: (eur) => fx.fmt(fx.cur() === 'EUR' ? eur : eur / fx.eurPerUsd()),
    onChange(fn) {   // se avisa cuando el usuario cambia € / $
      const el = document.getElementById('currency-code');
      if (el) new MutationObserver(fn).observe(el, { childList: true, characterData: true, subtree: true });
    },
  };
  return fx;
})();
