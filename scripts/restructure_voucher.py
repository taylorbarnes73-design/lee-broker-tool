#!/usr/bin/env python3
"""
Restructures the voucher step flow:
1. Move Property Address to the top of vstep-1 (before Representation Type row)
2. Move Rent Schedule content into vstep-4 (after Rate/SF/Month row, inside v-req-lease)
3. Merge vstep-5 (Commission & Invoice) into vstep-4, remove vstep-5 and vstep-6 as separate steps
4. Renumber eyebrows and sidebar labels accordingly (7 steps -> 5 steps)
"""

with open('client/public/broker_tool.html', 'r') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: Move Property Address to top of vstep-1
# Extract the property address section-divider block from vstep-1
# and move it before the first row (Representation Type row)
# ─────────────────────────────────────────────────────────────────────────────

PROP_ADDR_BLOCK = '''    <div class="section-divider top-gap-md">
      <h3 class="section-heading-tight">Property Address</h3>
      <div class="row c23">
        <div class="field"><label class="req">Street Address</label><input id="v-address"></div>
        <div class="field"><label>APN / Parcel</label><input id="v-apn" placeholder="Optional"></div>
      </div>
      <div class="row c4">
        <div class="field"><label class="req">City</label><input id="v-city"></div>
        <div class="field"><label class="req">State</label><input id="v-state" value="CA"></div>
        <div class="field"><label class="req">Zip</label><input id="v-zip" placeholder="92618" onblur="voucherZipAutofill(this.value)"></div>
        <div class="field"><label class="req">Deal SF</label><input id="v-l-dealsf" placeholder="0" oninput="syncVoucherDealAliases(); calcVoucherLease()"></div>
      </div>
      <input id="v-deal-sf" type="hidden">
      <input id="v-land-sf" type="hidden">
    </div>'''

# The vstep-1 card currently has: h2, tip, row c4 (rep/txn/prop/date), row c3 (suite/deal-type), row c2 (client), then property address section-divider
# We want: h2, tip, PROPERTY ADDRESS section-divider (no top-gap-md, no section-divider wrapper — just the fields), then row c4, row c3, row c2

# New property address block at top (no section-divider wrapper, no top-gap-md)
PROP_ADDR_TOP = '''    <h3 class="section-heading-tight" style="margin-bottom:12px">Property Address</h3>
    <div class="row c23">
      <div class="field"><label class="req">Street Address</label><input id="v-address"></div>
      <div class="field"><label>APN / Parcel</label><input id="v-apn" placeholder="Optional"></div>
    </div>
    <div class="row c4">
      <div class="field"><label class="req">City</label><input id="v-city"></div>
      <div class="field"><label class="req">State</label><input id="v-state" value="CA"></div>
      <div class="field"><label class="req">Zip</label><input id="v-zip" placeholder="92618" onblur="voucherZipAutofill(this.value)"></div>
      <div class="field"><label class="req">Deal SF</label><input id="v-l-dealsf" placeholder="0" oninput="syncVoucherDealAliases(); calcVoucherLease()"></div>
    </div>
    <input id="v-deal-sf" type="hidden">
    <input id="v-land-sf" type="hidden">
    <div class="section-divider top-gap-md">
      <h3 class="section-heading-tight">Deal Details</h3>'''

# The old structure after h2 + tip:
OLD_VSTEP1_AFTER_TIP = '''    <div class="row c4">
      <div class="field"><label class="req">Representation Type</label>'''

NEW_VSTEP1_AFTER_TIP = PROP_ADDR_TOP + '''
      <div class="row c4">
        <div class="field"><label class="req">Representation Type</label>'''

# Also need to close the new section-divider before the end of vstep-1
# The old section-divider (property address) at the end needs to be removed
# and the closing </div> for the new section-divider added before </div> of vstep-1

# Step 1: Replace the opening of the first row to inject property address before it
if OLD_VSTEP1_AFTER_TIP in html:
    html = html.replace(OLD_VSTEP1_AFTER_TIP, NEW_VSTEP1_AFTER_TIP, 1)
    print('✓ Step 1a: Injected property address before Deal Details row')
else:
    print('✗ Step 1a: Could not find the target text for property address injection')

# Step 2: Fix the indentation of the rows that are now inside the section-divider
# The rows inside the new section-divider need to be indented one more level
# (they were at 4 spaces, now inside a section-divider they should be at 6 spaces)
# Actually, let's just close the section-divider before the old property address block

# Remove the old property address section-divider (it's now at the top)
OLD_PROP_ADDR_SECTION = '''    <div class="section-divider top-gap-md">
      <h3 class="section-heading-tight">Property Address</h3>
      <div class="row c23">
        <div class="field"><label class="req">Street Address</label><input id="v-address"></div>
        <div class="field"><label>APN / Parcel</label><input id="v-apn" placeholder="Optional"></div>
      </div>
      <div class="row c4">
        <div class="field"><label class="req">City</label><input id="v-city"></div>
        <div class="field"><label class="req">State</label><input id="v-state" value="CA"></div>
        <div class="field"><label class="req">Zip</label><input id="v-zip" placeholder="92618" onblur="voucherZipAutofill(this.value)"></div>
        <div class="field"><label class="req">Deal SF</label><input id="v-l-dealsf" placeholder="0" oninput="syncVoucherDealAliases(); calcVoucherLease()"></div>
      </div>
      <input id="v-deal-sf" type="hidden">
      <input id="v-land-sf" type="hidden">
    </div>
  </div>'''

NEW_PROP_ADDR_SECTION_END = '''    </div>
  </div>'''

if OLD_PROP_ADDR_SECTION in html:
    html = html.replace(OLD_PROP_ADDR_SECTION, NEW_PROP_ADDR_SECTION_END, 1)
    print('✓ Step 1b: Removed old property address section-divider from bottom of vstep-1')
else:
    print('✗ Step 1b: Could not find old property address section-divider')

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Move Rent Schedule into vstep-4 after Rate/SF/Month row
# ─────────────────────────────────────────────────────────────────────────────

RENT_SCHEDULE_INLINE = '''      <!-- Rent Schedule (inline) -->
      <div id="v-req-rent-inline" class="top-gap-sm">
        <h3>Monthly &amp; Free Rent Schedule</h3>
        <p class="review-copy micro-copy-bottom-sm">Enter $0 for free rent months so effective rates calculate correctly.</p>
        <table class="rent-table" id="v-rent-table">
          <thead><tr><th class="table-col-compact">#</th><th>Monthly Rent $</th><th>Rate/SF/Mo</th><th>Months</th><th>Consideration</th><th title="Commission rate override for this period">Comm %</th><th class="table-col-compact"></th></tr></thead>
          <tbody id="v-rent-body"></tbody>
        </table>
        <button class="btn btn-gray top-gap-sm" onclick="addRentRow()">+ Add Period</button>
        <div class="section-divider">
          <div class="row c4">
            <div class="field"><label>Average Rate/SF/Mo</label><input id="v-avg-rate-sf" class="readonly-fill" placeholder="$0.00" readonly></div>
            <div class="field"><label>Average Monthly Rent</label><input id="v-avg-monthly" class="readonly-fill" placeholder="$0" readonly></div>
            <div class="field"></div>
            <div class="field"></div>
          </div>
        </div>
      </div>'''

# Insert rent schedule after the Rate/SF/Month row (the c4 row with v-l-rate) inside v-req-lease
OLD_AFTER_RATE_ROW = '''      </div>
    </div>
    <div id="v-req-sale" class="is-hidden">'''

NEW_AFTER_RATE_ROW = '''      </div>
''' + RENT_SCHEDULE_INLINE + '''
    </div>
    <div id="v-req-sale" class="is-hidden">'''

if OLD_AFTER_RATE_ROW in html:
    html = html.replace(OLD_AFTER_RATE_ROW, NEW_AFTER_RATE_ROW, 1)
    print('✓ Step 2: Inserted rent schedule inline after Rate/SF/Month row in vstep-4')
else:
    print('✗ Step 2: Could not find target location for rent schedule injection')

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: Merge vstep-5 (Commission & Invoice) into vstep-4
# ─────────────────────────────────────────────────────────────────────────────

# Extract the content of vstep-5 (everything between the opening div and closing div)
# and append it to vstep-4 before its closing </div>

VSTEP5_CONTENT = '''    <div id="v-req-comm-lease">
      <div class="row c4">
        <div class="field"><label class="req">Commission Rate %</label><input id="v-l-comm-rate" oninput="calcCommSummary()"></div>
        <div class="field"><label>Lease Commission Due</label><input id="v-l-comm-due" class="readonly-fill-strong" placeholder="$0" readonly></div>
        <div class="field"><label>Additional Bonus / (Adjustment)</label><input id="v-comm-bonus" placeholder="$0" oninput="calcCommSummary()"></div>
        <div class="field"><label class="invoice-highlight-label">TOTAL INVOICE</label><input id="v-total-invoice" class="invoice-highlight-input" placeholder="$0" readonly></div>
      </div>
      <div class="row c3">
        <div class="field"><label>Consulting/Referral / Flat Fee</label><input id="v-comm-consulting" placeholder="$0" oninput="calcCommSummary()"></div>
        <div class="field"></div>
        <div class="field"></div>
      </div>
    </div>
    <div id="v-req-comm-sale" class="is-hidden">
      <div class="row c3">
        <div class="field"><label class="req">Commission %</label><input id="v-s-comm-pct" oninput="calcVoucherSale()"></div>
        <div class="field"><label>Commission Due $</label><input id="v-s-comm-due" class="readonly-fill-strong" placeholder="$0" readonly></div>
        <div class="field"><label>SALE Commission (auto)</label><input id="v-comm-sale" class="readonly-fill" placeholder="$0" readonly></div>
      </div>
    </div>
    <div class="section-divider voucher-subsection">
      <h3>Invoice To</h3>
      <div class="row c3">
        <div class="field">
          <label>Invoice To (Party)</label>
          <select id="v-invoice-to">
            <option value="">— Select Party —</option>
            <option value="lessor">Lessor / Seller</option>
            <option value="lessee">Lessee / Buyer</option>
            <option value="listing_agent">Listing Agent</option>
            <option value="procuring_agent">Procuring Agent</option>
            <option value="third_party">Third Party (see below)</option>
          </select>
        </div>
        <div class="field is-hidden" id="v-third-party-section">
          <label>Third-Party Company Name</label>
          <input id="v-inv-company"><div class="field-hint">Company name</div>
        </div>
        <div class="field is-hidden" id="v-third-party-addr">
          <label>Third-Party Address</label>
          <input id="v-inv-address"><div class="field-hint">Address</div>
        </div>
      </div>
      <div class="field"><label>Special Invoice Instructions</label><textarea id="v-inv-instructions" rows="2"></textarea><div class="field-hint">Payment schedule, split payments, etc.</div></div>
      <h3 class="top-gap-md">Payment Schedule</h3>
      <table class="broker-table" id="v-payment-table">
        <thead><tr><th>Date Due</th><th>Amount Due</th><th>Date Due</th><th>Amount Due</th><th class="table-col-compact"></th></tr></thead>
        <tbody id="v-payment-body"></tbody>
      </table>
      <button class="btn btn-gray top-gap-sm" onclick="addPaymentRow()">+ Add Payment</button>
      <!-- AI Deal Analysis -->
      <div class="section-divider">
        <h3>AI Deal Analysis</h3>
        <p class="micro-copy">Let AI verify the financials and flag anything that looks off. Results are suggestions only — all calculated fields above are authoritative.</p>
        <button class="btn btn-outline" id="v-ai-calc-btn" onclick="runVoucherAICalculate()">
          <svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:5px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Analyze with AI
        </button>
        <div id="v-ai-calc-panel" class="is-hidden" style="margin-top:14px;"></div>
      </div>
    </div>'''

# The full vstep-5 card to remove
VSTEP5_FULL = '''  <div class="card" id="vstep-5" data-vstep="5" data-step-label="Commission & Invoice" data-card-eyebrow="Step 5 of 7">
    <h2>Step 5 — Commission &amp; Invoice</h2>
''' + VSTEP5_CONTENT + '''
  </div>'''

# The end of vstep-4 (before vstep-5)
OLD_VSTEP4_END = '''  </div>
  <div class="card" id="vstep-5" data-vstep="5" data-step-label="Commission & Invoice" data-card-eyebrow="Step 5 of 7">
    <h2>Step 5 — Commission &amp; Invoice</h2>'''

# New vstep-4 end: append commission content and close, then remove vstep-5 opening
NEW_VSTEP4_END = '''    <div class="section-divider top-gap-md">
      <h3>Commission &amp; Invoice</h3>
    </div>
''' + VSTEP5_CONTENT + '''
  </div>'''

if OLD_VSTEP4_END in html:
    # Find where vstep-5 ends (its closing </div>) and replace the whole block
    # We need to find: OLD_VSTEP4_END + VSTEP5_CONTENT + '\n  </div>'
    OLD_FULL = OLD_VSTEP4_END + '\n' + VSTEP5_CONTENT + '\n  </div>'
    if OLD_FULL in html:
        html = html.replace(OLD_FULL, NEW_VSTEP4_END, 1)
        print('✓ Step 3: Merged vstep-5 into vstep-4 and removed vstep-5 card')
    else:
        print('✗ Step 3: Could not find full vstep-5 content to merge (content mismatch)')
        # Try a simpler approach: just find and replace the vstep-5 card opening
        print('  Trying simpler approach...')
else:
    print('✗ Step 3: Could not find vstep-4 end / vstep-5 start boundary')

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Remove vstep-6 (Rent Schedule) as a separate card
# ─────────────────────────────────────────────────────────────────────────────

OLD_VSTEP6 = '''  <div id="vstep-6" class="card" data-vstep="6" data-step-label="Rent Schedule" data-card-eyebrow="Step 6 of 7">
    <h2>Step 6 — Monthly &amp; Free Rent Schedule</h2>
    <p class="review-copy micro-copy-bottom-sm">Enter $0 for free rent months so effective rates calculate correctly.</p>
    <table class="rent-table" id="v-rent-table">
      <thead><tr><th class="table-col-compact">#</th><th>Monthly Rent $</th><th>Rate/SF/Mo</th><th>Months</th><th>Consideration</th><th title="Commission rate override for this period">Comm %</th><th class="table-col-compact"></th></tr></thead>
      <tbody id="v-rent-body"></tbody>
    </table>
    <button class="btn btn-gray top-gap-sm" onclick="addRentRow()">+ Add Period</button>
    <div class="section-divider">
      <div class="row c4">
        <div class="field"><label>Average Rate/SF/Mo</label><input id="v-avg-rate-sf" class="readonly-fill" placeholder="$0.00" readonly></div>
        <div class="field"><label>Average Monthly Rent</label><input id="v-avg-monthly" class="readonly-fill" placeholder="$0" readonly></div>
        <div class="field"></div>
        <div class="field"></div>
      </div>
    </div>
  </div>'''

if OLD_VSTEP6 in html:
    html = html.replace(OLD_VSTEP6, '', 1)
    print('✓ Step 4: Removed vstep-6 (Rent Schedule) as separate card')
else:
    print('✗ Step 4: Could not find vstep-6 card to remove')

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Update eyebrows and step labels (7 steps -> 5 steps)
# Old: Step 1-7 of 7
# New: Step 1-5 of 5
# vstep-1: Step 1 of 5 (Deal Basics)
# vstep-2: Step 2 of 5 (Broker Information)
# vstep-3: Step 3 of 5 (Client & Property Info)
# vstep-4: Step 4 of 5 (Financial Details + Commission)
# vstep-8: Step 5 of 5 (Review)
# ─────────────────────────────────────────────────────────────────────────────

replacements = [
    ('data-card-eyebrow="Step 1 of 7"', 'data-card-eyebrow="Step 1 of 5"'),
    ('data-card-eyebrow="Step 2 of 7"', 'data-card-eyebrow="Step 2 of 5"'),
    ('data-card-eyebrow="Step 3 of 7"', 'data-card-eyebrow="Step 3 of 5"'),
    ('data-card-eyebrow="Step 4 of 7"', 'data-card-eyebrow="Step 4 of 5"'),
    ('data-card-eyebrow="Step 7 of 7"', 'data-card-eyebrow="Step 5 of 5"'),
    ('<h2>Step 4 — Financial Details</h2>', '<h2>Step 4 — Financial Details &amp; Commission</h2>'),
    ('<h2>Step 7 — Commission Distribution</h2>', '<h2>Step 5 — Commission Distribution</h2>'),
]

for old, new in replacements:
    if old in html:
        html = html.replace(old, new)
        print(f'✓ Step 5: {old[:50]} -> {new[:50]}')
    else:
        print(f'✗ Step 5: Not found: {old[:60]}')

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Update sidebar deal step labels
# ─────────────────────────────────────────────────────────────────────────────

sidebar_replacements = [
    ('<li data-step="5"><span class="deal-step-dot"></span><span class="deal-step-label">Commission &amp; Invoice</span></li>',
     ''),
    ('<li data-step="6"><span class="deal-step-dot"></span><span class="deal-step-label">Rent Schedule</span></li>',
     ''),
    ('<li data-step="4"><span class="deal-step-dot"></span><span class="deal-step-label">Financial Details</span></li>',
     '<li data-step="4"><span class="deal-step-dot"></span><span class="deal-step-label">Financials</span></li>'),
    ('<li data-step="8"><span class="deal-step-dot"></span><span class="deal-step-label">Documents &amp; Distribution</span></li>',
     '<li data-step="8"><span class="deal-step-dot"></span><span class="deal-step-label">Distribution</span></li>'),
]

for old, new in sidebar_replacements:
    if old in html:
        html = html.replace(old, new)
        print(f'✓ Step 6: Sidebar label updated')
    else:
        print(f'✗ Step 6: Not found: {old[:60]}')

# ─────────────────────────────────────────────────────────────────────────────
# Write the result
# ─────────────────────────────────────────────────────────────────────────────

with open('client/public/broker_tool.html', 'w') as f:
    f.write(html)

print('\nDone! File written.')
