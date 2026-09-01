// Sincronización de la cartera entre dispositivos.
//
// La cartera (portfolio + movimientos) se guarda en Netlify Blobs (un "archivo"
// en la nube del site). TODOS los navegadores leen y escriben el MISMO blob, así
// que lo que editas en el móvil aparece al instante en el portátil y en local.
// El localStorage de cada navegador queda solo como copia offline.
//
// Regla de conflicto: gana la versión más actualizada (campo updatedAt).
//
// Autenticación simple: se exige un token compartido (mismo valor que en
// js/config.js). Vive en el frontend, así que solo evita que un extraño lea o
// sobrescriba tus datos por casualidad — no es seguridad real.
const { getStore } = require('@netlify/blobs');

const SYNC_TOKEN = 'tok_micartera_N3f9kQ2vXa8pR7dL';
const store = getStore('cartera');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-token',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

exports.handler = async (event) => {
  // Preflight CORS va SIN token (el navegador no lo manda en OPTIONS).
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const token = event.headers['x-sync-token'];
  if (token !== SYNC_TOKEN) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token no válido' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const raw = await store.get('cartera');
      if (!raw) return { statusCode: 200, headers, body: JSON.stringify({ empty: true }) };
      return { statusCode: 200, headers, body: raw };
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      if (!Array.isArray(body.portfolio) || !Array.isArray(body.transactions)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Formato no válido' }) };
      }
      await store.set('cartera', JSON.stringify(body));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};