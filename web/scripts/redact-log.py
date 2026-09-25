"""Pass a CI step's output through, with every credential masked. Use it as a pipe:

    set -o pipefail
    pnpm exec playwright test ... 2>&1 | python3 scripts/redact-log.py

⚠️ WHY — found 2026-09-25. This repository is PUBLIC, so its CI logs are too, and
GitHub masks only the secrets it was GIVEN, by exact value. A request that timed
out in `check:csp` printed Playwright's call log, which lists every request
header, and the `cookie:` header held a live session for the shared E2E account.
A session is minted at run time, so no secret list can contain it.

The rules are the artifact cleaner's (`e2e-sanitize-blob.py`), imported rather
than copied, so a shape added there is masked here on the same day (CLAUDE.md 11c).

⚠️ `set -o pipefail` is not optional. GitHub runs a `run:` block as `bash -e`,
which takes a pipe's status from its LAST command — this one, which always
succeeds — so without it a failing test run would report green.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "sanitize_blob", Path(__file__).with_name("e2e-sanitize-blob.py")
)
assert _spec and _spec.loader
_rules = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_rules)


def main() -> int:
    secrets = _rules.secret_values()
    out = sys.stdout.buffer
    for line in sys.stdin.buffer:
        out.write(_rules.redact(line, secrets))
        # Line by line, so a long step still shows progress in the live log.
        out.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
