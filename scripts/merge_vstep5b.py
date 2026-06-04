#!/usr/bin/env python3
"""Merges vstep-5 content into vstep-4 using exact whitespace matching."""

with open('client/public/broker_tool.html', 'r') as f:
    html = f.read()

# From the debug output, the exact boundary is:
# 'div>\n    </div>\n  </div>\n\n  <div class="card" id="vstep-5"...'
# Note the \n\n (blank line) before vstep-5

OLD = '  </div>\n\n  <div class="card" id="vstep-5" data-vstep="5" data-step-label="Commission & Invoice" data-card-eyebrow="Step 5 of 7">\n    <h2>Step 5 \u2014 Commission &amp; Invoice</h2>\n    <div id="v-req-comm-lease">'

NEW = '    <div class="section-divider top-gap-md">\n      <h3>Commission &amp; Invoice</h3>\n    </div>\n    <div id="v-req-comm-lease">'

if OLD in html:
    html = html.replace(OLD, NEW, 1)
    print('✓ Merged vstep-5 opening into vstep-4')
else:
    print('✗ Still not found — trying without the em dash encoding...')
    # Try with the actual em dash character
    OLD2 = '  </div>\n\n  <div class="card" id="vstep-5" data-vstep="5" data-step-label="Commission & Invoice" data-card-eyebrow="Step 5 of 7">\n    <h2>Step 5 — Commission &amp; Invoice</h2>\n    <div id="v-req-comm-lease">'
    if OLD2 in html:
        html = html.replace(OLD2, NEW, 1)
        print('✓ Merged vstep-5 opening into vstep-4 (em dash variant)')
    else:
        print('✗ Failed both variants')
        idx = html.find('id="vstep-5"')
        print(repr(html[idx-30:idx+200]))

# Now remove the extra closing </div> from old vstep-5 wrapper
# From debug: '...v-ai-calc-panel...></div>\n      </div>\n    </div>\n  </div>\n\n\n\n  <div class="card" id="vstep-8"'
# The \n\n\n\n is from the removed vstep-6 card (blank lines remain)
# After merge, the structure ends with:
#   </div>  <- closes AI Deal Analysis section-divider  
#   </div>  <- closes section-divider voucher-subsection
#   </div>  <- was vstep-5 card closing (now extra)
# (blank lines from removed vstep-6)
# <div vstep-8>

OLD_EXTRA = '    </div>\n  </div>\n\n\n\n  <div class="card" id="vstep-8"'
NEW_EXTRA = '    </div>\n  </div>\n\n  <div class="card" id="vstep-8"'

if OLD_EXTRA in html:
    html = html.replace(OLD_EXTRA, NEW_EXTRA, 1)
    print('✓ Removed extra closing </div> from old vstep-5 wrapper')
else:
    print('✗ Extra </div> pattern not found — checking...')
    idx = html.find('id="vstep-8"')
    print(repr(html[idx-200:idx+50]))

with open('client/public/broker_tool.html', 'w') as f:
    f.write(html)

print('Done.')
