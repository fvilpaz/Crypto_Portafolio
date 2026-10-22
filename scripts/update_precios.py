"""Baja de Twelve Data el precio de las acciones/ETF de data/acciones.json y lo guarda en data/precios.json.

Uso:  TWELVE_DATA_KEY=... python scripts/update_precios.py [lista.json] [salida.json]
La clave solo va como variable de entorno (en GitHub, el secreto TWELVE_DATA_KEY); nunca se escribe ni se imprime.

Limites del plan gratuito (twelvedata.com/pricing): 8 creditos por minuto y 800 al dia; /quote cuesta 1 credito por simbolo.
Por eso: UNA llamada por simbolo, una cada PAUSA segundos (6 por minuto), como mucho MAX_SIMBOLOS por ejecucion y, si la API
responde 429, se para en seco (sin reintentar) y se conservan los precios anteriores. Con las 12 ejecuciones al dia de la Action (una cada 2 h)
son como mucho 12 x MAX_SIMBOLOS = 480 creditos. El plan gratuito lista acciones y ETF de EE. UU.; los europeos (p. ej. VUAA) pueden
fallar: su error queda en "errores" y la app los sigue valorando a precio de compra. No se inventa ningun precio.
Para los europeos (VUAA, SPYL...) un simbolo puede llevar "yahoo": "VUAA.DE" en data/acciones.json: entonces el precio sale del grafico publico de
Yahoo Finance (sin clave ni credito de Twelve Data; coincide con el de Revolut, p. ej. Xetra en euros) y no se llama a Twelve Data para ese simbolo.
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
            lista.append({"symbol": sim, "exchange": it.get("exchange"), "yahoo": it.get("yahoo")})
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


def yahoo(ticker):
    """Precio de un valor europeo desde el grafico publico de Yahoo Finance. Devuelve (error, datos); error es None si todo fue bien."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}?interval=1d&range=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            m = json.loads(r.read())["chart"]["result"][0]["meta"]
        precio, previo = float(m["regularMarketPrice"]), float(m.get("chartPreviousClose") or 0)
        return None, {"close": precio, "percent_change": (precio / previo - 1) * 100 if previo > 0 else 0, "currency": m.get("currency"), "exchange": m.get("exchangeName")}
    except urllib.error.HTTPError as e:
        return f"{e.code}: Yahoo no dio el precio de {ticker}", None
    except Exception as e:
        return f"Yahoo {ticker}: {str(e)[:100]}", None


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
        anterior = json.loads(SALIDA.read_text(encoding="utf8"))
    except Exception:
        anterior = {}
    previo = anterior.get("precios", {})
    precios = {s: v for s, v in previo.items() if s in simbolos}   # lo que falle ahora conserva su precio (y su fecha) anterior
    errores, nuevos = {}, 0
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")

    gasto_previo = False   # la pausa de 10 s solo cuenta entre llamadas a Twelve Data
    for i, it in enumerate(lista):
        sim = it["symbol"]
        if it.get("yahoo"):
            err, d = yahoo(it["yahoo"])
            if err:
                errores[sim] = err
                print(f"FALLO {sim}: {err}", file=sys.stderr)
            else:
                precios[sim] = {"price": d["close"], "change": d["percent_change"], "currency": d["currency"], "exchange": d["exchange"], "ts": ahora}
                nuevos += 1
                print(f"OK {sim} (Yahoo): {d['close']} {d['currency']}")
            time.sleep(1)
            continue
        if gasto_previo:
            time.sleep(PAUSA)
        gasto_previo = True
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
    # Si ningun precio ha cambiado (p. ej. con el mercado cerrado) y el archivo es reciente, no se reescribe: asi no hay commits ni despliegues de mas.
    firma = lambda p: {k: (v.get("price"), v.get("change"), v.get("currency"), v.get("exchange")) for k, v in p.items()}
    try:
        reciente = (datetime.now(timezone.utc) - datetime.fromisoformat(anterior["updated"])).total_seconds() < 20 * 3600
    except Exception:
        reciente = False
    if reciente and firma(precios) == firma(previo) and errores == anterior.get("errores", {}):
        print("Sin cambios en los precios: no se reescribe el archivo.")
        return 0
    SALIDA.write_text(json.dumps({"updated": ahora, "fuente": "Twelve Data y Yahoo Finance", "precios": precios, "errores": errores}, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
