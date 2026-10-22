"""Baja de EDGAR lo que declaran personas como Elon Musk (que no presentan 13F) y lo guarda en data/insiders.json.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_insiders.py
Dos fuentes de la SEC: los Schedule 13D/13G (quien pasa del 5 % de una empresa: acciones y % de la clase) y los Form 4
(operaciones de directivos y grandes accionistas: se presentan en 2 dias). La SEC exige un contacto en el User-Agent y va por
variable de entorno, como en update_13f.py. Para anadir una persona: una linea en PERSONAS (el CIK sale de EDGAR).
"""
import json, os, sys, time, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

PERSONAS = [{"clave": "musk", "nombre": "Elon Musk", "cik": "0001494730"}]
MAX_13DG, MAX_FORM4, MAX_OPERACIONES = 12, 12, 20
DATOS = Path(__file__).resolve().parent.parent / "data"
UA = os.environ.get("SEC_USER_AGENT")
if not UA:
    sys.exit('Falta SEC_USER_AGENT, p. ej.: SEC_USER_AGENT="Crypto_Portafolio tu@correo.com"')


def get(url):
    time.sleep(0.3)   # la SEC pide no pasar de 10 peticiones por segundo
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return r.read()


def plano(xml):
    """{etiqueta sin espacio de nombres: [textos]} de todo el documento."""
    d = {}
    for e in ET.fromstring(xml).iter():
        if e.text and e.text.strip():
            d.setdefault(e.tag.split("}")[-1], []).append(e.text.strip())
    return d


def doc_xml(cik, acc, doc):
    return get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{doc.split('/')[-1]}")


def numero(d, *claves):
    for k in claves:
        if k in d:
            try:
                return float(d[k][0])
            except ValueError:
                pass
    return None


def participaciones(cik, filings):
    """Ultimo 13D/13G de cada empresa. Los presentados antes de 2025 no son XML y se saltan."""
    vistas, salida = set(), []
    n = 0
    for i, forma in enumerate(filings["form"]):
        if not (forma.startswith("SC 13") or forma.startswith("SCHEDULE 13")) or n >= MAX_13DG:
            continue
        n += 1
        try:
            d = plano(doc_xml(cik, filings["accessionNumber"][i], filings["primaryDocument"][i]))
        except Exception:
            continue
        emisor = (d.get("issuerName") or [""])[0]
        if not emisor or emisor in vistas:
            continue
        vistas.add(emisor)
        salida.append({"emisor": emisor, "formulario": forma, "acciones": numero(d, "reportingPersonBeneficiallyOwnedAggregateNumberOfShares", "aggregateAmountOwned"),
                       "pct": numero(d, "classPercent", "percentOfClass"), "clase": (d.get("securitiesClassTitle") or [""])[0],
                       "presentado": filings["filingDate"][i]})
    return salida


def operaciones(cik, filings):
    """Operaciones de los ultimos Form 4 (acciones ordinarias; los derivados, como opciones, no se cuentan)."""
    filas, n = [], 0
    for i, forma in enumerate(filings["form"]):
        if forma != "4" or n >= MAX_FORM4:
            continue
        n += 1
        try:
            raiz = ET.fromstring(doc_xml(cik, filings["accessionNumber"][i], filings["primaryDocument"][i]))
        except Exception:
            continue
        emisor = (raiz.findtext("issuer/issuerName") or "").strip()
        simbolo = (raiz.findtext("issuer/issuerTradingSymbol") or "").strip()
        for t in raiz.findall("nonDerivativeTable/nonDerivativeTransaction"):
            def v(ruta):
                return (t.findtext(ruta) or "").strip()
            try:
                filas.append({"fecha": v("transactionDate/value"), "emisor": emisor, "simbolo": simbolo, "codigo": v("transactionCoding/transactionCode"),
                              "acciones": float(v("transactionAmounts/transactionShares/value")),
                              "precio": float(v("transactionAmounts/transactionPricePerShare/value") or 0),
                              "tipo": v("transactionAmounts/transactionAcquiredDisposedCode/value"),
                              "tras": float(v("postTransactionAmounts/sharesOwnedFollowingTransaction/value") or 0)})
            except ValueError:
                continue
    filas.sort(key=lambda f: f["fecha"], reverse=True)
    return filas[:MAX_OPERACIONES]


def main():
    personas = []
    for p in PERSONAS:
        filings = json.loads(get(f"https://data.sec.gov/submissions/CIK{p['cik']}.json"))["filings"]["recent"]
        part, ops = participaciones(p["cik"], filings), operaciones(p["cik"], filings)
        if not part and not ops:
            print(f"ERROR {p['nombre']}: sin participaciones ni operaciones; se conserva el archivo anterior.", file=sys.stderr)
            return 1
        personas.append({"clave": p["clave"], "nombre": p["nombre"], "participaciones": part, "operaciones": ops})
        print(f"OK {p['nombre']}: {len(part)} participaciones, {len(ops)} operaciones")
    (DATOS / "insiders.json").write_text(json.dumps({"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "personas": personas}, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
