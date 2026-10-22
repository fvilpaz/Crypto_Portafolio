"""Baja de EDGAR los dos ultimos 13F de cada gestor de GESTORES y guarda las 10 mayores posiciones en data/13f_<clave>.json.

Uso:  SEC_USER_AGENT="Nombre correo@dominio" python scripts/update_13f.py
La SEC exige un contacto en el User-Agent (sin el, 403); va por variable de entorno para no
dejar el correo escrito en el repo. El 13F es trimestral y llega hasta 45 dias tarde: muestra
lo que tenian, no lo que tienen hoy. Para anadir un gestor: una linea en GESTORES (el CIK sale
de EDGAR) y volver a ejecutar.
"""
import json, os, re, sys, time, urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

# Los inversores que se siguen salen de data/gestores.json (una entrada por inversor: clave, sigla de 2 letras, nombre y CIK de la SEC). Para anadir uno basta una entrada
# alli (el CIK sale de EDGAR) y volver a ejecutar; si falta el archivo se usan estos tres.
GESTORES = [
    {"clave": "berkshire", "corto": "BK", "nombre": "Berkshire Hathaway", "cik": "0001067983"},
    {"clave": "bridgewater", "corto": "BR", "nombre": "Bridgewater Associates", "cik": "0001350694"},
    {"clave": "gates", "corto": "GF", "nombre": "Gates Foundation Trust", "cik": "0001166559"},
]
try:
    _cfg = json.loads((Path(__file__).resolve().parent.parent / "data" / "gestores.json").read_text(encoding="utf8"))["gestores"]
    if _cfg and all(set(g) >= {"clave", "corto", "nombre", "cik"} for g in _cfg):
        GESTORES = _cfg
except (OSError, ValueError, KeyError):
    pass
# Empresas que sigo en bolsa: (nombre, texto que lleva el emisor en el 13F, en mayusculas). Se busca por nombre:
# un fondo como ISHARES TR o VANGUARD INDEX FDS no dice que indice sigue, asi que el S&P 500 puede quedar infracontado.
SEGUIDAS = [("S&P 500", "S&P 500"), ("SpaceX", "SPACE EXPLORATION"), ("Tesla", "TESLA"), ("Nvidia", "NVIDIA"), ("Microsoft", "MICROSOFT")]
CUSIPS = {}   # accesion -> {emisor: {cusip}}: el nombre del emisor cambia de un trimestre a otro (BANK AMERICA CORP -> BANK OF AMER CORP); el CUSIP no
TABLAS = {}   # accesion -> URL de la tabla completa del 13F, para enlazarla desde la app
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
    TABLAS[acc] = f"{base}/xslForm13F_X02/{tabla[0]}" if len(tabla) == 1 else None   # versión HTML de la tabla completa (todas las posiciones)
    if len(tabla) != 1:
        raise RuntimeError(f"{acc}: esperaba 1 XML de posiciones y hay {tabla}")
    suma = defaultdict(lambda: [0, 0])
    for fila in ET.fromstring(get(f"{base}/{tabla[0]}")):
        d = {e.tag.split("}")[1]: e for e in fila.iter()}
        if "putCall" in d or d["sshPrnamtType"].text != "SH":
            raise RuntimeError(f"{acc}: fila con opciones o bonos ({d['nameOfIssuer'].text}); hay que tratarlas antes de sumar")
        emisor = d["nameOfIssuer"].text.strip().upper()
        CUSIPS.setdefault(acc, defaultdict(set))[emisor].add(d["cusip"].text.strip().upper())
        suma[emisor][0] += int(d["value"].text)
        suma[emisor][1] += int(d["sshPrnamt"].text)
    return suma


def mismos_emisores(antes, cusips_ant, cusips_hoy, ahora):
    """Pasa al nombre actual a los emisores del trimestre anterior que cambiaron de nombre (mismo CUSIP), para no contarlos como venta + compra nueva."""
    de_cusip = {c: e for e, cs in cusips_hoy.items() if e in ahora for c in cs}
    nuevo = defaultdict(lambda: [0, 0])
    for emisor, (valor, acciones) in antes.items():
        destino = next((de_cusip[c] for c in sorted(cusips_ant.get(emisor, ())) if c in de_cusip), emisor)
        nuevo[destino][0] += valor
        nuevo[destino][1] += acciones
    return nuevo


def cambio_acciones(prev, acciones):
    """% de acciones frente al trimestre anterior, o "nueva" si no estaba."""
    return "nueva" if not prev else round((acciones / prev[1] - 1) * 100, 1)


def desde_cuando(cik, presentaciones, antes, ahora, acc):
    """Desde que trimestre tiene el inversor cada empresa: trimestres seguidos contando hacia atras desde el ultimo 13F. Devuelve {emisor: periodo}; si la racha llega al
    trimestre mas antiguo que se mira, el valor lleva un '<' delante (la tiene desde ese trimestre o desde antes)."""
    desde = {e: presentaciones[0][1] for e in ahora}
    vivos = set(ahora)
    for idx in range(1, len(presentaciones)):
        acc_i, periodo_i, _ = presentaciones[idx]
        try:
            pos_i = antes if idx == 1 else mismos_emisores(posiciones(cik, acc_i), CUSIPS[acc_i], CUSIPS[acc], ahora)
        except Exception as e:   # un trimestre que no se puede leer corta la busqueda hacia atras
            print(f"AVISO {cik}: no se pudo leer {acc_i} ({str(e)[:60]})", file=sys.stderr)
            return desde
        vivos = {e for e in vivos if e in pos_i}
        if not vivos:
            return desde
        for e in vivos:
            desde[e] = periodo_i
    for e in vivos:   # la racha llega hasta el trimestre mas antiguo que se mira
        desde[e] = "<" + desde[e]
    return desde


def procesar(gestor):
    sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{gestor['cik']}.json"))["filings"]["recent"]
    presentaciones = [(sub["accessionNumber"][i], sub["reportDate"][i], sub["filingDate"][i])
                      for i, f in enumerate(sub["form"]) if f == "13F-HR"][:TRIMESTRES]
    (acc, periodo, presentado), (acc_ant, periodo_ant, _) = presentaciones[:2]
    ahora, antes = posiciones(gestor["cik"], acc), posiciones(gestor["cik"], acc_ant)
    antes = mismos_emisores(antes, CUSIPS[acc_ant], CUSIPS[acc], ahora)
    total = sum(v for v, _ in ahora.values())
    desde = desde_cuando(gestor["cik"], presentaciones, antes, ahora, acc)

    top = []
    for emisor, (valor, acciones) in sorted(ahora.items(), key=lambda kv: -kv[1][0])[:10]:
        prev = antes.get(emisor)
        top.append({"emisor": emisor, "valor_usd": valor, "peso_pct": round(valor / total * 100, 2),
                    "acciones": acciones, "cambio_acciones_pct": cambio_acciones(prev, acciones)})

    (DATOS / f"13f_{gestor['clave']}.json").write_text(json.dumps({
        "gestor": gestor["nombre"], "cik": gestor["cik"], "periodo": periodo, "presentado": presentado,
        "periodo_anterior": periodo_ant, "accesion": acc, "fuente": "SEC EDGAR, formulario 13F-HR",
        "total_usd": total, "n_emisores": len(ahora), "tabla_url": TABLAS.get(acc), "top": top,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{gestor['nombre']}: periodo {periodo}, {len(ahora)} emisores, total {total/1e6:,.0f} M$")
    return {"ahora": ahora, "antes": antes, "total": total, "periodo": periodo, "desde": desde}


SUFIJOS = {"INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED", "PLC", "HOLDINGS", "HOLDING", "HLDGS", "HLDG", "GROUP", "THE", "NV", "SA", "AG", "LLC", "LP", "DE", "DEL", "NEW"}
# el 13F abrevia los nombres (BANK OF AMER CORP, APPLIED MATLS INC); la lista de tickers de la SEC los lleva enteros
ABREVIATURAS = {"AMER": "AMERICA", "MATLS": "MATERIALS", "FINL": "FINANCIAL", "NATL": "NATIONAL", "RY": "RAILWAY", "MNG": "MINING", "SYS": "SYSTEMS", "TECHNOLOGIES": "TECHNOLOGIES",
                "INTL": "INTERNATIONAL", "ENERGY": "ENERGY", "SVCS": "SERVICES", "RESOURCES": "RESOURCES", "PETE": "PETROLEUM", "MFG": "MANUFACTURING", "ELEC": "ELECTRIC", "COMMUNICATIONS": "COMMUNICATIONS"}
TRIMESTRES = 6     # cuantos 13F se leen por inversor para saber desde cuando tiene cada empresa (el ultimo y los 5 anteriores)
TOP_PRECIOS = 60   # de cada inversor se sigue el precio de sus TOP_PRECIOS mayores posiciones


def norm(s, expandir=False):
    """Nombre de emisor sin puntuacion ni sufijos legales (parecido al de la app), para cruzar el 13F con la lista de tickers de la SEC; con expandir=True se desabrevian
    las palabras del 13F."""
    palabras = [w for w in re.sub(r"[.,&'()/-]", " ", s.upper()).split() if w not in SUFIJOS]
    return " ".join(ABREVIATURAS.get(w, w) if expandir else w for w in palabras)


def acciones_de_los_inversores(todos):
    """data/acciones_13f.json: tickers de las mayores posiciones de cada inversor (los que se pueden cruzar por nombre con la SEC). Los usa la Action de precios
    ademas de data/acciones.json, asi todo lo que tienen los grandes sale con precio, analisis tecnico y fundamentales."""
    tickers = json.loads(get("https://www.sec.gov/files/company_tickers.json"))
    por_nombre = {}
    for v in tickers.values():   # el fichero viene ordenado por tamano: ante varios tickers del mismo nombre se queda el primero
        por_nombre.setdefault(norm(v["title"]), v["ticker"].upper())
    simbolos, sin_ticker = {}, []
    for clave, t in todos.items():
        for emisor, _ in sorted(t["ahora"].items(), key=lambda kv: -kv[1][0])[:TOP_PRECIOS]:
            tk = por_nombre.get(norm(emisor, True)) or por_nombre.get(norm(emisor))
            if tk:
                simbolos.setdefault(tk, emisor)
            else:
                sin_ticker.append(emisor)
    (DATOS / "acciones_13f.json").write_text(json.dumps({"_nota": "Generado por scripts/update_13f.py: tickers de las mayores posiciones de cada inversor. No editar a mano.",
                                                         "simbolos": sorted(simbolos), "origen": {tk: simbolos[tk] for tk in sorted(simbolos)}, "sin_ticker": sorted(set(sin_ticker))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"acciones_13f.json: {len(simbolos)} simbolos; {len(set(sin_ticker))} posiciones grandes sin ticker (nombre distinto en la SEC)")


def seguidas(todos):
    """Para cada empresa seguida, que gestores la tienen (suma los emisores cuyo nombre contiene el texto), aunque este fuera del top 10."""
    salida = []
    for nombre, patron in SEGUIDAS:
        gestores = []
        for clave, t in todos.items():
            ahora = [v for e, v in t["ahora"].items() if patron in e]
            if not ahora:
                continue
            antes = [v for e, v in t["antes"].items() if patron in e]
            valor, acciones = sum(v[0] for v in ahora), sum(v[1] for v in ahora)
            prev = [sum(v[0] for v in antes), sum(v[1] for v in antes)] if antes else None
            gestores.append({"clave": clave, "peso_pct": round(valor / t["total"] * 100, 2),
                             "cambio_acciones_pct": cambio_acciones(prev, acciones)})
        salida.append({"nombre": nombre, "patron": patron, "gestores": gestores})
    return salida


def coincidencias(todos):
    """Empresas que 2 o mas gestores tienen a la vez (por nombre de emisor, ya sumado dentro de cada gestor)."""
    por_emisor = defaultdict(list)
    for clave, t in todos.items():
        for emisor, (valor, acciones) in t["ahora"].items():
            por_emisor[emisor].append({"clave": clave, "peso_pct": round(valor / t["total"] * 100, 2),
                                       "cambio_acciones_pct": cambio_acciones(t["antes"].get(emisor), acciones)})
    varios = {e: g for e, g in por_emisor.items() if len(g) >= 2}
    orden = sorted(varios.items(), key=lambda kv: (-len(kv[1]), -sum(x["peso_pct"] for x in kv[1])))
    return {"gestores_seguidos": len(todos), "periodo": max(t["periodo"] for t in todos.values()),
            "en_2_o_mas": len(varios), "en_todas": sum(1 for g in varios.values() if len(g) == len(todos)),
            "filas": [{"emisor": e, "gestores": g} for e, g in orden[:15]], "seguidas": seguidas(todos)}


DATOS.mkdir(exist_ok=True)
hechos, todos, fallos = [], {}, 0
for g in GESTORES:
    try:
        todos[g["clave"]] = procesar(g)
        hechos.append({"clave": g["clave"], "corto": g["corto"], "nombre": g["nombre"]})
    except Exception as e:   # un gestor que falla no tumba a los demas
        fallos += 1
        print(f"FALLO {g['nombre']}: {e}", file=sys.stderr)
(DATOS / "13f_indice.json").write_text(json.dumps(hechos, ensure_ascii=False, indent=2), encoding="utf-8")
if todos:   # TODAS las posiciones de cada gestor (no solo las 10 mayores), para el buscador "quien tiene esta empresa" de la app
    filas = defaultdict(dict)
    for clave, t in todos.items():
        for emisor, (valor, acciones) in t["ahora"].items():
            filas[emisor][clave] = [round(valor / t["total"] * 100, 3), acciones, cambio_acciones(t["antes"].get(emisor), acciones), t["desde"].get(emisor)]
        total_ant = sum(v for v, _ in t["antes"].values())   # lo que tenia el trimestre anterior y ya no tiene: salida total
        for emisor, (valor, acciones) in t["antes"].items():
            if emisor not in t["ahora"]:
                filas[emisor][clave] = [0, 0, "salio", round(valor / total_ant * 100, 3), acciones]
    (DATOS / "13f_posiciones.json").write_text(json.dumps({"periodo": max(t["periodo"] for t in todos.values()), "gestores": hechos, "filas": filas},
                                                        ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
if todos:
    try:
        acciones_de_los_inversores(todos)
    except Exception as e:   # un fallo aqui no tumba lo demas
        print(f"AVISO acciones_13f.json: {str(e)[:100]}", file=sys.stderr)
if len(todos) >= 2:
    (DATOS / "13f_coinciden.json").write_text(json.dumps(coincidencias(todos), ensure_ascii=False, indent=2), encoding="utf-8")
sys.exit(1 if fallos else 0)
