"""Baja de EDGAR los dos ultimos 13F de cada gestor de GESTORES y guarda las 10 mayores posiciones en data/13f_<clave>.json.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_13f.py
La SEC exige un contacto en el User-Agent (sin el, 403); va por variable de entorno para no
dejar el correo escrito en el repo. El 13F es trimestral y llega hasta 45 dias tarde: muestra
lo que tenian, no lo que tienen hoy. Para anadir un gestor: una linea en GESTORES (el CIK sale
de EDGAR) y volver a ejecutar.
"""
import json, os, sys, time, urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

GESTORES = [
    {"clave": "berkshire", "nombre": "Berkshire Hathaway", "cik": "0001067983"},
    {"clave": "bridgewater", "nombre": "Bridgewater Associates", "cik": "0001350694"},
    {"clave": "gates", "nombre": "Gates Foundation Trust", "cik": "0001166559"},
]
DATOS = Path(__file__).resolve().parent.parent / "data"
UA = os.environ.get("SEC_USER_AGENT")
if not UA:
    sys.exit('Falta SEC_USER_AGENT, p. ej.: SEC_USER_AGENT="Crypto_Portafolio tu@correo.com"')


def get(url):
    time.sleep(0.3)   # la SEC pide no pasar de 10 peticiones por segundo
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return r.read()


def posiciones(cik, acc):
    """{emisor: [valor_usd, acciones]} sumando las filas del mismo emisor (Apple sale en 12).
    Comprobado en estos gestores: sin opciones (putCall) ni bonos, todo en acciones (SH)."""
    base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}"
    items = json.loads(get(base + "/index.json"))["directory"]["item"]
    tabla = [i["name"] for i in items if i["name"].endswith(".xml") and "primary_doc" not in i["name"]]
    if len(tabla) != 1:
        raise RuntimeError(f"{acc}: esperaba 1 XML de posiciones y hay {tabla}")
    suma = defaultdict(lambda: [0, 0])
    for fila in ET.fromstring(get(f"{base}/{tabla[0]}")):
        d = {e.tag.split("}")[1]: e for e in fila.iter()}
        if "putCall" in d or d["sshPrnamtType"].text != "SH":
            raise RuntimeError(f"{acc}: fila con opciones o bonos ({d['nameOfIssuer'].text}); hay que tratarlas antes de sumar")
        emisor = d["nameOfIssuer"].text.strip().upper()
        suma[emisor][0] += int(d["value"].text)
        suma[emisor][1] += int(d["sshPrnamt"].text)
    return suma


def procesar(gestor):
    sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{gestor['cik']}.json"))["filings"]["recent"]
    presentaciones = [(sub["accessionNumber"][i], sub["reportDate"][i], sub["filingDate"][i])
                      for i, f in enumerate(sub["form"]) if f == "13F-HR"][:2]
    (acc, periodo, presentado), (acc_ant, periodo_ant, _) = presentaciones
    ahora, antes = posiciones(gestor["cik"], acc), posiciones(gestor["cik"], acc_ant)
    total = sum(v for v, _ in ahora.values())

    top = []
    for emisor, (valor, acciones) in sorted(ahora.items(), key=lambda kv: -kv[1][0])[:10]:
        prev = antes.get(emisor)
        cambio = "nueva" if not prev else round((acciones / prev[1] - 1) * 100, 1)   # % de acciones frente al trimestre anterior
        top.append({"emisor": emisor, "valor_usd": valor, "peso_pct": round(valor / total * 100, 2),
                    "acciones": acciones, "cambio_acciones_pct": cambio})

    (DATOS / f"13f_{gestor['clave']}.json").write_text(json.dumps({
        "gestor": gestor["nombre"], "cik": gestor["cik"], "periodo": periodo, "presentado": presentado,
        "periodo_anterior": periodo_ant, "accesion": acc, "fuente": "SEC EDGAR, formulario 13F-HR",
        "total_usd": total, "n_emisores": len(ahora), "top": top,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{gestor['nombre']}: periodo {periodo}, {len(ahora)} emisores, total {total/1e6:,.0f} M$")


DATOS.mkdir(exist_ok=True)
hechos, fallos = [], 0
for g in GESTORES:
    try:
        procesar(g)
        hechos.append({"clave": g["clave"], "nombre": g["nombre"]})
    except Exception as e:   # un gestor que falla no tumba a los demas
        fallos += 1
        print(f"FALLO {g['nombre']}: {e}", file=sys.stderr)
(DATOS / "13f_indice.json").write_text(json.dumps(hechos, ensure_ascii=False, indent=2), encoding="utf-8")
sys.exit(1 if fallos else 0)
