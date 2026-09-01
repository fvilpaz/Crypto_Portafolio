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
// CONFIG — Sincronización en la nube
//
// Token compartido con la función netlify/functions/sync.js. Evita que
// un extraño lea o sobrescriba tu cartera por casualidad. Vive en el
// frontend (JS visible), así que NO es seguridad real.
// ═════════════════════════════════════════════════════════════════
const SYNC_TOKEN = 'tok_micartera_N3f9kQ2vXa8pR7dL';