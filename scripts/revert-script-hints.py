#!/usr/bin/env python3
"""
Undo placeholder moves that landed inside <script>...</script> blocks.

Strategy:
- For each line that lives inside a <script> block, find
  `<input ...><div class="field-hint">HINT</div>` patterns (including trailing
  whitespace) and rewrite to `<input ... placeholder="HINT">`.
- If the input already has a placeholder attribute, leave it and strip the
  field-hint div (to avoid double-hinting).
- Multi-line template literals are handled as single-line matches, since the
  script that created this mess always emitted both elements on the same line.
"""

from __future__ import annotations
import re
import pathlib
import sys

TARGET = pathlib.Path(__file__).resolve().parent.parent / "client" / "public" / "broker_tool.html"

# Match an input/textarea element immediately followed by a field-hint div.
# Group 'open' is `<input ...>` or `<textarea ...></textarea>`.
PAT = re.compile(
    r'(<input\b[^>]*?>)(\s*)<div class="field-hint">([^<]*)</div>'
)


def already_has_placeholder(tag: str) -> bool:
    return re.search(r'\bplaceholder="', tag) is not None


def inject_placeholder(tag: str, hint: str) -> str:
    # Put placeholder="..." before the closing >
    return re.sub(r">$", f' placeholder="{hint}">', tag.rstrip(), count=1)


def main() -> int:
    src = TARGET.read_text()
    lines = src.split("\n")
    in_script = False
    changed = 0
    for i, line in enumerate(lines):
        # Toggle in_script for lines that open/close a <script> element
        if "<script" in line and "</script" not in line:
            in_script = True
            continue
        if "</script" in line and "<script" not in line:
            in_script = False
            continue
        if not in_script:
            continue
        # Also handle the special <script> tag lines (where markers sit on the
        # same line as <script>) -- rare, so not addressed here.
        def _repl(m: re.Match) -> str:
            nonlocal changed
            changed += 1
            tag = m.group(1)
            hint = m.group(3).strip()
            if already_has_placeholder(tag) or not hint:
                return tag
            return inject_placeholder(tag, hint)

        new_line, n = PAT.subn(_repl, line)
        if n:
            lines[i] = new_line

    if changed == 0:
        print("no bad injections found", file=sys.stderr)
        return 0
    TARGET.write_text("\n".join(lines))
    print(f"reverted {changed} script-side hint injections")
    return 0


if __name__ == "__main__":
    sys.exit(main())
