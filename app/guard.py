"""Leakage firewall + input guard.

Three defensive layers live here:
  1. FORBIDDEN-substring / exact-name rejection (Cath, LAD, LCX, RCA and the
     per-target DROP list) -- a request carrying an angiography result is 422.
  2. Physiological range chips + the hard `<18` age block.
  3. An append-only audit log line for every rejection.
"""
from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path
from typing import Any

from .features import FEATURES, FORBIDDEN, FORBIDDEN_ANY, RANGES

AUDIT_PATH = Path(__file__).resolve().parent.parent / "artifacts" / "guard_audit.log"

# Substrings that may never appear in a field name.
_FORBIDDEN_SUBSTRINGS = ("cath", "stenos", "angio", "lad", "lcx", "rca")

_NUMERIC = {f["name"] for f in FEATURES if f["kind"] == "num"}
_BINARY = {f["name"] for f in FEATURES if f["kind"] == "bin"}
_CATEGORICAL = {f["name"]: f["options"] for f in FEATURES if f["kind"] == "cat"}
_ALLOWED = set(_NUMERIC) | set(_BINARY) | set(_CATEGORICAL)


class GuardError(ValueError):
    """Raised for any firewall / range / age violation (mapped to HTTP 422)."""

    def __init__(self, code: str, message: str, field: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field


def audit(event: str, detail: dict[str, Any]) -> None:
    try:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        line = {
            "ts": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
            "event": event,
            **detail,
        }
        with AUDIT_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(line, default=str) + "\n")
    except Exception:  # audit must never break a request
        pass


def assert_no_forbidden(target: str, columns: list[str]) -> None:
    """Training-time assertion: the per-target DROP list is absent."""
    drop = set(FORBIDDEN[target])
    leaked = [c for c in columns if c in drop]
    if leaked:
        raise GuardError("leakage", f"{target}: forbidden columns present: {leaked}")
    for c in columns:
        low = c.lower()
        if any(s in low for s in _FORBIDDEN_SUBSTRINGS):
            raise GuardError("leakage", f"{target}: forbidden substring in column {c!r}")


def validate_payload(raw: dict[str, Any]) -> dict[str, Any]:
    """Validate a /predict payload. Returns a clean, type-coerced dict.

    Raises GuardError(code) for any violation; the router maps it to 422.
    """
    if not isinstance(raw, dict):
        raise GuardError("malformed", "payload must be a JSON object")

    clean: dict[str, Any] = {}

    for key, value in raw.items():
        if value is None:
            continue
        low = key.lower()
        if key in FORBIDDEN_ANY or any(s in low for s in _FORBIDDEN_SUBSTRINGS):
            audit("forbidden_field", {"field": key})
            raise GuardError("leakage", f"'{key}' is an angiography result and may never be an input", key)
        if key not in _ALLOWED:
            audit("unknown_field", {"field": key})
            raise GuardError("unknown", f"unknown field '{key}' (extra fields are forbidden)", key)
        clean[key] = value

    # --- age: must exist, be >= 18 -------------------------------------
    if "Age" in clean:
        try:
            age = float(clean["Age"])
        except (TypeError, ValueError):
            raise GuardError("range", "Age must be a number", "Age")
        if age < 18:
            audit("underage", {"age": age})
            raise GuardError("underage", "This screening aid is validated for adults (age 18+).", "Age")
        clean["Age"] = int(round(age))

    # --- type + category coercion --------------------------------------
    for field, value in list(clean.items()):
        if field in _NUMERIC:
            try:
                clean[field] = float(value)
            except (TypeError, ValueError):
                raise GuardError("range", f"{field} must be numeric", field)
        elif field in _BINARY:
            if value in (True, "true", "True", "1", 1):
                clean[field] = 1
            elif value in (False, "false", "False", "0", 0):
                clean[field] = 0
            else:
                raise GuardError("range", f"{field} must be 0 or 1", field)
        elif field in _CATEGORICAL:
            opts = _CATEGORICAL[field]
            if value not in opts:
                # tolerate numeric-ish categoricals sent as numbers
                coerced = str(value)
                if coerced in opts:
                    clean[field] = coerced
                else:
                    raise GuardError("range", f"{field} must be one of {opts}", field)
            else:
                clean[field] = value

    # --- range chips ----------------------------------------------------
    for field, (lo, hi) in RANGES.items():
        if field in clean:
            v = clean[field]
            if v < lo or v > hi:
                audit("range_violation", {"field": field, "value": v, "min": lo, "max": hi})
                raise GuardError("range", f"{field} must be between {lo:g} and {hi:g}", field)

    return clean


def fill_defaults(values: dict[str, Any], defaults: dict[str, Any]) -> dict[str, Any]:
    out = dict(defaults)
    out.update(values)
    return out