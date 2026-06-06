#!/usr/bin/env python3
"""
maigret_runner.py — runs maigret and emits a normalised JSON result with the
RICH profile data maigret extracts (bio, follower counts, avatars, location,
join date, …) — not just "exists/doesn't exist".

Usage:
  maigret_runner.py <username> [--top-sites N] [--timeout S]

Output:
  {
    "ok": true,
    "username": "...",
    "claimed": [
      {
        "site": "GitHub",
        "url": "https://github.com/octocat",
        "tags": ["coding"],
        "fields": {
          "fullname": "The Octocat",
          "bio": "...",
          "image": "https://...",
          "follower_count": "22846",
          "following_count": "9",
          "location": "San Francisco",
          "blog_url": "https://github.blog",
          "created_at": "2011-01-25T18:44:36Z",
          "is_verified": "False"
        }
      }
    ]
  }
"""
import sys
import os
import json
import tempfile
import subprocess
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username")
    parser.add_argument("--top-sites", type=int, default=80)
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()

    # Resolve the venv from the script's own location (NOT sys.executable —
    # that returns the realpath after symlink resolution and points at the
    # system python when Node spawns the venv python via its symlink).
    script_dir = os.path.dirname(os.path.abspath(__file__))
    venv_bin = os.path.join(os.path.dirname(script_dir), "osint-venv", "bin")
    maigret_bin = os.path.join(venv_bin, "maigret")
    if not os.path.exists(maigret_bin):
        maigret_bin = "maigret"

    with tempfile.TemporaryDirectory() as tmp:
        try:
            res = subprocess.run(
                [
                    maigret_bin,
                    args.username,
                    "-J", "simple",
                    "--top-sites", str(args.top_sites),
                    "--timeout", str(int(args.timeout)),
                    "--no-color",
                    "--no-progressbar",
                    "--no-autoupdate",
                    "-fo", tmp,
                ],
                capture_output=True,
                text=True,
                timeout=max(args.timeout * args.top_sites / 8, 120),
                # Inherit caller's cwd so maigret can find its bundled data files;
                # the report goes to -fo dir (absolute path) regardless.
            )
        except subprocess.TimeoutExpired:
            print(json.dumps({"ok": False, "reason": "timeout"}))
            return 1
        except FileNotFoundError:
            print(json.dumps({"ok": False, "reason": "maigret_not_installed"}))
            return 1

        # maigret writes report_<username>_simple.json
        candidates = [f for f in os.listdir(tmp) if f.endswith("_simple.json")]
        if not candidates:
            err_tail = (res.stderr or "")[-500:] if res else ""
            out_tail = (res.stdout or "")[-300:] if res else ""
            print(json.dumps({
                "ok": True,
                "username": args.username,
                "claimed": [],
                "diag": {
                    "returncode": res.returncode if res else None,
                    "stderr_tail": err_tail,
                    "stdout_tail": out_tail,
                    "tmp_files": os.listdir(tmp),
                },
            }, ensure_ascii=False))
            return 0
        with open(os.path.join(tmp, candidates[0]), "r", encoding="utf-8") as f:
            data = json.load(f)

    claimed = []
    # Curated allowlist of fields to extract — keep it small and serialisable.
    KEEP = (
        "fullname", "bio", "image", "avatar",
        "follower_count", "following_count", "subscriber_count",
        "location", "country", "city",
        "blog_url", "website", "url",
        "created_at", "joined", "join_date",
        "email", "phone",
        "is_verified", "verified", "is_premium",
        "username", "uid",
        "public_repos_count", "public_gists_count",
        "company", "is_company",
    )

    for site_name, info in data.items():
        if not isinstance(info, dict):
            continue
        status = info.get("status") or {}
        if not isinstance(status, dict) or status.get("status") != "Claimed":
            continue
        ids = status.get("ids") or {}
        if not isinstance(ids, dict):
            ids = {}
        fields = {}
        for k in KEEP:
            v = ids.get(k)
            if v not in (None, "", "None"):
                fields[k] = v
        # Some shape: tags from site config.
        site_cfg = info.get("site") or {}
        tags = site_cfg.get("tags") if isinstance(site_cfg, dict) else None
        claimed.append({
            "site": site_name,
            "url": info.get("url_user") or "",
            "tags": tags if isinstance(tags, list) else [],
            "fields": fields,
        })

    print(json.dumps({"ok": True, "username": args.username, "claimed": claimed}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
