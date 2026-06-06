#!/usr/bin/env python3
"""
ignorant_runner.py — JSON wrapper around the ignorant phone-number OSINT lib.
Same author as holehe; checks ~30 sites that bind phone numbers to accounts.

Usage:
  ignorant_runner.py <country_code> <phone_no_plus> [--timeout N]
  e.g. ignorant_runner.py 218 911234567

Output:
  {"ok": true, "phone": "+218911234567", "checked": <int>,
   "used": [{"name": "...", "domain": "..."}], "errors": [...]}
"""
import sys
import json
import asyncio
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("country", help="Country dial code WITHOUT +")
    parser.add_argument("phone", help="Phone number without country code")
    parser.add_argument("--timeout", type=float, default=8.0)
    args = parser.parse_args()

    try:
        import httpx
        from ignorant.core import import_submodules
    except Exception as e:
        print(json.dumps({"ok": False, "reason": f"import_error: {e}"}))
        return 1

    async def run() -> dict:
        modules = import_submodules("ignorant.modules")
        websites = []
        for mod_name, mod in modules.items():
            short = mod_name.rsplit(".", 1)[1]
            fn = getattr(mod, short, None)
            if callable(fn):
                websites.append((short, fn))

        client = httpx.AsyncClient(timeout=args.timeout)
        out: list[dict] = []
        errors: list[dict] = []

        async def call_one(name, fn):
            try:
                # ignorant signature: fn(phone, country, client, out)
                await fn(args.phone, args.country, client, out)
            except Exception as e:
                errors.append({"name": name, "reason": str(e)[:200]})

        try:
            await asyncio.gather(*(call_one(n, f) for n, f in websites))
        finally:
            await client.aclose()

        used = [
            {
                "name": item.get("name") or "",
                "domain": item.get("domain") or item.get("name") or "",
            }
            for item in out
            if item.get("exists") is True
        ]
        used.sort(key=lambda x: x["name"])
        return {
            "ok": True,
            "phone": "+" + args.country + args.phone,
            "checked": len(websites),
            "used": used,
            "errors": errors[:10],
        }

    try:
        result = asyncio.run(run())
    except Exception as e:
        print(json.dumps({"ok": False, "reason": f"runtime_error: {e}"}))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
