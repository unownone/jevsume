from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 5 or sys.argv[1] != "-f" or sys.argv[3] != "-j":
        print("usage: validate_json.py -f fields.yaml -j output.json", file=sys.stderr)
        return 2

    fields_path = Path(sys.argv[2])
    json_path = Path(sys.argv[4])
    names = parse_field_names(fields_path.read_text())
    payload = json.loads(json_path.read_text())
    missing = [name for name in names if name not in payload]
    extra_ok = {"uncertain"}
    if missing:
        print(f"missing fields: {', '.join(missing)}", file=sys.stderr)
        return 1
    if "uncertain" not in payload or not isinstance(payload["uncertain"], list):
        print("missing uncertain array", file=sys.stderr)
        return 1
    unused = [key for key in payload if key not in names and key not in extra_ok]
    if unused:
        print(f"unknown fields: {', '.join(unused)}", file=sys.stderr)
        return 1
    print(f"ok {json_path}")
    return 0


def parse_field_names(raw: str) -> list[str]:
    names: list[str] = []
    in_fields = False
    for line in raw.splitlines():
        if line.startswith("fields:"):
            in_fields = True
            continue
        if not in_fields:
            continue
        stripped = line.strip()
        if stripped.startswith("- name:"):
            names.append(stripped.split(":", 1)[1].strip())
    return names


if __name__ == "__main__":
    raise SystemExit(main())
