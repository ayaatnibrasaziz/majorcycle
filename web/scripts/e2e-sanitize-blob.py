"""Make a Playwright blob report safe to publish, or refuse to let it leave the runner.

⚠️ WHY THIS EXISTS — found 2026-09-25. This repository is PUBLIC, so every CI
artifact can be downloaded by anyone with a GitHub account. Each E2E shard
uploaded its raw blob report, and a blob report carries two things nobody had
looked at:

* every test STEP's title — and Playwright titles a `fill` as
  `Fill "<the value typed>" locator('input#password')`, so the shared E2E
  account's password was in every shard of every run, with nothing failing;
* on a retried test, the TRACE — every request the page made, headers included.
  The captcha bypass (e2e/lib/captchaRoute.mjs) put the Supabase service-role
  key in exactly such a header, so ten artifacts from 2026-09-23 held the
  database's admin key.

GitHub masks secrets in LOGS; it does nothing for artifacts.

So, for each blob zip in the directory given:

1. keep ONLY ``report.jsonl`` — the results `merge-reports` needs for the one
   count — and drop ``resources/`` (traces, screenshots, attachments) entirely;
2. replace every secret VALUE from the environment, and anything shaped like a
   credential (a JWT, a Supabase / Stripe secret key), with ``[redacted]``;
3. re-read what it wrote and FAIL if any secret is still in it, deleting the
   file, so the upload step (gated on this step's outcome) never runs and the
   merge job goes red for a missing shard. It fails CLOSED: a report we cannot
   prove clean is a report nobody gets.

It is a python script because the runner already has Python for the engine, and
the standard library reads and writes zips; Node's does not.
"""

from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from pathlib import Path

#: Environment variables whose values must never appear in a published artifact.
#: A NAME here costs nothing when the variable is unset.
SECRET_ENV = (
    "SUPABASE_SERVICE_ROLE_KEY",
    "E2E_PASSWORD",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "DATABASE_URL",
)

#: Credential SHAPES, for the value nobody listed: a throwaway account's session
#: token, a key added next year. Same shapes as lib/redact.ts `redactSecrets`.
PATTERNS = (
    re.compile(rb"eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"),
    re.compile(rb"sb_secret_[A-Za-z0-9_-]{8,}"),
    re.compile(rb"(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{8,}"),
    re.compile(rb"whsec_[A-Za-z0-9+/=_-]{8,}"),
)

REDACTED = b"[redacted]"
KEEP = "report.jsonl"


def secret_values() -> list[bytes]:
    """Each secret as it appears raw AND as it appears inside a JSON string, since
    a password holding a quote or a backslash is stored escaped in report.jsonl."""
    out: set[bytes] = set()
    for name in SECRET_ENV:
        value = os.environ.get(name) or ""
        if len(value) < 6:
            continue
        out.add(value.encode())
        out.add(json.dumps(value)[1:-1].encode())
    # Longest first, so a secret that contains another is replaced whole.
    return sorted(out, key=len, reverse=True)


def redact(data: bytes, secrets: list[bytes]) -> bytes:
    for s in secrets:
        data = data.replace(s, REDACTED)
    for p in PATTERNS:
        data = p.sub(REDACTED, data)
    return data


def leaks(data: bytes, secrets: list[bytes]) -> list[str]:
    found = [f"a secret value ({len(s)} chars)" for s in secrets if s in data]
    found += [f"a credential shaped like {p.pattern[:24]!r}" for p in PATTERNS if p.search(data)]
    return found


def sanitise(path: Path, secrets: list[bytes]) -> list[str]:
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        if KEEP not in names:
            return [f"no {KEEP} inside — not a blob report this script understands"]
        report = z.read(KEEP)
    clean = redact(report, secrets)
    tmp = path.with_suffix(".clean")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(KEEP, clean)
    # Verify the bytes that will actually be uploaded, not the buffer we meant to write.
    with zipfile.ZipFile(tmp) as z:
        problems = [n for n in z.namelist() if n != KEEP]
        problems = [f"unexpected member {n}" for n in problems]
        problems += leaks(z.read(KEEP), secrets)
    if problems:
        tmp.unlink()
        return problems
    tmp.replace(path)
    dropped = len(names) - 1
    print(f"{path.name}: kept {KEEP}, dropped {dropped} resource(s), verified clean")
    return []


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: e2e-sanitize-blob.py <blob-report-dir>", file=sys.stderr)
        return 2
    return main_for(Path(sys.argv[1]))


def main_for(folder: Path) -> int:
    zips = sorted(folder.glob("*.zip"))
    if not zips:
        # Nothing to publish is not a pass: the merge job must see a missing shard.
        print(f"no blob report in {folder} — nothing will be uploaded", file=sys.stderr)
        return 1
    secrets = secret_values()
    failed = False
    for path in zips:
        problems = sanitise(path, secrets)
        if problems:
            failed = True
            path.unlink(missing_ok=True)
            print(f"::error::{path.name} could not be made safe and was DELETED: "
                  + "; ".join(problems), file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
