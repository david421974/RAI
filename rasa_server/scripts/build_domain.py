#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
import sys
from copy import deepcopy
from typing import Any, Dict, List, Tuple

try:
    import yaml  # PyYAML
except ImportError:
    print("ERROR: Falta PyYAML. Instala con: pip install pyyaml", file=sys.stderr)
    sys.exit(2)


TOP_LEVEL_ORDER = [
    "version",
    "session_config",
    "intents",
    "entities",
    "slots",
    "responses",
    "actions",
    "forms",
    "e2e_actions",
    "config",
]


def is_keyed_item(x: Any) -> bool:
    """True si el item es dict con una sola clave (p.ej. {'greet': {...}})."""
    return isinstance(x, dict) and len(x.keys()) == 1


def keyed_list_to_map(lst: List[Any]) -> Tuple[Dict[str, Any], List[Any]]:
    """
    Convierte una lista mixta en:
      - mapa de items 'keyed' (dict 1 clave) -> key: value
      - lista de items 'no keyed' (strings, dict multi-clave, etc.)
    """
    m = {}
    rest = []
    for it in lst:
        if is_keyed_item(it):
            k = next(iter(it.keys()))
            m[k] = it[k]
        else:
            rest.append(it)
    return m, rest


def uniq_preserve_order(seq: List[Any]) -> List[Any]:
    """Dedup simple preservando orden para items hashables; para dicts usa str()."""
    seen = set()
    out = []
    for x in seq:
        key = x if isinstance(x, (str, int, float, bool, type(None))) else str(x)
        if key in seen:
            continue
        seen.add(key)
        out.append(x)
    return out


def deep_merge(a: Any, b: Any, path: str = "", warnings: List[str] = None) -> Any:
    """
    Merge de a <- b (b pisa a cuando no se puede combinar).
    - dict: merge recursivo
    - list: merge inteligente (dedup; intents soporta dict 1-clave)
    - otros: b
    """
    if warnings is None:
        warnings = []

    # dict + dict
    if isinstance(a, dict) and isinstance(b, dict):
        out = deepcopy(a)
        for k, bv in b.items():
            av = out.get(k)
            new_path = f"{path}.{k}" if path else k
            if k in out:
                out[k] = deep_merge(av, bv, new_path, warnings)
            else:
                out[k] = deepcopy(bv)
        return out

    # list + list
    if isinstance(a, list) and isinstance(b, list):
        # Caso especial: intents (lista de strings o dict 1-clave)
        # Y también actions/intents/entities suelen ser listas.
        a_map, a_rest = keyed_list_to_map(a)
        b_map, b_rest = keyed_list_to_map(b)

        # Merge de keyed items por clave
        merged_map = deepcopy(a_map)
        for k, bv in b_map.items():
            if k in merged_map and isinstance(merged_map[k], dict) and isinstance(bv, dict):
                merged_map[k] = deep_merge(merged_map[k], bv, f"{path}[{k}]", warnings)
            else:
                merged_map[k] = deepcopy(bv)

        # Reconstruimos lista: primero strings/otros + keyed
        merged_rest = uniq_preserve_order(a_rest + b_rest)

        merged_keyed = []
        # Para orden: mantenemos primero el orden de aparición de a, luego b
        seen_keys = set()
        for it in a:
            if is_keyed_item(it):
                k = next(iter(it.keys()))
                if k in merged_map and k not in seen_keys:
                    merged_keyed.append({k: merged_map[k]})
                    seen_keys.add(k)
        for it in b:
            if is_keyed_item(it):
                k = next(iter(it.keys()))
                if k in merged_map and k not in seen_keys:
                    merged_keyed.append({k: merged_map[k]})
                    seen_keys.add(k)

        # Si no hay keyed, saldrá vacío
        return uniq_preserve_order(merged_rest + merged_keyed)

    # tipos diferentes o escalares: b pisa a
    # (podrías añadir warning si hay colisión)
    if path:
        # Solo avisamos si ambos tienen valor y son distintos
        if a is not None and b is not None and a != b:
            warnings.append(f"COLISIÓN en '{path}': se sustituye '{a}' por '{b}'")
    return deepcopy(b)


def load_yaml_file(fp: str) -> Dict[str, Any]:
    with open(fp, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
        if not isinstance(data, dict):
            raise ValueError(f"El YAML {fp} no es un dict en top-level.")
        return data


def order_top_level(d: Dict[str, Any]) -> Dict[str, Any]:
    """Ordena keys top-level para que sea más legible (sin perder keys desconocidas)."""
    out = {}
    for k in TOP_LEVEL_ORDER:
        if k in d:
            out[k] = d[k]
    # resto de claves
    for k in d.keys():
        if k not in out:
            out[k] = d[k]
    return out


def main():
    ap = argparse.ArgumentParser(description="Genera un domain.yml único a partir de fragments en /domain.")
    ap.add_argument("--domain-dir", default="domain", help="Directorio con fragments (por defecto: domain)")
    ap.add_argument("--base", default="basics_domain.yml", help="Fichero base dentro de domain-dir")
    ap.add_argument("--out", default="domain.yml", help="Nombre de salida dentro de domain-dir")
    ap.add_argument("--fail-on-collision", action="store_true", help="Falla si hay colisiones de valores")
    args = ap.parse_args()

    domain_dir = args.domain_dir
    base_fp = os.path.join(domain_dir, args.base)
    out_fp = os.path.join(domain_dir, args.out)

    if not os.path.isdir(domain_dir):
        print(f"ERROR: No existe el directorio: {domain_dir}", file=sys.stderr)
        sys.exit(2)

    if not os.path.isfile(base_fp):
        print(f"ERROR: No existe el fichero base: {base_fp}", file=sys.stderr)
        sys.exit(2)

    # Carga base
    warnings: List[str] = []
    merged = load_yaml_file(base_fp)

    # Carga el resto de yml del directorio
    files = []
    for fn in sorted(os.listdir(domain_dir)):
        if not fn.lower().endswith((".yml", ".yaml")):
            continue
        if fn == args.base:
            continue
        if fn == args.out:
            continue
        files.append(os.path.join(domain_dir, fn))

    for fp in files:
        part = load_yaml_file(fp)
        merged = deep_merge(merged, part, path="", warnings=warnings)

    merged = order_top_level(merged)

    # Si no hay version, pon una por defecto (RASA 3.x suele usar 3.1 / 3.0)
    if "version" not in merged:
        merged["version"] = "3.1"

    # Escribe salida
    with open(out_fp, "w", encoding="utf-8") as f:
        yaml.safe_dump(
            merged,
            f,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
            width=120
        )

    # Avisos
    if warnings:
        print("\n[WARN] Se detectaron colisiones/reescrituras:", file=sys.stderr)
        for w in warnings:
            print(" - " + w, file=sys.stderr)

        if args.fail_on_collision:
            print("\nERROR: --fail-on-collision activado. Abortando.", file=sys.stderr)
            sys.exit(1)

    print(f"OK -> Generado: {out_fp}")
    print(f"Incluidos {len(files)} fragment(s) + base: {base_fp}")


if __name__ == "__main__":
    main()
