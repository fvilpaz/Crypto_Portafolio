"""Baja de Google Noticias (RSS en espanol, sin clave) los titulares recientes de cada empresa de data/acciones.json y data/acciones_13f.json y los guarda en data/noticias.json.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_noticias.py
El nombre de la empresa sale de la lista de tickers de la SEC (por eso hace falta el contacto en el User-Agent, igual que en update_13f.py). Se guardan como mucho
NOTICIAS_POR_EMPRESA titulares de los ultimos DIAS_MAX dias: titulo, enlace, medio y fecha; el texto de las noticias NO se copia, solo el titular y el enlace al medio.
Los fondos y ETF sin nombre en la SEC se buscan por su simbolo. Si un grupo de peticiones falla se conserva lo que hubiera de la vez anterior.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "data"
UA = os.environ.get("SEC_USER_AGENT")
if not UA:
    sys.exit('Falta SEC_USER_AGENT, p. ej.: SEC_USER_AGENT="Crypto_Portafolio tu@correo.com"')
NOTICIAS_POR_EMPRESA, DIAS_MAX, PAUSA = 3, 14, 1.2
PALABRAS_ES = {"de", "la", "el", "en", "los", "las", "del", "por", "para", "con", "que", "un", "una", "se", "su", "al", "más", "y", "tras", "ante", "sobre"}


def es_espanol(titulo):
    """Heuristica sencilla: un titular en espanol lleva algunas palabras vacias tipicas o letras como la enie y las vocales con tilde."""
    palabras = [w.strip(".,:;¿?¡!()\"'").lower() for w in titulo.split()]
    return sum(w in PALABRAS_ES for w in palabras) >= 2 or any(c in titulo for c in "ñáéíóú¿¡")


def get(url, ua):
    time.sleep(PAUSA)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": ua}), timeout=40) as r:
        return r.read()


def titulares(consulta):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": consulta, "hl": "es", "gl": "ES", "ceid": "ES:es"})
    raiz = ET.fromstring(get(url, "Mozilla/5.0"))
    limite = datetime.now(timezone.utc) - timedelta(days=DIAS_MAX)
    salida = []
    for it in raiz.iter("item"):
        try:
            fecha = parsedate_to_datetime(it.findtext("pubDate"))
        except (TypeError, ValueError):
            continue
        enlace = (it.findtext("link") or "").strip()
        if fecha < limite or not enlace.startswith("https://"):
            continue
        titulo, fuente = (it.findtext("title") or "").strip(), (it.findtext("source") or "").strip()
        if fuente and titulo.endswith(" - " + fuente):   # Google anade el medio al final del titulo
            titulo = titulo[: -len(fuente) - 3]
        salida.append([titulo, enlace, fuente, fecha.astimezone(timezone.utc).date().isoformat(), "es" if es_espanol(titulo) else "en"])
    salida.sort(key=lambda n: n[4] != "es")   # primero los titulares en espanol (el orden por fecha se conserva dentro de cada idioma)
    return salida[:NOTICIAS_POR_EMPRESA]


def main():
    simbolos = []
    for archivo in ("acciones.json", "acciones_13f.json"):
        try:
            for x in json.loads((DATOS / archivo).read_text(encoding="utf8")).get("simbolos", []):
                s = (x if isinstance(x, str) else x.get("symbol", "")).upper()
                if s and s not in simbolos and not s.startswith("0P"):   # los fondos (0P...) no tienen noticias por ticker
                    simbolos.append(s)
        except (OSError, ValueError):
            pass
    titulos = {v["ticker"].upper(): v["title"] for v in json.loads(get("https://www.sec.gov/files/company_tickers.json", UA)).values()}
    try:
        anterior = json.loads((DATOS / "noticias.json").read_text(encoding="utf8")).get("noticias", {})
    except (OSError, ValueError):
        anterior = {}
    noticias, fallos = {}, 0
    for s in simbolos:
        nombre = titulos.get(s.replace(".", "-")) or s
        try:
            lista = titulares(f"{nombre} {s} acciones" if nombre != s else f"{s} ETF bolsa")
        except Exception as e:
            fallos += 1
            print(f"FALLO {s}: {str(e)[:80]}", file=sys.stderr)
            lista = anterior.get(s, [])
            if fallos >= 8 and not noticias:   # Google nos corta: no seguimos pidiendo
                break
        if lista:
            noticias[s] = lista
    if not noticias:
        print("ERROR: sin noticias; se conserva el archivo anterior.", file=sys.stderr)
        return 1
    (DATOS / "noticias.json").write_text(json.dumps({"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fuente": "Google Noticias (RSS)", "noticias": noticias},
                                                    ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    print(f"{len(noticias)} empresas con noticias de {len(simbolos)}; {fallos} fallos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
