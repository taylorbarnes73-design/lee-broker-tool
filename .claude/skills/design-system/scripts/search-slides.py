#!/usr/bin/env python3
"""Search slide decision CSVs with lightweight keyword scoring."""

import argparse
import csv
import json
import re
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DOMAIN_FILES = {
    "strategy": "slide-strategies.csv",
    "strategies": "slide-strategies.csv",
    "layout": "slide-layouts.csv",
    "layouts": "slide-layouts.csv",
    "typography": "slide-typography.csv",
    "color": "slide-color-logic.csv",
    "background": "slide-backgrounds.csv",
    "copy": "slide-copy.csv",
    "chart": "slide-charts.csv",
}


def tokenize(value):
    return set(re.findall(r"[a-z0-9]+", value.lower()))


def load_rows(domain):
    files = [DOMAIN_FILES[domain]] if domain else sorted(DOMAIN_FILES.values())
    seen = set()

    for filename in files:
        if filename in seen:
            continue
        seen.add(filename)

        path = DATA_DIR / filename
        if not path.exists():
            continue

        with path.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                row["_source"] = filename
                yield row


def score_row(query_terms, row):
    haystack = " ".join(str(value) for value in row.values())
    row_terms = tokenize(haystack)
    return sum(3 if term in row_terms else 0 for term in query_terms) + sum(
        haystack.lower().count(term) for term in query_terms
    )


def search(query, domain=None, limit=5):
    query_terms = tokenize(query)
    scored = []

    for row in load_rows(domain):
        score = score_row(query_terms, row)
        if score > 0:
            scored.append((score, row))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [{"score": score, **row} for score, row in scored[:limit]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="Search query, e.g. 'investor pitch'")
    parser.add_argument(
        "-d", "--domain", choices=sorted(DOMAIN_FILES), help="CSV domain"
    )
    parser.add_argument("--context", action="store_true", help="Include context fields")
    parser.add_argument("--position", type=int, help="Slide position for contextual search")
    parser.add_argument("--total", type=int, help="Total slide count for contextual search")
    parser.add_argument("--prev-emotion", help="Previous slide emotion")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    results = search(args.query, args.domain, args.limit)
    if args.context:
        for result in results:
            result["_context"] = {
                "position": args.position,
                "total": args.total,
                "prev_emotion": args.prev_emotion,
            }

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for result in results:
            label = (
                result.get("strategy_name")
                or result.get("layout_name")
                or result.get("id")
            )
            print(f"[{result['score']}] {label} ({result['_source']})")


if __name__ == "__main__":
    main()
