#!/usr/bin/env python3
"""
sherlock_runner.py — runs sherlock and emits a normalised JSON result.

Usage:
  sherlock_runner.py <username> [--timeout N]

Output (stdout):
  {
    "ok": true,
    "username": "...",
    "checked": <int>,
    "used": [{"name": "GitHub", "url": "https://github.com/x"}, ...]
  }
"""
import sys
import json
import os
import tempfile
import subprocess
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username")
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    # Resolve the venv from the script's own location (sys.executable resolves
    # symlinks and would point at the system python when Node spawns via the
    # venv-python symlink).
    script_dir = os.path.dirname(os.path.abspath(__file__))
    venv_bin = os.path.join(os.path.dirname(script_dir), "osint-venv", "bin")
    sherlock_bin = os.path.join(venv_bin, "sherlock")
    if not os.path.exists(sherlock_bin):
        sherlock_bin = "sherlock"

    # Sherlock writes JSON only when --json is given, but it dumps a per-user
    # object whose keys are the site names. Use --print-found and --no-color
    # plus --output to a tmp file.
    with tempfile.TemporaryDirectory() as tmp:
        out_txt = os.path.join(tmp, "out.txt")
        try:
            res = subprocess.run(
                [
                    sherlock_bin,
                    args.username,
                    "--print-found",
                    "--no-color",
                    "--no-txt",
                    "--timeout",
                    str(int(args.timeout)),
                    "--output",
                    out_txt,
                ],
                capture_output=True,
                text=True,
                timeout=max(args.timeout * 30, 60),
            )
        except subprocess.TimeoutExpired:
            print(json.dumps({"ok": False, "reason": "timeout"}))
            return 1
        except FileNotFoundError:
            print(json.dumps({"ok": False, "reason": "sherlock_not_installed"}))
            return 1

        # Parse stdout — sherlock prints lines like "[+] GitHub: https://github.com/x".
        used = []
        for line in res.stdout.splitlines():
            line = line.strip()
            if not line.startswith("[+]"):
                continue
            body = line[3:].strip()
            if ":" in body:
                name, _, url = body.partition(":")
                url = url.strip()
                if url.startswith("http"):
                    used.append({"name": name.strip(), "url": url})

    print(json.dumps({"ok": True, "username": args.username, "used": used, "checked": None}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
