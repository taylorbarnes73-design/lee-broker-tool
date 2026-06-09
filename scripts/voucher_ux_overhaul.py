#!/usr/bin/env python3
"""Commission Voucher UX overhaul — restructure broker_tool.html voucher tab."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "client/public/broker_tool.html"

html = HTML_PATH.read_text(encoding="utf-8")

# Extract voucher-main block
start_marker = '  <div class="deal-main" id="voucher-main">'
end_marker = '  </div><!-- /deal-main -->'
start = html.index(start_marker)
end = html.index(end_marker, start)
prefix = html[:start + len(start_marker)]
suffix = html[end:]
old_main = html[start + len(start_marker):end]

# ── Upload (unchanged) ──
upload_start = old_main.index('  <!-- Upload Deal Documents -->')
upload_end = old_main.index('\n\n\n\n  <!-- ═══ SECTION 1:', upload_start)
upload_block = old_main[upload_start:upload_end]

# ── Broker block ──
broker_start = old_main.index('  <!-- ═══ SECTION 5: BROKER REPRESENTATION')
broker_end = old_main.index('  <!-- ═══ SECTION 6: OUTSIDE AGENTS', broker_start)
broker_block = old_main[broker_start:broker_end]

# ── Parties block ──
parties_start = old_main.index('  <!-- ═══ SECTION 2: LESSOR/SELLER')
parties_end = old_main.index('  <!-- ═══ SECTION 3: PROPERTY INFORMATION', parties_start)
parties_block = old_main[parties_start:parties_end]

# ── Property block ──
prop_start = old_main.index('  <!-- ═══ SECTION 3: PROPERTY INFORMATION')
prop_end = old_main.index('  <!-- ═══ SECTION 4: LEASE TRANSACTION', prop_start)
prop_inner = old_main[prop_start:prop_end]
# Strip header, wrap in details
prop_body_start = prop_inner.index('<div class="row c4 compact">')
prop_body = prop_inner[prop_body_start:].rstrip()

# ── Mega financial block ──
mega_start = old_main.index('  <!-- ═══ SECTION 4: LEASE TRANSACTION')
mega_end = old_main.index('  <!-- ═══ SECTION 5: BROKER REPRESENTATION', mega_start)
mega_block = old_main[mega_start:mega_end]

# Extract lease terms (without rent schedule and commission)
lease_start = mega_block.index('    <!-- Lease Details -->')
lease_end = mega_block.index('      <!-- Rent Schedule — Dealius-style lease calculator -->')
lease_block = mega_block[lease_start:lease_end]

rent_start = mega_block.index('      <!-- Rent Schedule — Dealius-style lease calculator -->')
rent_end = mega_block.index('      <div class="field" style="margin-top:12px"><label>Additional Lease Comments</label>')
rent_block = mega_block[rent_start:rent_end]

lease_comments_end = mega_block.index('    </div>\n\n    <!-- Sale Details -->', rent_end)
lease_comments = mega_block[rent_end:lease_comments_end]

sale_start = mega_block.index('    <!-- Sale Details -->')
sale_end = mega_block.index('    <!-- Commission Section -->', sale_start)
sale_block = mega_block[sale_start:sale_end]

comm_start = mega_block.index('    <!-- Commission Section -->')
comm_end = mega_block.index('    <!-- AI Deal Analysis -->', comm_start)
comm_block = mega_block[comm_start:comm_end]

ai_start = mega_block.index('    <!-- AI Deal Analysis -->')
ai_end = mega_block.rindex('  </div>', mega_block.index('</div>\n  </div>', ai_start))
ai_block = mega_block[ai_start:ai_end + len('  </div>')]

# ── Outside agents ──
outside_start = old_main.index('  <!-- ═══ SECTION 6: OUTSIDE AGENTS')
outside_end = old_main.index('  <!-- ═══ SECTION 7: COMMISSION DISTRIBUTION', outside_start)
outside_block = old_main[outside_start:outside_end]

# ── Distribution ──
dist_start = old_main.index('  <!-- ═══ SECTION 7: COMMISSION DISTRIBUTION')
dist_end = old_main.index('  <!-- Action Buttons -->', dist_start)
dist_block = old_main[dist_start:dist_end]

# ── Deal Basics (new simplified) ──
deal_basics = '''  <!-- Deal Basics -->
  <div class="card required-section voucher-section" id="vstep-1" data-vstep="1">
    <div class="voucher-section-header">Deal Basics</div>
    <div class="tip is-hidden top-gap-sm" id="voucher-confidential-warning"></div>
    <div class="row c4">
      <div class="field"><label class="req">Transaction Type</label>
        <select id="v-txn-type" onchange="onVoucherTxnChange()"><option value="lease">Lease</option><option value="sale">Sale</option><option value="referral">Referral</option><option value="sublease">Sublease</option><option value="renewal">Renewal</option><option value="other">Other</option></select>
      </div>
      <div class="field"><label class="req">Property Type</label>
        <select id="v-prop-type"><option value="industrial">Industrial</option><option value="office">Office</option><option value="retail">Retail</option><option value="land">Land</option><option value="other">Other</option></select>
      </div>
      <div class="field"><label class="req">Representation Type</label>
        <select id="v-rep-type" onchange="updateDistributionForRepresentation(); suggestVoucherClientFromRep()">
          <option value="tenant_rep">Tenant Rep</option>
          <option value="landlord_rep">Landlord Rep</option>
          <option value="buyer_rep">Buyer Rep</option>
          <option value="seller_rep">Seller Rep</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="field"><label class="req">Suite / Unit</label><input id="v-suite" placeholder="Ste 100"></div>
    </div>
    <div class="row c4">
      <div class="field"><label class="req">Deal subtype</label>
        <select id="v-deal-type-req">
          <option value="">—</option>
          <option>New</option><option>Renewal</option><option>Expansion</option><option>Relocation</option><option>Blend &amp; Extend</option>
        </select>
      </div>
      <div class="field"><label class="req">Your client (who you represent)</label><input id="v-on-behalf"><div class="field-hint">The party you represented in this deal (tenant, landlord, buyer, or seller).</div></div>
      <div class="field is-hidden" id="v-other-type-field"><label>If Other, Explain</label><input id="v-other-type"></div>
      <div class="field"></div>
    </div>

    <div class="voucher-sub-header">Property Address</div>
    <div class="row c23">
      <div class="field"><label class="req">Street Address</label><input id="v-address"></div>
    </div>
    <div class="row c4">
      <div class="field"><label class="req">City</label><input id="v-city"></div>
      <div class="field"><label class="req">State</label><input id="v-state" value="CA"></div>
      <div class="field"><label class="req">Zip</label><input id="v-zip" placeholder="92618" onblur="voucherZipAutofill(this.value)"></div>
      <div class="field"><label class="req">Deal SF</label><input id="v-l-dealsf" placeholder="0" oninput="syncVoucherDealAliases(); calcVoucherLease(); vMarkRentStale()"></div>
    </div>
    <input id="v-deal-sf" type="hidden">
    <input id="v-land-sf" type="hidden">

    <details class="voucher-accordion top-gap-sm">
      <summary>Listing &amp; compliance details</summary>
      <div class="voucher-accordion-body">
        <div class="row c4">
          <div class="field"><label class="req">Active Listing?</label><select id="v-active-listing"><option value="yes">Yes</option><option value="no">No</option></select></div>
          <div class="field"><label>Close this Listing?</label><select id="v-close-listing"><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></div>
          <div class="field"><label class="req">Confidential?</label><select id="v-confidential"><option value="no">No</option><option value="yes">Yes</option></select></div>
          <div class="field"><label class="req">Date Filled</label><input id="v-date-filled" type="date"></div>
        </div>
        <div class="row c2">
          <div class="field"><label>APN / Parcel</label><input id="v-apn" placeholder="Optional"></div>
          <div class="field"></div>
        </div>
      </div>
    </details>
  </div>
'''

# Fix parties — remove invoice UI, keep hidden selects
parties_block = parties_block.replace(
    '''        <div class="row c2">
          <div class="field"><label>Invoice?</label><select id="v-ls-invoice"><option value="no">No</option><option value="yes">Yes</option></select></div>
          <div class="field"></div>
        </div>
''',
    '''        <select id="v-ls-invoice" class="is-hidden" aria-hidden="true" tabindex="-1"><option value="no">No</option><option value="yes">Yes</option></select>
'''
).replace(
    '''        <div class="row c2">
          <div class="field"><label>Invoice?</label><select id="v-lb-invoice"><option value="no">No</option><option value="yes">Yes</option></select></div>
          <div class="field"></div>
        </div>
''',
    '''        <select id="v-lb-invoice" class="is-hidden" aria-hidden="true" tabindex="-1"><option value="no">No</option><option value="yes">Yes</option></select>
'''
)

# Property accordion
property_accordion = f'''  <!-- Optional property details -->
  <details class="voucher-accordion voucher-section" id="vstep-prop">
    <summary class="voucher-section-header">Optional property details (for comps)</summary>
    <div class="voucher-accordion-body">
{prop_body}
    </div>
  </details>
'''

# Lease/Sale terms card
lease_terms_card = f'''  <!-- Lease/Sale Terms -->
  <div class="card voucher-section" id="vstep-4" data-vstep="4">
    <div class="voucher-section-header">Lease/Sale Terms</div>
{lease_block}
{sale_block}
{lease_comments}
  </div>
'''

# Rent schedule card
rent_steps = '''        <div class="v-rent-steps" id="v-rent-steps" aria-label="Rent schedule steps">
          <div class="v-rent-step" data-step="1"><span class="v-rent-step-num">1</span> Set rate, term &amp; SF</div>
          <div class="v-rent-step" data-step="2"><span class="v-rent-step-num">2</span> Generate schedule</div>
          <div class="v-rent-step" data-step="3"><span class="v-rent-step-num">3</span> Confirm consideration</div>
        </div>
'''
rent_block = rent_block.replace(
    '        <div class="voucher-sub-header">Lease Calculator &amp; Rent Schedule</div>',
    '        <div class="voucher-sub-header">Rent Schedule</div>\n' + rent_steps
)
rent_card = f'''  <!-- Rent Schedule -->
  <div class="card voucher-section" id="vstep-5" data-vstep="5">
{rent_block}
  </div>
'''

# Commission card — relabel AI section
comm_block = comm_block.replace(
    '    <div class="voucher-sub-header" style="margin-top:20px">Commission &amp; Invoice</div>',
    '    <div class="voucher-section-header">Commission &amp; Invoice</div>'
)
comm_block = comm_block.replace(
    '<div class="field"><label class="req">Commission Rate %</label><input id="v-l-comm-rate" oninput="calcCommSummary()"></div>',
    '<div class="field"><label class="req">Commission Rate %</label><input id="v-l-comm-rate" oninput="calcCommSummary(); updateVoucherCommRateWarn()"><div class="field-hint field-hint-warn is-hidden" id="v-comm-rate-warn">Generate a rent schedule before setting commission rate.</div></div>'
)
comm_block = comm_block.replace(
    '<div class="field"><label>Consulting/Referral / Flat Fee</label><input id="v-comm-consulting" placeholder="$0" oninput="calcCommSummary()"></div>',
    '<div class="field v-simplified-fee-field"><label>Consulting/Referral / Flat Fee</label><input id="v-comm-consulting" placeholder="$0" oninput="calcCommSummary()"></div>'
)

ai_block = ai_block.replace(
    '      <div class="voucher-sub-header">AI Deal Analysis</div>\n      <p class="micro-copy">Let AI verify the financials and flag anything that looks off.</p>',
    '      <div class="voucher-sub-header">Double-check my numbers</div>\n      <p class="micro-copy">Verifies commission math against uploaded documents. Upload AI at the top remains the primary auto-fill.</p>'
).replace(
    '        Analyze with AI',
    '        Verify commission math'
)

comm_card = f'''  <!-- Commission & Invoice -->
  <div class="card voucher-section" id="vstep-6" data-vstep="6">
{comm_block}
{ai_block}
  </div>
'''

# Distribution — simplify table header
dist_block = dist_block.replace(
    '<thead><tr><th>Agent Name</th><th class="table-col-100">Side</th><th class="table-col-65">Gross %</th><th data-dist-gross="listing">Listing Gross</th><th data-dist-gross="procuring">Procuring Gross</th><th data-dist-gross="both">Both Gross</th><th data-dist-gross="other">Other Gross</th><th data-dist-gross="referring">Referring Gross</th><th>NET (ck amt)</th><th class="table-col-compact"></th></tr></thead>',
    '<thead><tr><th>Agent Name</th><th class="table-col-100">Side</th><th class="table-col-65">Gross %</th><th class="dist-gross-col" data-dist-gross="listing">Listing Gross</th><th class="dist-gross-col" data-dist-gross="procuring">Procuring Gross</th><th class="dist-gross-col" data-dist-gross="both">Both Gross</th><th class="dist-gross-col" data-dist-gross="other">Other Gross</th><th class="dist-gross-col" data-dist-gross="referring">Referring Gross</th><th>Net $</th><th class="table-col-compact"></th></tr></thead>'
)
dist_block = dist_block.replace('id="vstep-8"', 'id="vstep-8" data-vstep="8"')

# Action bar
action_bar = '''  <!-- Action Buttons -->
  <div class="btn-bar voucher-action-bar">
    <button class="btn btn-red" onclick="openReviewSnapshotWithSpinner(this, 'voucher')"><span class="btn-spinner"></span><span class="btn-label">Review Before Send</span></button>
    <button class="btn btn-gray" type="button" onclick="saveCurrentDraft('voucher', this)"><span class="btn-spinner"></span><span class="btn-label">Save Draft</span></button>
    <button class="btn btn-gray" onclick="exportVoucherExcelWithSpinner(this)"><span class="btn-spinner"></span><span class="btn-label">Download Excel</span></button>
    <div class="btn-more-wrap">
      <button type="button" class="btn btn-outline btn-more" onclick="toggleVoucherMoreActions(this)" aria-expanded="false" aria-controls="voucher-more-menu">More ▾</button>
      <div class="btn-more-menu is-hidden" id="voucher-more-menu" role="menu">
        <button type="button" class="btn btn-outline" role="menuitem" onclick="switchTab('sign')">Remove Signs &rarr;</button>
        <button type="button" class="btn btn-gray" role="menuitem" onclick="setBtnLoading(this,true,'Clearing…');setTimeout(()=>{clearVoucher();setBtnLoading(this,false);},80)"><span class="btn-spinner"></span><span class="btn-label">Clear Form</span></button>
      </div>
    </div>
  </div>
'''

# Add data-vstep to upload and broker
upload_block = upload_block.replace('id="vstep-upload"', 'id="vstep-upload" data-vstep="upload"')
broker_block = broker_block.replace('id="vstep-2"', 'id="vstep-2" data-vstep="2"')
parties_block = parties_block.replace('id="vstep-3"', 'id="vstep-3" data-vstep="3"')

new_main = (
    '\n' + upload_block + '\n\n'
    + deal_basics + '\n'
    + broker_block
    + parties_block
    + property_accordion + '\n'
    + lease_terms_card + '\n'
    + rent_card + '\n'
    + comm_card + '\n'
    + outside_block
    + dist_block
    + action_bar
)

html = prefix + new_main + suffix

# Update sidebar steps
old_sidebar = '''      <ol class="deal-steps" id="dg-steps">
        <li data-step="0"><span class="deal-step-dot"></span><span class="deal-step-label">Upload Docs</span></li>
        <li data-step="1"><span class="deal-step-dot"></span><span class="deal-step-label">Deal Basics</span></li>
        <li data-step="2"><span class="deal-step-dot"></span><span class="deal-step-label">Broker Info</span></li>
        <li data-step="3"><span class="deal-step-dot"></span><span class="deal-step-label">Parties</span></li>
        <li data-step="4"><span class="deal-step-dot"></span><span class="deal-step-label">Financials</span></li>
        <li data-step="8"><span class="deal-step-dot"></span><span class="deal-step-label">Distribution</span></li>
      </ol>'''

new_sidebar = '''      <ol class="deal-steps" id="dg-steps">
        <li data-step="upload" data-vstep="upload"><span class="deal-step-dot"></span><span class="deal-step-label">Upload Docs</span></li>
        <li data-step="1" data-vstep="1"><span class="deal-step-dot"></span><span class="deal-step-label">Deal Basics</span></li>
        <li data-step="2" data-vstep="2"><span class="deal-step-dot"></span><span class="deal-step-label">Broker Info</span></li>
        <li data-step="3" data-vstep="3"><span class="deal-step-dot"></span><span class="deal-step-label">Parties</span></li>
        <li data-step="4" data-vstep="4"><span class="deal-step-dot"></span><span class="deal-step-label">Deal Math</span></li>
        <li data-step="6" data-vstep="6"><span class="deal-step-dot"></span><span class="deal-step-label">Commission</span></li>
        <li data-step="8" data-vstep="8"><span class="deal-step-dot"></span><span class="deal-step-label">Distribution</span></li>
      </ol>'''

if old_sidebar not in html:
    raise SystemExit("Could not find sidebar steps block")
html = html.replace(old_sidebar, new_sidebar)

# Update sidebar actions
html = html.replace(
    '''    <div class="deal-actions">
      <button class="btn btn-gray" onclick="exportVoucherExcelWithSpinner(this)"><span class="btn-spinner"></span><span class="btn-label">Download Excel Voucher</span></button>
      <button class="btn btn-red" onclick="openReviewSnapshotWithSpinner(this, 'voucher')"><span class="btn-spinner"></span><span class="btn-label">Review Before Send</span></button>
    </div>''',
    '''    <div class="deal-actions">
      <button class="btn btn-red" onclick="openReviewSnapshotWithSpinner(this, 'voucher')"><span class="btn-spinner"></span><span class="btn-label">Review Before Send</span></button>
      <button class="btn btn-gray" type="button" onclick="saveCurrentDraft('voucher', this)"><span class="btn-spinner"></span><span class="btn-label">Save Draft</span></button>
      <button class="btn btn-gray" onclick="exportVoucherExcelWithSpinner(this)"><span class="btn-spinner"></span><span class="btn-label">Download Excel</span></button>
    </div>'''
)

# Add validation modal before send-admin-modal if not present
validation_modal = '''
<div class="modal-overlay is-hidden" id="voucher-validation-modal" role="dialog" aria-labelledby="voucher-validation-title" aria-modal="true">
  <div class="modal-card voucher-validation-card">
    <h2 id="voucher-validation-title">Complete these items before review</h2>
    <p class="micro-copy">Fix the items below, then try Review Before Send again.</p>
    <ul class="voucher-validation-list" id="voucher-validation-list"></ul>
    <div class="modal-actions">
      <button type="button" class="btn btn-red" onclick="closeVoucherValidationModal()">Go fix items</button>
    </div>
  </div>
</div>
'''
if 'id="voucher-validation-modal"' not in html:
    html = html.replace('<div class="modal-overlay" id="send-admin-modal">', validation_modal + '\n<div class="modal-overlay" id="send-admin-modal">')

HTML_PATH.write_text(html, encoding="utf-8")
print("✓ Voucher UX HTML restructure complete")
