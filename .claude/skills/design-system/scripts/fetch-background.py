#!/usr/bin/env python3
"""Create or download a slide background image URL for a search query."""

import argparse
import json
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import urlretrieve


def background_url(query, width, height):
    encoded = quote_plus(query)
    return f"https://source.unsplash.com/{width}x{height}/?{encoded}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="Image search query")
    parser.add_argument("-o", "--output", help="Optional file path to download")
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--height", type=int, default=900)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    url = background_url(args.query, args.width, args.height)
    result = {"query": args.query, "url": url, "output": args.output}

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(url, args.output)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(url)


if __name__ == "__main__":
    main()
