// Proxy a CoinGecko en el servidor de Netlify.
//
// Por qué existe: la API pública gratuita de CoinGecko limita por IP (HTTP 429).
// En el móvil sales por la IP compartida de la operadora, que suele estar ya
// capada → los precios nunca cargan. Con este proxy el navegador llama a Netlify
// (no a CoinGecko), así que la IP del cliente deja de importar, y además el CDN
// cachea la respuesta ~60s: aunque abras la app en varios sitios, CoinGecko solo
// recibe ~1 llamada/minuto y no vuelve a saltar el 429.

const BASE = 'https://api.coingecko.com/api/v3';

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
    const res = await fetch(url);
    const body = await res.text();
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        // s-maxage: el CDN de Netlify sirve esta respuesta hasta 60s sin volver
        // a llamar a CoinGecko. max-age=0: el navegador siempre revalida contra
        // el CDN (nunca se queda con una foto vieja como pasaba antes).
        'Cache-Control': 'public, max-age=0, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    };
  } catch (err) {
    return { statusCode: 502, body: `Error al contactar CoinGecko: ${err.message}` };
  }
};
