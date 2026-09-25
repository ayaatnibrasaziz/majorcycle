"""The guard on CI's PUBLIC test reports — `web/scripts/e2e-sanitize-blob.py`.

On 2026-09-23 ten public CI artifacts carried the Supabase service-role key and
every shard carried the E2E password (CLAUDE.md, rule 11bk). The script that now
stands between a shard and the upload runs only in CI, so its logic is tested
here, where `pnpm gates` and the Python CI job both run it.

⚠️ Every secret below is INVENTED and assembled at runtime, never written as a
literal in a credential's shape — the repo's pre-commit scanner blocks those, and
should (the same reasoning as `web/e2e/log-redaction.spec.ts`).
"""

from __future__ import annotations

import importlib.util
import zipfile
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "web" / "scripts" / "e2e-sanitize-blob.py"

PASSWORD = "Pw-" + "invented-e2e-" + "Q9x!"
SERVICE_KEY = ".".join(["eyJhbGciOiJIUzI1NiJ9", "eyJyb2xlIjoic2VydmljZV9yb2xlIn0", "InventedSignature123"])
NEW_KEY = "_".join(["sb", "secret", "InventedNewStyleKey42"])


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("sanitize_blob", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _blob(folder: Path, report: str, extra: dict[str, bytes] | None = None) -> Path:
    path = folder / "report-abc.zip"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("report.jsonl", report)
        for name, data in (extra or {}).items():
            z.writestr(name, data)
    return path


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("E2E_PASSWORD", PASSWORD)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY)


def _all_bytes(path: Path) -> bytes:
    with zipfile.ZipFile(path) as z:
        return b"".join(z.read(n) for n in z.namelist())


def test_the_real_leak_shapes_are_removed_and_traces_dropped(tmp_path: Path, env: None) -> None:
    """THE 2026-09-23 SHAPES: the password in a `Fill "…"` step title, the key in a
    trace inside `resources/`, and a new-style key nobody listed."""
    step = '{"title":"Fill \\"' + PASSWORD + '\\" locator(\'input#password\')"}'
    other = '{"error":"apikey=' + NEW_KEY + ' refused"}'
    path = _blob(tmp_path, step + "\n" + other + "\n",
                 {"resources/trace.zip": ("authorization: Bearer " + SERVICE_KEY).encode()})
    assert _load().main_for(tmp_path) == 0
    with zipfile.ZipFile(path) as z:
        assert z.namelist() == ["report.jsonl"], "traces and attachments must not be published"
    data = _all_bytes(path)
    for secret in (PASSWORD, SERVICE_KEY, NEW_KEY):
        assert secret.encode() not in data
    assert data.count(b"[redacted]") == 2
    assert b"locator('input#password')" in data, "CONTROL: the rest of the step survives"


def test_a_secret_that_json_escaped_is_still_found(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    tricky = 'quote"and\\slash-' + "invented"
    monkeypatch.setenv("E2E_PASSWORD", tricky)
    import json

    path = _blob(tmp_path, json.dumps({"title": f'Fill "{tricky}"'}))
    assert _load().main_for(tmp_path) == 0
    assert b"quote" not in _all_bytes(path)


def test_if_redaction_fails_the_report_is_deleted_and_the_step_fails(
    tmp_path: Path, env: None,
) -> None:
    """⚠️ The load-bearing control: fails CLOSED. With redaction broken, the file must
    be gone (so nothing uploads) and the exit code non-zero (so the job knows)."""
    mod = _load()
    mod.__dict__["redact"] = lambda data, secrets: data  # sabotage: redaction does nothing
    path = _blob(tmp_path, "Fill " + PASSWORD)
    assert mod.main_for(tmp_path) == 1
    assert not path.exists()


def test_no_report_is_a_failure_not_a_pass(tmp_path: Path, env: None) -> None:
    assert _load().main_for(tmp_path) == 1


def test_ordinary_results_pass_untouched(tmp_path: Path, env: None) -> None:
    """CONTROL: a report with nothing secret in it is kept, byte for byte."""
    report = '{"title":"the sign-in button waits for a token","status":"passed"}\n'
    path = _blob(tmp_path, report)
    assert _load().main_for(tmp_path) == 0
    assert _all_bytes(path) == report.encode()
