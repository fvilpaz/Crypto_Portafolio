"""Baja de la SEC (datos XBRL oficiales de los informes 10-K y 10-Q) los fundamentales de las empresas de EE. UU. de data/acciones.json y los guarda en
data/fundamentales.json: acciones en circulacion, ingresos, beneficio neto y beneficio por accion del ultimo ejercicio fiscal.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_fundamentales.py
La SEC exige un contacto en el User-Agent (va por variable de entorno, como en update_13f.py). La capitalizacion (acciones x precio) y el PER (precio / beneficio por
accion) NO se guardan: la app las calcula con el precio del momento. Solo hay datos de quien presenta 10-K a la SEC: los ETF y las empresas extranjeras (SHEL, TSM...)
no salen y la app muestra "sin datos". Si una empresa tiene varias clases de acciones (Alphabet), las acciones se toman de la media ponderada del ejercicio (aproximado).
"""
import json, os, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "data"
UA = os.environ.get("SEC_USER_AGENT")
if not UA:
    sys.exit('Falta SEC_USER_AGENT, p. ej.: SEC_USER_AGENT="Crypto_Portafolio tu@correo.com"')


def get(url):
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
    simbolos = [(x if isinstance(x, str) else x["symbol"]).upper() for x in lista if isinstance(x, str) or not x.get("yahoo")]   # sin los europeos con sufijo
    tickers = get("https://www.sec.gov/files/company_tickers.json")
    cik_de = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in tickers.values()}
    hoy = datetime.now(timezone.utc).date()
    empresas, sin_datos = {}, []
    for sim in simbolos:
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
        e = {"cik": cik, "ejercicio_fin": ref}
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
                                                          "fuente": "SEC EDGAR, datos XBRL de los 10-K y 10-Q", "empresas": empresas, "sin_datos": sin_datos},
                                                         ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(empresas)} empresas con datos; {len(sin_datos)} sin datos (ETF, extranjeras o sin 10-K)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
