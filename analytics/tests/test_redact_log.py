"""The filter on CI's PUBLIC logs — `web/scripts/redact-log.py`.

On 2026-09-25 a timed-out request in `check:csp` printed Playwright's call log to
a public CI log, and its `cookie:` header held a live session for the shared E2E
account. GitHub masks only the secrets it was given, by value; a session is
minted at run time, so it was printed in full.

⚠️ Every credential below is INVENTED and assembled at runtime (see
test_e2e_sanitize_blob.py for why none is written as a literal).
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "web"
FILTER = WEB / "scripts" / "redact-log.py"
CI = WEB.parent / ".github" / "workflows" / "ci.yml"

JWT = ".".join(["eyJhbGciOiJFUzI1NiJ9", "eyJzdWIiOiJpbnZlbnRlZCIsInJvbGUiOiJhdXRoIn0", "InventedSig0123456789"])
REFRESH = "invented" + "rt42"
COOKIE_VALUE = "base64-" + base64.b64encode(
    json.dumps({"access_token": JWT, "refresh_token": REFRESH}).encode()
).decode()


def _run(text: str, env: dict[str, str] | None = None) -> str:
    return subprocess.run(
        [sys.executable, str(FILTER)],
        input=text.encode(),
        capture_output=True,
        check=True,
        env=env,
    ).stdout.decode()


def test_the_leaked_call_log_shape_loses_its_session() -> None:
    # The line as Playwright printed it on 2026-09-25, with an invented session.
    log = (
        "apiRequestContext.get: Timeout 30000ms exceeded.\n"
        "Call log:\n"
        "  - → GET http://localhost:3200/account\n"
        "    - accept: */*\n"
        f"    - cookie: sb-abcdefghij-auth-token={COOKIE_VALUE}\n"
        f"    - authorization: Bearer {JWT}\n"
    )
    out = _run(log)
    assert COOKIE_VALUE[:40] not in out
    assert JWT not in out
    assert REFRESH not in out
    # The header NAMES survive, so the log still says what was sent.
    assert "cookie: [redacted]" in out
    assert "authorization: [redacted]" in out
    # CONTROL: everything that is not a credential passes through untouched —
    # a filter that blanked the whole log would pass every assertion above.
    assert "apiRequestContext.get: Timeout 30000ms exceeded." in out
    assert "GET http://localhost:3200/account" in out
    assert "accept: */*" in out


def test_the_cookie_is_caught_without_its_header_too() -> None:
    # e.g. a `document.cookie` dump, or a Set-Cookie echoed in an error body.
    out = _run(f"cookies were sb-abcdefghij-auth-token.0={COOKIE_VALUE}; path=/\n")
    assert COOKIE_VALUE[:40] not in out
    assert "path=/" in out


def test_a_named_secret_is_masked() -> None:
    password = "Pw-" + "invented-" + "Z7!"
    env = {**os.environ, "E2E_PASSWORD": password}
    out = _run(f'Fill "{password}" locator(\'input#password\')\n', env=env)
    assert password not in out
    assert "locator('input#password')" in out


def test_ordinary_test_output_is_byte_identical() -> None:
    text = (
        "Running 104 tests using 2 workers\n"
        "  ok  12 [chromium] > e2e/turnstile.spec.ts:191:7 > a SUCCESSFUL sign-in (3.1s)\n"
        "  104 passed (4.2m)\n"
    )
    assert _run(text) == text


def test_every_ci_step_that_drives_a_browser_is_filtered_and_keeps_its_exit_code() -> None:
    """The filter protects only the steps that use it, and a pipe without pipefail
    reports the FILTER's status — a failing test run would go green."""
    steps = re.split(r"\n\s*- name: ", CI.read_text(encoding="utf-8"))
    browser = re.compile(r"playwright (?:test|merge-reports)|check:csp|check:page-weight")
    drivers = [s for s in steps if browser.search(re.sub(r"#.*", "", s))]
    # CONTROL: the sweep found the steps, or every assertion below is vacuous.
    assert len(drivers) >= 4, [s.splitlines()[0] for s in drivers]
    for step in drivers:
        name = step.splitlines()[0]
        assert "python3 scripts/redact-log.py" in step, f"{name!r} writes to the public log unfiltered"
        assert "set -o pipefail" in step, f"{name!r} would report the filter's exit code, not the run's"
