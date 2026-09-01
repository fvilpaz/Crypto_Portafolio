// Proxy a CoinGecko en el servidor de Netlify.
//
// Por qué existe: la API pública gratuita de CoinGecko limita por IP (HTTP 429).
// En el móvil a veces sales por una IP de operadora ya capada → los precios no
// cargan. Este proxy es SOLO el respaldo: el frontend intenta primero CoinGecko
// directo (como en local) y cae aquí si salta el 429. No cacheamos nada para
// que los precios sean siempre frescos.

const BASE = 'https://api.coingecko.com/api/v3';

// CoinGecko+ la API gratuita limita por IP; un 429 momentáneo es normal. Un par
// de reintentos con backoff evita que el móvil (que cae aquí cuando su IP baja
// capada) se quede sin precios por un rate limit transitorio.
async function fetchWithRetry(url, intentos = 2) {
  for (let i = 0; i <= intentos; i++) {
    const res = await fetch(url);
    if (res.status !== 429 || i === intentos) return res;
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
}

exports.handler = async (event) => {
  const { type, ids } = event.queryStringParameters || {};
  if (!ids) {
    return { statusCode: 400, body: 'Falta el parámetro "ids"' };
  }

  const encoded = encodeURIComponent(ids);
  const url = type === 'markets'
    ? `${BASE}/coins/markets?vs_currency=usd&ids=${encoded}&sparkline=true&price_change_percentage=24h`
    : `${BASE}/simple/price?ids=${encoded}&vs_currencies=usd&include_24hr_change=true`;

  try {
    const res = await fetchWithRetry(url);
    const body = await res.text();
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        // no-store: los precios deben llegar frescos SIEMPRE, igual que la
        // llamada directa a CoinGecko en local. No cacheamos en el CDN (antes
        // s-maxage=60 servía precios de hace un minuto y el fallback mezclaba
        // precio de compra, dando totales equivocados).
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    };
  } catch (err) {
    return { statusCode: 502, body: `Error al contactar CoinGecko: ${err.message}` };
  }
};
