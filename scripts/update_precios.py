"""Baja el precio de las acciones/ETF de data/acciones.json y lo guarda en data/precios.json.

Uso:  [TWELVE_DATA_KEY=...] python scripts/update_precios.py [lista.json] [salida.json]

Fuente principal: el grafico publico de Yahoo Finance (sin clave, sin creditos): vale para cualquier simbolo de EE. UU. (NVDA, SHEL, BRK.B...) y
para los europeos con su sufijo ("yahoo": "VUAA.DE" = Xetra, en euros, como en Revolut). Por eso la lista puede ser larga (cientos de simbolos).
Respaldo: si Yahoo no da un simbolo y hay TWELVE_DATA_KEY (secreto de GitHub, nunca escrito ni impreso), se prueba con Twelve Data. Limites del plan
gratuito de Twelve Data (twelvedata.com/pricing): 8 creditos por minuto y 800 al dia; /quote cuesta 1 credito por simbolo. Por eso el respaldo hace
UNA llamada por simbolo cada PAUSA segundos, como mucho MAX_TWELVE por ejecucion, y si responde 429 se para en seco (sin reintentar).
Lo que no se consiga queda en "errores" y conserva su ultimo precio bueno; no se inventa ningun precio.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LISTA = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "data" / "acciones.json"
SALIDA = Path(sys.argv[2]) if len(sys.argv) > 2 else RAIZ / "data" / "precios.json"
PAUSA = int(os.environ.get("PAUSA_SEGUNDOS", "10"))   # segundos entre llamadas a Twelve Data (8 creditos/minuto: 10 s = 6 por minuto)
PAUSA_YAHOO = float(os.environ.get("PAUSA_YAHOO", "0.7"))
MAX_SIMBOLOS = 400
MAX_TWELVE = 40
API = "https://api.twelvedata.com/quote"


def cargar_lista():
    """data/acciones.json: {"simbolos": ["NVDA", {"symbol": "VUAA", "yahoo": "VUAA.DE"}, {"symbol": "X", "exchange": "LSE"}, ...]}"""
    datos = json.loads(LISTA.read_text(encoding="utf8"))
    vistos, lista = set(), []
    for x in datos.get("simbolos", []):
        it = x if isinstance(x, dict) else {"symbol": x}
        sim = str(it.get("symbol", "")).strip().upper()
        if sim and sim not in vistos:
            vistos.add(sim)
            lista.append({"symbol": sim, "exchange": it.get("exchange"), "yahoo": it.get("yahoo") or sim.replace(".", "-")})   # BRK.B es BRK-B en Yahoo
    return lista


def media(c, n):
    """Media movil simple de los ultimos n cierres (None si no hay tantos)."""
    return sum(c[-n:]) / n if len(c) >= n else None


def rsi(c, n=14):
    """RSI de Wilder a n periodos (0-100): fuerza de las subidas frente a las bajadas recientes."""
    if len(c) < n + 1:
        return None
    g = sum(max(c[i] - c[i - 1], 0) for i in range(1, n + 1)) / n
    p = sum(max(c[i - 1] - c[i], 0) for i in range(1, n + 1)) / n
    for i in range(n + 1, len(c)):
        g = (g * (n - 1) + max(c[i] - c[i - 1], 0)) / n
        p = (p * (n - 1) + max(c[i - 1] - c[i], 0)) / n
    return 100.0 if p == 0 else 100 - 100 / (1 + g / p)


def yahoo(ticker):
    """Precio desde el grafico publico de Yahoo Finance. Devuelve (error, datos); error es None si todo fue bien."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}?interval=1d&range=1y"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read())["chart"]["result"][0]
        m = res["meta"]
        cierres = [x for x in (res.get("indicators", {}).get("quote") or [{}])[0].get("close", []) if x is not None]   # un año de cierres diarios
        precio = float(m["regularMarketPrice"])
        previo = float(cierres[-2]) if len(cierres) >= 2 else float(m.get("chartPreviousClose") or 0)   # con rango de 1 año chartPreviousClose es el del primer dia del rango
        tecnico = {"sma50": media(cierres, 50), "sma200": media(cierres, 200), "rsi14": rsi(cierres), "serie": [round(x, 2) for x in cierres[::-5][::-1][-52:]] if len(cierres) >= 20 else None}
        tecnico = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in tecnico.items() if v is not None}
        extra = {k: m.get(src) for k, src in (("dia_min", "regularMarketDayLow"), ("dia_max", "regularMarketDayHigh"), ("volumen", "regularMarketVolume"),
                                              ("min_52s", "fiftyTwoWeekLow"), ("max_52s", "fiftyTwoWeekHigh")) if isinstance(m.get(src), (int, float))}   # datos tecnicos del propio grafico
        return None, {"close": precio, "percent_change": (precio / previo - 1) * 100 if previo > 0 else 0, "currency": m.get("currency"), "exchange": m.get("exchangeName"), **extra, **tecnico}
    except urllib.error.HTTPError as e:
        return f"{e.code}: Yahoo no dio el precio de {ticker}", None
    except Exception as e:
        return f"Yahoo {ticker}: {str(e)[:100]}", None


def quote(simbolo, exchange, clave):
    """Twelve Data: una llamada = 1 credito. Devuelve (codigo, cuerpo); codigo es None si todo fue bien."""
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
    clave = os.environ.get("TWELVE_DATA_KEY", "").strip()   # opcional: solo para el respaldo
    lista = cargar_lista()
    if not lista:
        print("data/acciones.json no tiene simbolos: nada que hacer.")
        return 0
    if len(lista) > MAX_SIMBOLOS:
        print(f"ERROR: {len(lista)} simbolos; el maximo por ejecucion es {MAX_SIMBOLOS}.", file=sys.stderr)
        return 1

    simbolos = {it["symbol"] for it in lista}
    try:
        anterior = json.loads(SALIDA.read_text(encoding="utf8"))
    except Exception:
        anterior = {}
    previo = anterior.get("precios", {})
    precios = {s: v for s, v in previo.items() if s in simbolos}   # lo que falle ahora conserva su precio (y su fecha) anterior
    errores, nuevos, usados_twelve, parar_twelve = {}, 0, 0, False
    SALIDA_TEC = SALIDA.with_name("tecnico.json")   # medias, RSI y serie de un año: cambian poco en el dia, asi que no se reescriben cada 2 horas
    try:
        tec_anterior = json.loads(SALIDA_TEC.read_text(encoding="utf8"))
    except Exception:
        tec_anterior = {}
    tecnico = {s: v for s, v in tec_anterior.get("simbolos", {}).items() if s in simbolos}
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for it in lista:
        sim = it["symbol"]
        err, d = yahoo(it["yahoo"])
        time.sleep(PAUSA_YAHOO)
        fuente = "Yahoo"
        if err and clave and not parar_twelve and usados_twelve < MAX_TWELVE:   # respaldo
            if usados_twelve:
                time.sleep(PAUSA)
            usados_twelve += 1
            codigo, d2 = quote(sim, it["exchange"], clave)
            if codigo == 429:
                parar_twelve = True
                err = "429: limite de Twelve Data alcanzado; sin mas respaldos en esta ejecucion"
                print("Limite de Twelve Data alcanzado (429): sin mas respaldos.", file=sys.stderr)
            elif codigo:
                err = f"{err} | Twelve Data {codigo}: {str(d2.get('message', ''))[:100]}".replace(clave, "***")
            else:
                try:
                    d, err, fuente = {"close": float(d2["close"]), "percent_change": float(d2.get("percent_change") or 0), "currency": d2.get("currency"),
                                      "exchange": d2.get("exchange")}, None, "Twelve Data"
                except (KeyError, TypeError, ValueError):
                    err = f"{err} | Twelve Data: respuesta sin precio"
        if err:
            errores[sim] = err
            print(f"FALLO {sim}: {err}", file=sys.stderr)
            continue
        precios[sim] = {"price": d["close"], "change": d["percent_change"], "currency": d["currency"], "exchange": d["exchange"], "ts": ahora,
                        **{k: d[k] for k in ("dia_min", "dia_max", "volumen", "min_52s", "max_52s") if k in d}}
        tec = {k: d[k] for k in ("sma50", "sma200", "rsi14", "serie") if k in d}
        if tec:
            tecnico[sim] = tec
        nuevos += 1
        print(f"OK {sim} ({fuente}): {d['close']} {d['currency']}")

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
    SALIDA.write_text(json.dumps({"updated": ahora, "fuente": "Yahoo Finance (respaldo: Twelve Data)", "precios": precios, "errores": errores}, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    try:
        tec_reciente = (datetime.now(timezone.utc) - datetime.fromisoformat(tec_anterior["updated"])).total_seconds() < 20 * 3600
    except Exception:
        tec_reciente = False
    if tecnico and not (tec_reciente and set(tecnico) == set(tec_anterior.get("simbolos", {}))):
        SALIDA_TEC.write_text(json.dumps({"updated": ahora, "fuente": "Calculado con un año de cierres diarios de Yahoo Finance", "simbolos": tecnico}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
