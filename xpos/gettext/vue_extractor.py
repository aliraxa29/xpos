# Copyright (c) 2025, Ali Raza and contributors
# For license information, please see license.txt

"""
Custom Babel extractor for Vue SFC (Single-File Component) and TypeScript files.

Frappe's default Vue extractor (html_template) only recognises ``_()``.
The xpos frontend uses ``__()`` from ``@/lib/translate``.  This extractor
uses a simple regex to find every ``__("…")`` / ``__('…')`` call regardless
of whether it appears inside ``<template>``, ``<script>``, or plain ``.ts``
source.  It correctly yields ``pgettext`` when a third *context* argument is
supplied.
"""

from __future__ import annotations

import re
from io import BufferedReader

# ---------------------------------------------------------------------------
# Match patterns:
#   __("message")
#   __('message')
#   __("message", [args])
#   __("message", [args], "context")
#   __("message", null, "context")
# ---------------------------------------------------------------------------
_CALL_PATTERN = re.compile(
    r"""__\(\s*"""
    # ── message ──────────────────────────────────────────────────────────
    r"""(?P<q1>["'])"""  # opening quote (single or double)
    r"""(?P<message>(?:(?!(?P=q1)).)*?)"""  # message body (non-greedy)
    r"""(?P=q1)"""  # closing quote (must match opener)
    # ── optional second arg (array / null) ───────────────────────────────
    r"""(?:\s*,\s*(?:\[.*?\]|null))?"""
    # ── optional context string (3rd positional arg) ─────────────────────
    r"""(?:\s*,\s*"""
    r"""(?P<q2>["'])"""
    r"""(?P<context>(?:(?!(?P=q2)).)*?)"""
    r"""(?P=q2)"""
    r""")?"""
    # ── closing paren ────────────────────────────────────────────────────
    r"""\s*\)""",
    re.DOTALL,
)


def extract(
    fileobj: BufferedReader,
    keywords: list[str],
    comment_tags: tuple[str, ...],
    options: dict,
):
    """Babel extraction interface.

    Yields ``(lineno, funcname, message(s), comments)`` tuples that Babel's
    catalog builder understands.
    """
    code = fileobj.read().decode("utf-8")

    for m in _CALL_PATTERN.finditer(code):
        message = m.group("message")
        if not message or not _is_translatable(message):
            continue

        context = m.group("context")
        lineno = code[: m.start()].count("\n") + 1

        if context:
            yield lineno, "pgettext", (context, message), []
        else:
            yield lineno, "gettext", message, []


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
_NON_TRANSLATABLE = re.compile(
    r"^(fa fa-|eval:)|px$"
)


def _is_translatable(text: str) -> bool:
    """Return *True* if *text* looks like a real translatable string."""
    if not re.search(r"[a-zA-Z]", text):
        return False
    if _NON_TRANSLATABLE.search(text):
        return False
    return True
