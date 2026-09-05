// ═════════════════════════════════════════════════════════════════
// CONFIG — API de precios
//
// Pega aquí tu API key de CoinGecko y la app la usará llamando
// DIRECTAMENTE desde el navegador (su API con key entiende CORS), sin
// depender del proxy de Netlify.
//
//  - Key de demostración (gratis, 30 req/min): COINGECKO_API_PARAM = 'x_cg_demo_api_key'
//  - Key de pago (Pro):                        COINGECKO_API_PARAM = 'x_cg_pro_api_key'
//
// Aviso: una key puesta aquí es visible para cualquiera que abra tu web
// (vive en el frontend). Usa una demo o una con límite bajo.
// ═════════════════════════════════════════════════════════════════
const COINGECKO_API_KEY = 'CG-dS5gDGZESCtRDctynZwxfDfu';
const COINGECKO_API_PARAM = 'x_cg_demo_api_key';

// ═════════════════════════════════════════════════════════════════
// FUENTES DE RESPALDO (sin API key, CORS abierto, sin límites prácticos)
//
// CoinGecko sigue siendo la fuente primaria. Si falla (429, token no
// listado, red) se rellena moneda a moneda desde estas fuentes, en
// este orden:
//   binance → api.binance.com  (las grandes)
//   okx     → www.okx.com      (p.ej. PI Network)
//   llama   → coins.llama.fi   (agregador DEX; cubre hasta ATOMONE/MODE)
//
// Si ninguna fuente responde, se usa el último snapshot guardado en
// localStorage (hasta 20 min), que se sobrescribe en cada tick bueno.
// ═════════════════════════════════════════════════════════════════
const PRICE_SOURCES = {
  BTC:     { binance: 'BTCUSDT',  okx: 'BTC-USDT',  llama: 'bitcoin' },
  ETH:     { binance: 'ETHUSDT',  okx: 'ETH-USDT',  llama: 'ethereum' },
  SOL:     { binance: 'SOLUSDT',  okx: 'SOL-USDT',  llama: 'solana' },
  ATOM:    { binance: 'ATOMUSDT', okx: 'ATOM-USDT', llama: 'cosmos' },
  TIA:     { binance: 'TIAUSDT',  okx: 'TIA-USDT',  llama: 'celestia' },
  USDC:    { binance: 'USDCUSDT', okx: 'USDC-USDT', llama: 'usd-coin' },
  PI:      { binance: null,       okx: 'PI-USDT',   llama: 'pi-network' },
  ATOMONE: { binance: null,       okx: null,        llama: 'atomone' },
  ATONE:   { binance: null,       okx: null,        llama: 'atomone' },
  MODE:    { binance: null,       okx: null,        llama: 'mode' },
};