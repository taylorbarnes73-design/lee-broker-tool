#!/usr/bin/env python3
"""Validate slide HTML files for design-token usage."""

import argparse
import json
import re
from pathlib import Path


HEX_COLOR_RE = re.compile(r"#[0-9A-Fa-f]{3,8}\b")


def validate_slide(path):
    content = Path(path).read_text(encoding="utf-8")
    issues = []
    warnings = []

    if "design-tokens.css" not in content:
        issues.append("Slide does not import assets/design-tokens.css")

    hardcoded = sorted(set(HEX_COLOR_RE.findall(content)))
    if hardcoded:
        issues.append("Hardcoded color values found: " + ", ".join(hardcoded))

    if "var(--" not in content:
        warnings.append("No CSS variable token usage detected")

    return {
        "file": str(path),
        "valid": not issues,
        "issues": issues,
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", help="Slide HTML files to validate")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    results = [validate_slide(path) for path in args.files]
    valid = all(result["valid"] for result in results)

    if args.json:
        print(json.dumps({"valid": valid, "results": results}, indent=2))
    else:
        for result in results:
            status = "PASS" if result["valid"] else "FAIL"
            print(f"{status}: {result['file']}")
            for issue in result["issues"]:
                print(f"  - {issue}")
            for warning in result["warnings"]:
                print(f"  - Warning: {warning}")

    raise SystemExit(0 if valid else 1)


if __name__ == "__main__":
    main()
