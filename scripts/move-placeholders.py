#!/usr/bin/env python3
"""
Move placeholder "examples" out of <input> / <textarea> elements and into a
small hint line rendered under the field.

Design decisions
----------------
- A placeholder is treated as a FORMAT token (kept as-is) when it looks like:
    "$0", "$0.00", "0", "0%", "4/1,000", "24'", "—", "Optional", and a few
    canonical shapes (pure digits, currency, percent, ratio, foot notation).
- A placeholder is treated as an EXAMPLE (moved out of the box) when it
  contains alphabetic characters beyond those narrow format tokens, or when
  it starts with "e.g. ", "Example:", "ex ", etc.
- The emitted hint uses <div class="field-hint">…</div> directly after the
  input/textarea. CSS in broker_tool.css renders this as small muted text.
- For canonical "e.g. X" placeholders, the hint reads "Example: X" instead of
  repeating the "e.g." prefix.
- `aria-describedby` is not added to keep the change surgical and avoid ID
  churn; the visual hint is immediately adjacent so SR users still get it.
- Script is idempotent: running it twice is a no-op because we only act on
  inputs still carrying a placeholder that matches the example heuristic.
"""

from __future__ import annotations
import re
import sys
import pathlib

TARGET = pathlib.Path(__file__).resolve().parent.parent / "client" / "public" / "broker_tool.html"

# Tokens/patterns that indicate a format cue, not a real example -------------
FORMAT_LITERALS = {
    "", "—", "-", "Optional", "optional",
    "$0", "$0.00", "0", "0%", "00", "000",
    "Ste 100",  # suite placeholder — keep as format hint
}
# Regex: pure number / currency / percent / ratio / feet / year / zip / phone
FORMAT_PATTERNS = [
    re.compile(r"^\$?\d[\d,]*(\.\d+)?%?$"),            # 1, 1.5, $0.00, 5%
    re.compile(r"^\d+/\d+(?:,\d+)?$"),                 # 4/1,000
    re.compile(r"^\d+['’]$"),                          # 24' (feet)
    re.compile(r"^\d{4}$"),                            # 1995 (year)
    re.compile(r"^\d{5}(-\d{4})?$"),                   # 92618
    re.compile(r"^\(\d{3}\)\s*\d{3}-\d{4}$"),          # (949) 555-1212
]

# Tags for placeholder recognition ------------------------------------------
# We only touch input and textarea tags on a single line.
INPUT_RE = re.compile(
    r"(?P<open><(?P<tag>input|textarea)\b[^>]*?)"
    r"\s+placeholder=\"(?P<ph>[^\"]*)\""
    r"(?P<rest>[^>]*?)"
    r"(?P<close>/?>)"
    r"(?P<tail>(?:</textarea>)?)",
    re.IGNORECASE,
)

SKIP_ID_PREFIXES = (
    # Search / query boxes are keyword-style hints, leave them alone.
    "cr-query",
    "em-",  # email modal fields already render clearly
)


def is_format_only(ph: str) -> bool:
    s = ph.strip()
    if s in FORMAT_LITERALS:
        return True
    for pat in FORMAT_PATTERNS:
        if pat.match(s):
            return True
    # Purely symbolic
    if not re.search(r"[A-Za-z]", s):
        return True
    return False


def normalized_hint(ph: str) -> str:
    """Turn the placeholder text into a user-visible hint line."""
    s = ph.strip()
    # "e.g. 60"  -> "Example: 60"
    m = re.match(r"^(e\.g\.?|ex\.?|example[:\s])\s*(.+)$", s, re.IGNORECASE)
    if m:
        body = m.group(2).strip().rstrip(".")
        return f"Example: {body}"
    # "Start typing agent name..." already reads as a hint.
    return s


def extract_id(attrs: str) -> str | None:
    m = re.search(r'\bid="([^"]+)"', attrs)
    return m.group(1) if m else None


def process_line(line: str) -> str:
    """Rewrite <input placeholder='...'> ... on a single line."""
    def _sub(m: re.Match) -> str:
        open_part = m.group("open")
        tag = m.group("tag").lower()
        ph = m.group("ph")
        rest = m.group("rest")
        close = m.group("close")
        tail = m.group("tail")
        attrs = open_part + rest  # concat for lookup only

        # Skip opt-out IDs
        iid = extract_id(attrs)
        if iid and any(iid.startswith(p) for p in SKIP_ID_PREFIXES):
            return m.group(0)

        # Format-only placeholders stay untouched
        if is_format_only(ph):
            return m.group(0)

        # Rebuild element WITHOUT the placeholder attribute
        rebuilt = open_part + rest + close + tail
        hint = normalized_hint(ph)
        # Emit the hint immediately after
        return rebuilt + f'<div class="field-hint">{hint}</div>'

    return INPUT_RE.sub(_sub, line)


def main() -> int:
    src = TARGET.read_text()
    out_lines = []
    for line in src.splitlines(keepends=True):
        out_lines.append(process_line(line))
    dst = "".join(out_lines)
    if dst == src:
        print("no changes", file=sys.stderr)
        return 0
    TARGET.write_text(dst)
    # Simple stat summary
    before = len(re.findall(r'placeholder="[^"]*"', src))
    after = len(re.findall(r'placeholder="[^"]*"', dst))
    hints = dst.count('class="field-hint"') - src.count('class="field-hint"')
    print(f"placeholders: {before} -> {after}")
    print(f"hints added : {hints}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
