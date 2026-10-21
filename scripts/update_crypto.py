"""Baja de DefiLlama y CoinGecko los datos de la pestana Crypto de Mercado y los guarda en data/crypto.json.

Uso:  python scripts/update_crypto.py
Sin claves ni correo: las dos APIs son abiertas. Si una fuente falla, su parte queda a null (la vista
pone "sin datos") y el script termina con error; no se inventa nada. Lo que no tiene DefiLlama
(p. ej. el TVL de Celestia) tambien queda a null.
"""
import json, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

SALIDA = Path(__file__).resolve().parent.parent / "data" / "crypto.json"
MONEDAS = [("BTC", "Bitcoin", "Bitcoin"), ("ETH", "Ethereum", "Ethereum"), ("SOL", "Solana", "Solana"),
           ("ATOM", "Cosmos Hub", "CosmosHub"), ("TIA", "Celestia", "Celestia")]   # (simbolo, nombre, cadena en DefiLlama)
LLAMA = "https://api.llama.fi"
SIN_GRAFICOS = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"
fallos = []


def get(url):
    time.sleep(0.5)   # sin prisa: son APIs gratuitas
    req = urllib.request.Request(url, headers={"User-Agent": "Crypto_Portafolio"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def intenta(nombre, fn):
    """Una fuente que falla no tumba a las demas: devuelve None y lo apunta."""
    try:
        return fn()
    except Exception as e:
        fallos.append(nombre)
        print(f"FALLO {nombre}: {e}", file=sys.stderr)
        return None


def tvl_total():
    d = get(f"{LLAMA}/v2/historicalChainTvl")   # el total sin contar dos veces lo que esta en varias cadenas
    hoy, antes = d[-1]["tvl"], d[-8]["tvl"]
    return {"usd": hoy, "cambio_7d_pct": round((hoy / antes - 1) * 100, 1)}


def stablecoins():
    d = get("https://stablecoins.llama.fi/stablecoincharts/all")
    hoy, antes = (d[i]["totalCirculatingUSD"]["peggedUSD"] for i in (-1, -8))
    return {"usd": hoy, "flujo_7d_usd": hoy - antes}


def moneda(simbolo, nombre, cadena, tvl_cadenas):
    comisiones = intenta(f"comisiones {cadena}", lambda: get(f"{LLAMA}/overview/fees/{cadena}?{SIN_GRAFICOS}"))
    ingresos = intenta(f"ingresos {cadena}", lambda: get(f"{LLAMA}/overview/fees/{cadena}?dataType=dailyRevenue&{SIN_GRAFICOS}"))
    return {"simbolo": simbolo, "nombre": nombre, "tvl_usd": tvl_cadenas.get(cadena),
            "comisiones_30d_usd": comisiones and comisiones.get("total30d"),
            "comisiones_cambio_7d_pct": comisiones and comisiones.get("change_7dover7d"),
            "ingresos_30d_usd": ingresos and ingresos.get("total30d")}


def tenedores(activo):
    d = get(f"https://api.coingecko.com/api/v3/companies/public_treasury/{activo}")
    return {"total": d["total_holdings"], "valor_usd": d["total_value_usd"], "pct_suministro": d["market_cap_dominance"],
            "n_empresas": len(d["companies"]),
            "top": [{"nombre": c["name"], "simbolo": c["symbol"], "pais": c["country"], "cantidad": c["total_holdings"],
                     "pct_suministro": c["percentage_of_total_supply"], "coste_usd": c["total_entry_value_usd"] or None,
                     "valor_usd": c["total_current_value_usd"]} for c in d["companies"][:5]]}


tvl_cadenas = intenta("TVL por cadena", lambda: {c["name"]: c["tvl"] for c in get(f"{LLAMA}/v2/chains")}) or {}
datos = {
    "actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "fuentes": "DefiLlama (TVL, comisiones, ingresos, stablecoins) y CoinGecko (empresas con crypto)",
    "tvl_total": intenta("TVL total", tvl_total),
    "stablecoins": intenta("stablecoins", stablecoins),
    "monedas": [moneda(*m, tvl_cadenas) for m in MONEDAS],
    "tenedores": {a: intenta(f"tenedores {a}", lambda a=a: tenedores(a)) for a in ("bitcoin", "ethereum")},
}
SALIDA.parent.mkdir(exist_ok=True)
SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"crypto.json escrito ({len(MONEDAS)} monedas, {len(fallos)} fallos)")
sys.exit(1 if fallos else 0)
