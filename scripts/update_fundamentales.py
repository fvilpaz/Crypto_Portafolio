"""Baja de la SEC (datos XBRL oficiales de los informes 10-K y 10-Q) los fundamentales de las empresas de EE. UU. de data/acciones.json y los guarda en
data/fundamentales.json: acciones en circulacion, ingresos, beneficio neto y beneficio por accion del ultimo ejercicio fiscal.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_fundamentales.py
La SEC exige un contacto en el User-Agent (va por variable de entorno, como en update_13f.py). La capitalizacion (acciones x precio) y el PER (precio / beneficio por
accion) NO se guardan: la app las calcula con el precio del momento. Solo hay datos de quien presenta 10-K a la SEC: los ETF y las empresas extranjeras (SHEL, TSM...)
no salen y la app muestra "sin datos". Si una empresa tiene varias clases de acciones (Alphabet), las acciones se toman de la media ponderada del ejercicio (aproximado).
"""
import http.cookiejar, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "data"
UA = os.environ.get("SEC_USER_AGENT")   # opcional: solo para el respaldo de la SEC (empresas americanas que Yahoo no tenga)


def sesion_yahoo():
    """Yahoo pide una cookie y un 'crumb' para su resumen de empresa: se consiguen sin clave abriendo fc.yahoo.com y pidiendo el crumb con esa cookie."""
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    op.addheaders = [("User-Agent", "Mozilla/5.0")]
    try:
        op.open("https://fc.yahoo.com", timeout=20)   # responde 404 pero deja la cookie
    except Exception:
        pass
    return op, op.open("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=20).read().decode()


def resumen_yahoo(op, crumb, ticker):
    """Capitalizacion, PER y BPA de los ultimos 12 meses, ingresos, beneficio, margen y dividendo de una empresa (o None si Yahoo no los da: fondos, ETF...)."""
    url = ("https://query1.finance.yahoo.com/v10/finance/quoteSummary/" + urllib.parse.quote(ticker)
           + "?modules=price,summaryDetail,defaultKeyStatistics,financialData&crumb=" + urllib.parse.quote(crumb))
    r = json.loads(op.open(url, timeout=30).read())["quoteSummary"]["result"][0]
    raw = lambda m, k: (r.get(m, {}).get(k) or {}).get("raw")
    e = {"cap": raw("price", "marketCap"), "per": raw("summaryDetail", "trailingPE"), "bpa": raw("defaultKeyStatistics", "trailingEps"), "ingresos": raw("financialData", "totalRevenue"),
         "beneficio": raw("defaultKeyStatistics", "netIncomeToCommon"), "margen": raw("financialData", "profitMargins"), "dividendo": raw("summaryDetail", "dividendYield"),
         "moneda": r.get("price", {}).get("currency"), "moneda_fin": r.get("financialData", {}).get("financialCurrency")}
    e = {k: v for k, v in e.items() if v is not None}
    return e if any(k in e for k in ("cap", "per", "bpa", "ingresos")) else None


def get(url):
    if not UA:
        raise RuntimeError("sin SEC_USER_AGENT")
    time.sleep(0.25)   # la SEC pide no pasar de 10 peticiones por segundo
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return json.loads(r.read())


def hecho(cik, taxonomia, concepto):
    """Entradas del concepto, o [] si la empresa no lo declara (la SEC responde 404)."""
    try:
        d = get(f"https://data.sec.gov/api/xbrl/companyconcept/CIK{cik}/{taxonomia}/{concepto}.json")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise
    return next(iter(d["units"].values()), [])


def ultimo_ejercicio(entradas):
    """El dato anual (10-K, ejercicio de ~12 meses) mas reciente, como (fecha de cierre, valor)."""
    anuales = []
    for x in entradas:
        if x.get("form") not in ("10-K", "10-K/A") or x.get("fp") != "FY" or "start" not in x:
            continue
        dias = (datetime.fromisoformat(x["end"]) - datetime.fromisoformat(x["start"])).days
        if 330 <= dias <= 380:
            anuales.append((x["end"], x["val"]))
    return max(anuales) if anuales else None


def mejor(cik, taxonomia, conceptos):
    """De varios nombres posibles del mismo dato (cada empresa usa uno), el ejercicio anual mas reciente: (fecha de cierre, valor)."""
    hallados = [r for r in (ultimo_ejercicio(hecho(cik, taxonomia, c)) for c in conceptos) if r]
    return max(hallados) if hallados else None


def acciones_en_circulacion(cik):
    """Acciones de la portada del ultimo informe. Con varias clases de acciones (Alphabet, Berkshire, Visa) la portada da una cifra por clase y no se puede sumar
    a ciegas: se usa la media ponderada del ejercicio (aproximada). Devuelve (fecha, valor, aproximada)."""
    entradas = hecho(cik, "dei", "EntityCommonStockSharesOutstanding")
    if entradas:
        ultima = max(x["end"] for x in entradas)
        valores = {x["val"] for x in entradas if x["end"] == ultima}
        if len(valores) == 1 and (datetime.now(timezone.utc).date() - datetime.fromisoformat(ultima).date()).days < 400:
            return ultima, valores.pop(), False
    media = mejor(cik, "us-gaap", ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"])
    if media and (datetime.now(timezone.utc).date() - datetime.fromisoformat(media[0]).date()).days < 400:   # una media de hace años (Berkshire: 2014) no vale para la capitalizacion de hoy
        return media[0], media[1], True
    return None


def main():
    lista = json.loads((DATOS / "acciones.json").read_text(encoding="utf8"))["simbolos"]
    try:
        lista = lista + json.loads((DATOS / "acciones_13f.json").read_text(encoding="utf8")).get("simbolos", [])   # mayores posiciones de los inversores de Mercado
    except (OSError, ValueError):
        pass
    simbolos = [(x if isinstance(x, str) else x["symbol"]).upper() for x in lista if isinstance(x, str) or not x.get("yahoo")]   # sin los europeos con sufijo
    hoy = datetime.now(timezone.utc).date()
    empresas, sin_datos = {}, []
    # 1) Yahoo para TODAS las empresas de la lista (americanas y de fuera): el ticker de Yahoo es el 'yahoo' de la entrada o el simbolo con - en vez de .
    yahoo_de = {}
    for x in lista:
        s = (x if isinstance(x, str) else x["symbol"]).upper()
        if not s.startswith("0P"):   # los fondos (0P...) no tienen estos datos
            yahoo_de.setdefault(s, (x.get("yahoo") if isinstance(x, dict) else None) or s.replace(".", "-"))
    try:
        op, crumb = sesion_yahoo()
        for s, t in yahoo_de.items():
            time.sleep(0.35)
            try:
                e = resumen_yahoo(op, crumb, t)
            except urllib.error.HTTPError as ex:
                if ex.code == 401:   # el crumb caduco: se pide otro una vez
                    op, crumb = sesion_yahoo()
                continue
            except Exception:
                continue
            if e:
                e["fuente"] = "Yahoo"
                empresas[s] = e
        print(f"Yahoo: {len(empresas)} de {len(yahoo_de)} empresas con datos")
    except Exception as ex:
        print(f"AVISO Yahoo: {str(ex)[:100]}; se sigue con la SEC", file=sys.stderr)
    # 2) la SEC rellena las americanas que Yahoo no tenga (necesita SEC_USER_AGENT)
    try:
        tickers = get("https://www.sec.gov/files/company_tickers.json")
    except Exception:
        tickers = {}
    cik_de = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in tickers.values()}
    for sim in simbolos:
        if sim in empresas:
            continue   # ya viene de Yahoo
        cik = cik_de.get(sim.replace(".", "-"))
        if not cik:
            sin_datos.append(sim)   # ETF o empresa que no presenta 10-K
            continue
        try:
            ingresos = mejor(cik, "us-gaap", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"])
            beneficio = mejor(cik, "us-gaap", ["NetIncomeLoss", "ProfitLoss"])
            bpa = mejor(cik, "us-gaap", ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"])
            acciones = acciones_en_circulacion(cik)
        except Exception as ex:
            print(f"FALLO {sim}: {str(ex)[:100]}", file=sys.stderr)
            continue
        anuales = [x for x in (ingresos, beneficio, bpa) if x]
        if not anuales:
            sin_datos.append(sim)
            continue
        ref = max(f for f, _ in anuales)   # el ejercicio mas reciente que declara; los datos de ejercicios mucho mas viejos (etiquetas que la empresa dejo de usar) se descartan
        if (hoy - datetime.fromisoformat(ref).date()).days > 730:
            sin_datos.append(sim)
            continue
        vigente = lambda x: x and (datetime.fromisoformat(ref) - datetime.fromisoformat(x[0])).days <= 400
        e = {"cik": cik, "ejercicio_fin": ref, "fuente": "SEC"}
        for clave, x in (("ingresos", ingresos), ("beneficio", beneficio), ("bpa", bpa)):
            if vigente(x):
                e[clave] = x[1]
        if acciones:
            e["acciones_fecha"], e["acciones"], e["acciones_aprox"] = acciones
        empresas[sim] = e
        print(f"OK {sim}: {e}")
    if not empresas:
        print("ERROR: ninguna empresa; se conserva el archivo anterior.", file=sys.stderr)
        return 1
    (DATOS / "fundamentales.json").write_text(json.dumps({"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                                          "fuente": "Yahoo Finance (resumen de empresa) y, para las americanas que falten, SEC EDGAR (XBRL de los 10-K)", "empresas": empresas, "sin_datos": sin_datos},
                                                         ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sin_datos += [s for s in yahoo_de if s not in empresas and s not in sin_datos]
    print(f"{len(empresas)} empresas con datos; {len(sin_datos)} sin datos (ETF, fondos o sin informacion)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
