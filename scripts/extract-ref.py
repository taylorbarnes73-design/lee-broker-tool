#!/usr/bin/env python3
"""Decode the uploaded reference HTML and isolate key UI regions."""
from __future__ import annotations
import pathlib, re, json

SRC = pathlib.Path("/home/ubuntu/upload/LeeBrokerTool-Standalone.html")
OUT = pathlib.Path("/home/ubuntu/lee-broker-tool/build_scratch")
OUT.mkdir(exist_ok=True)

raw = SRC.read_text()
# The file appears to be mostly one giant line; unescape \u002F and \n
decoded = raw.encode("utf-8").decode("unicode_escape")
(OUT / "decoded.html").write_text(decoded)
print(f"decoded file size: {len(decoded):,}")

# Pull out the regions of interest by searching for landmarks.
LANDMARKS = [
    "Deal at a Glance",
    "Commission Voucher",
    "gridTemplateColumns",
    "function CommissionVoucher",
    "function DealGlance",
    "function DealSidebar",
    "function Sidebar",
    "function ProgressSteps",
    "Progress",
    "function Card",
    "function Button",
    "lee-eyebrow",
    "sticky",
]
for name in LANDMARKS:
    hits = [m.start() for m in re.finditer(re.escape(name), decoded)]
    print(f"  {name}: {len(hits)} hits  -> first few: {hits[:5]}")
