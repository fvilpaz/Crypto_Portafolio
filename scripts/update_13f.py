"""Baja de EDGAR los dos ultimos 13F de un gestor y guarda las 10 mayores posiciones en un JSON.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_13f.py
La SEC exige un contacto en el User-Agent (sin el, 403); va por variable de entorno para no
dejar el correo escrito en el repo. El 13F es trimestral y llega hasta 45 dias tarde: muestra
lo que tenian, no lo que tienen hoy.
"""
import json, os, sys, time, urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

GESTOR = {"nombre": "Berkshire Hathaway", "cik": "0001067983"}
SALIDA = Path(__file__).resolve().parent.parent / "data" / "13f_berkshire.json"
UA = os.environ.get("SEC_USER_AGENT")
if not UA:
    sys.exit('Falta SEC_USER_AGENT, p. ej.: SEC_USER_AGENT="Crypto_Portafolio tu@correo.com"')


def get(url):
    time.sleep(0.3)   # la SEC pide no pasar de 10 peticiones por segundo
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        return r.read()


def posiciones(cik, acc):
    """{emisor: [valor_usd, acciones]} sumando las filas del mismo emisor (Apple sale en 2)."""
    base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}"
    items = json.loads(get(base + "/index.json"))["directory"]["item"]
    tabla = [i["name"] for i in items if i["name"].endswith(".xml") and "primary_doc" not in i["name"]]
    if len(tabla) != 1:
        sys.exit(f"{acc}: esperaba 1 XML de posiciones y hay {tabla}")
    suma = defaultdict(lambda: [0, 0])
    for fila in ET.fromstring(get(f"{base}/{tabla[0]}")):
        d = {e.tag.split("}")[1]: e for e in fila.iter()}
        emisor = d["nameOfIssuer"].text.strip().upper()
        suma[emisor][0] += int(d["value"].text)
        suma[emisor][1] += int(d["sshPrnamt"].text)
    return suma


sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{GESTOR['cik']}.json"))["filings"]["recent"]
presentaciones = [(sub["accessionNumber"][i], sub["reportDate"][i], sub["filingDate"][i])
                  for i, f in enumerate(sub["form"]) if f == "13F-HR"][:2]
(acc, periodo, presentado), (acc_ant, periodo_ant, _) = presentaciones
ahora, antes = posiciones(GESTOR["cik"], acc), posiciones(GESTOR["cik"], acc_ant)
total = sum(v for v, _ in ahora.values())

top = []
for emisor, (valor, acciones) in sorted(ahora.items(), key=lambda kv: -kv[1][0])[:10]:
    prev = antes.get(emisor)
    cambio = "nueva" if not prev else round((acciones / prev[1] - 1) * 100, 1)   # % de acciones frente al trimestre anterior
    top.append({"emisor": emisor, "valor_usd": valor, "peso_pct": round(valor / total * 100, 2),
                "acciones": acciones, "cambio_acciones_pct": cambio})

SALIDA.parent.mkdir(exist_ok=True)
SALIDA.write_text(json.dumps({
    "gestor": GESTOR["nombre"], "cik": GESTOR["cik"], "periodo": periodo, "presentado": presentado,
    "periodo_anterior": periodo_ant, "accesion": acc, "fuente": "SEC EDGAR, formulario 13F-HR",
    "total_usd": total, "n_emisores": len(ahora), "top": top,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"{GESTOR['nombre']}: periodo {periodo}, {len(ahora)} emisores, total {total/1e6:,.0f} M$ -> {SALIDA}")
