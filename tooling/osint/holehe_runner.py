#!/usr/bin/env python3
"""
holehe_runner.py — wraps holehe's internal API to emit JSON.

Usage:
  holehe_runner.py <email> [--timeout N]

Output (stdout): one JSON object:
  {
    "ok": true,
    "email": "user@example.com",
    "checked": <int>,
    "used": [{"name": "amazon.com", "category": "?", "domain": "amazon.com"}, ...],
    "errors": [{"name": "...", "reason": "..."}]
  }
On failure:
  {"ok": false, "reason": "..."}
"""
import sys
import json
import asyncio
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--timeout", type=float, default=8.0)
    args = parser.parse_args()

    try:
        # Import holehe internals lazily so failure surfaces as JSON.
        import httpx
        from holehe.core import import_submodules, is_email
    except Exception as e:
        print(json.dumps({"ok": False, "reason": f"import_error: {e}"}))
        return 1

    if not is_email(args.email):
        print(json.dumps({"ok": False, "reason": "invalid_email"}))
        return 1

    async def run() -> dict:
        modules = import_submodules("holehe.modules")
        # Build a flat list of (module_name, callable).
        websites = []
        for mod_name, mod in modules.items():
            # Each module typically defines an async function with the same
            # leaf name (e.g. holehe.modules.companies.amazon.amazon).
            short = mod_name.rsplit(".", 1)[1]
            fn = getattr(mod, short, None)
            if callable(fn):
                websites.append((short, fn))

        client = httpx.AsyncClient(timeout=args.timeout)
        out: list[dict] = []
        errors: list[dict] = []

        async def call_one(name, fn):
            try:
                # holehe modules append their result to `out`.
                await fn(args.email, client, out)
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
                "category": item.get("category") or None,
            }
            for item in out
            if item.get("exists") is True
        ]
        used.sort(key=lambda x: x["name"])
        return {
            "ok": True,
            "email": args.email,
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
