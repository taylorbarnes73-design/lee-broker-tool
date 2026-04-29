#!/usr/bin/env python3
"""Survey the Metropolis comp workbook without loading it all into memory."""
import sys
from openpyxl import load_workbook

path = '/home/ubuntu/upload/LeeIrvine_Metropolis_CompData.xlsx'
wb = load_workbook(path, read_only=True, data_only=True)
print(f'FILE: {path}')
print(f'SHEETS: {wb.sheetnames}')
print()

for name in wb.sheetnames:
    ws = wb[name]
    # read_only ws.max_row/max_column may be None until iterated; count from the iterator
    first_rows = []
    header = None
    count = 0
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        count += 1
        if i < 3:
            first_rows.append(row)
        if i == 0:
            header = row
        if i >= 5 and count > 50000:
            # don't fully count massive sheets
            break
    # ask ws.max_row again
    try:
        dim = ws.calculate_dimension()
    except Exception:
        dim = '?'
    print(f'--- {name} | dim={dim} | sampled rows={count} ---')
    if header is not None:
        print(f'  HEADER ({len(header)} cols):')
        for j, h in enumerate(header):
            print(f'    [{j:02d}] {h!r}')
    print(f'  row1: {first_rows[1] if len(first_rows) > 1 else None}')
    print(f'  row2: {first_rows[2] if len(first_rows) > 2 else None}')
    print()

# check for embedded images
print('--- images in workbook ---')
wb2 = load_workbook(path, read_only=False, data_only=True)
total_images = 0
for name in wb2.sheetnames:
    ws = wb2[name]
    n = len(getattr(ws, '_images', []))
    if n:
        print(f'  {name}: {n} images')
        total_images += n
print(f'  TOTAL: {total_images}')
