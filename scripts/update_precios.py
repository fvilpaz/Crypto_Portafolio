"""Baja de Twelve Data el precio de las acciones/ETF de data/acciones.json y lo guarda en data/precios.json.

Uso:  TWELVE_DATA_KEY=... python scripts/update_precios.py [lista.json] [salida.json]
La clave solo va como variable de entorno (en GitHub, el secreto TWELVE_DATA_KEY); nunca se escribe ni se imprime.

Limites del plan gratuito (twelvedata.com/pricing): 8 creditos por minuto y 800 al dia; /quote cuesta 1 credito por simbolo.
Por eso: UNA llamada por simbolo, una cada PAUSA segundos (6 por minuto), como mucho MAX_SIMBOLOS por ejecucion y, si la API
responde 429, se para en seco (sin reintentar) y se conservan los precios anteriores. Con las 8 ejecuciones al dia de la Action son
como mucho 8 x MAX_SIMBOLOS = 320 creditos. El plan gratuito lista acciones y ETF de EE. UU.; los europeos (p. ej. VUAA) pueden
fallar: su error queda en "errores" y la app los sigue valorando a precio de compra. No se inventa ningun precio.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LISTA = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "data" / "acciones.json"
SALIDA = Path(sys.argv[2]) if len(sys.argv) > 2 else RAIZ / "data" / "precios.json"
PAUSA = int(os.environ.get("PAUSA_SEGUNDOS", "10"))   # segundos entre llamadas (8 creditos/minuto: 10 s = 6 por minuto)
MAX_SIMBOLOS = 40
API = "https://api.twelvedata.com/quote"


def cargar_lista():
    """data/acciones.json: {"simbolos": ["NVDA", {"symbol": "VUAA", "exchange": "LSE"}, ...]}"""
    datos = json.loads(LISTA.read_text(encoding="utf8"))
    vistos, lista = set(), []
    for x in datos.get("simbolos", []):
        it = x if isinstance(x, dict) else {"symbol": x}
        sim = str(it.get("symbol", "")).strip().upper()
        if sim and sim not in vistos:
            vistos.add(sim)
            lista.append({"symbol": sim, "exchange": it.get("exchange")})
    return lista


def quote(simbolo, exchange, clave):
    """Una llamada = 1 credito. Devuelve (codigo, cuerpo); codigo es None si todo fue bien."""
    q = {"symbol": simbolo, "apikey": clave}
    if exchange:
        q["exchange"] = exchange
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "Crypto_Portafolio"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            cuerpo = json.loads(r.read())
            estado = r.status
    except urllib.error.HTTPError as e:
        estado = e.code
        try:
            cuerpo = json.loads(e.read())
        except Exception:
            cuerpo = {}
    codigo = cuerpo.get("code") or (estado if estado != 200 else None)
    return codigo, cuerpo


def main():
    clave = os.environ.get("TWELVE_DATA_KEY", "").strip()
    if not clave:
        print("Falta TWELVE_DATA_KEY: no se actualizan los precios.")
        return 0
    lista = cargar_lista()
    if not lista:
        print("data/acciones.json no tiene simbolos: nada que hacer.")
        return 0
    if len(lista) > MAX_SIMBOLOS:
        print(f"ERROR: {len(lista)} simbolos; el maximo por ejecucion es {MAX_SIMBOLOS} (para no gastar el limite diario).", file=sys.stderr)
        return 1

    simbolos = {it["symbol"] for it in lista}
    try:
        previo = json.loads(SALIDA.read_text(encoding="utf8")).get("precios", {})
    except Exception:
        previo = {}
    precios = {s: v for s, v in previo.items() if s in simbolos}   # lo que falle ahora conserva su precio (y su fecha) anterior
    errores, nuevos = {}, 0
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for i, it in enumerate(lista):
        if i:
            time.sleep(PAUSA)
        sim = it["symbol"]
        codigo, d = quote(sim, it["exchange"], clave)
        if codigo == 429:
            errores[sim] = "429: limite de la API alcanzado; se para aqui"
            print("Limite de la API alcanzado (429): se para sin reintentar.", file=sys.stderr)
            break
        if codigo:
            errores[sim] = f"{codigo}: {str(d.get('message', ''))[:140]}".replace(clave, "***")
            print(f"FALLO {sim}: {errores[sim]}", file=sys.stderr)
            continue
        try:
            precios[sim] = {"price": float(d["close"]), "change": float(d.get("percent_change") or 0), "currency": d.get("currency"),
                            "exchange": d.get("exchange"), "ts": ahora}
            nuevos += 1
            print(f"OK {sim}: {precios[sim]['price']} {precios[sim]['currency']}")
        except (KeyError, TypeError, ValueError):
            errores[sim] = "respuesta sin precio"
            print(f"FALLO {sim}: respuesta sin precio", file=sys.stderr)

    if nuevos == 0:
        print("Ningun precio nuevo: se conserva el archivo anterior.", file=sys.stderr)
        return 1
    SALIDA.write_text(json.dumps({"updated": ahora, "fuente": "Twelve Data", "precios": precios, "errores": errores}, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
