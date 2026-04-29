#!/usr/bin/env python3
"""Strip placeholder/hint examples that reference real-sounding names/addresses/terms.

Rules:
- Any `<div class="field-hint">Example: X</div>` is deleted entirely.
- Specific real-sounding hints (addresses, names, cities, phone numbers, licenses)
  are deleted.
- Specific generic-but-real-feeling hints like "Airport Area" / specific city names
  are deleted.
- Placeholder attributes with the same real-looking strings are cleared to "".
"""
from __future__ import annotations
import pathlib
import re

SRC = pathlib.Path("client/public/broker_tool.html")

# Exact <div class="field-hint">TEXT</div> values to DELETE entirely
DELETE_HINTS = {
    # Real-ish addresses
    "16441 Scientific Way",
    "123 Main St",
    "123 Main St, Irvine, CA",
    "18 Technology Drive, Suite 134",
    "100 Bayview Circle, Suite 600, Newport Beach, CA 92660",
    "Main St &amp; 1st Ave",
    # Cities (too specific)
    "Irvine",
    "Orange",
    "Airport Area",
    # Emails with real-ish domains
    "agent@lee-associates.com",
    "tbarnes@lee-associates.com",
    "you@lee-associates.com",
    # Brand-ish
    "Lee &amp; Associates&#174;-Newport Beach",
    "Lee &amp; Associates - Newport Beach",
}

# Any hint that starts with "Example:" will be deleted.

# Placeholder VALUES to clear
REAL_PLACEHOLDERS = {
    "16441 Scientific Way",
    "123 Main St",
    "123 Main St, Irvine, CA",
    "18 Technology Drive, Suite 134",
    "100 Bayview Circle, Suite 600, Newport Beach, CA 92660",
    "Main St & 1st Ave",
    "Main St &amp; 1st Ave",
    "Irvine",
    "Orange",
    "Airport Area",
    "agent@lee-associates.com",
    "tbarnes@lee-associates.com",
    "you@lee-associates.com",
}


def main() -> None:
    html = SRC.read_text()
    original = html

    # 1) Delete every `<div class="field-hint">Example: ...</div>`
    html, n1 = re.subn(r'<div class="field-hint">Example:[^<]*</div>', "", html)

    # 2) Delete every exact real-ish hint
    n2 = 0
    for h in DELETE_HINTS:
        target = f'<div class="field-hint">{h}</div>'
        count = html.count(target)
        if count:
            html = html.replace(target, "")
            n2 += count

    # 3) Clear placeholder="..." when the value is real-looking or "Example: ..."
    def clear_placeholder(m: re.Match) -> str:
        val = m.group(1)
        if val.startswith("Example:") or val in REAL_PLACEHOLDERS:
            return 'placeholder=""'
        return m.group(0)

    html, n3 = re.subn(
        r'placeholder="([^"]*)"', clear_placeholder, html
    )

    # 4) Clean up stray double blank lines left behind
    html = re.sub(r"\n{3,}", "\n\n", html)

    if html != original:
        SRC.write_text(html)
    print(f"Deleted Example: hints  = {n1}")
    print(f"Deleted exact hints     = {n2}")
    print(f"Placeholder clears seen = {n3} (scan total; only matching-value ones were cleared)")


if __name__ == "__main__":
    main()
