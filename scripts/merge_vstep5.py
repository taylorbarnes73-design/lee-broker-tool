#!/usr/bin/env python3
"""Merges vstep-5 content into vstep-4 and removes vstep-5 as a separate card."""

with open('client/public/broker_tool.html', 'r') as f:
    html = f.read()

# The end of vstep-4 closing div + vstep-5 opening
OLD = '''  </div>
  <div class="card" id="vstep-5" data-vstep="5" data-step-label="Commission & Invoice" data-card-eyebrow="Step 5 of 7">
    <h2>Step 5 — Commission &amp; Invoice</h2>
    <div id="v-req-comm-lease">'''

# Replace: close vstep-4 is removed, vstep-5 opening is removed, content continues inside vstep-4
NEW = '''    <div class="section-divider top-gap-md">
      <h3>Commission &amp; Invoice</h3>
    </div>
    <div id="v-req-comm-lease">'''

if OLD in html:
    html = html.replace(OLD, NEW, 1)
    print('✓ Merged vstep-5 opening into vstep-4')
else:
    print('✗ Could not find boundary — checking exact chars...')
    idx = html.find('vstep-5" data-vstep="5"')
    if idx >= 0:
        print(f'  Found vstep-5 at char {idx}')
        print(repr(html[idx-50:idx+100]))

# Now find the closing </div> of the old vstep-5 card and remove it
# The vstep-5 card ends with:
#   </div>
# </div>
# <div class="card" id="vstep-8"
# We need to remove the extra </div> that was the vstep-5 card wrapper

OLD_END = '''    </div>
  </div>
  <div class="card" id="vstep-8"'''

NEW_END = '''    </div>
  </div>
  <div class="card" id="vstep-8"'''

# The structure after merge is:
# [vstep-4 content]
# [vstep-5 content merged in — ends with </div> for section-divider]
# </div>   <- this was vstep-5's closing </div>, now it's an extra one
# </div>   <- this should be vstep-4's closing </div>
# <div class="card" id="vstep-8"

# Count the </div> tags — after the merge, the vstep-5 card's outer </div> is now
# an extra closing tag inside vstep-4. We need to remove it.
# The AI Deal Analysis section-divider ends with </div></div></div>
# Then there's the section-divider voucher-subsection closing </div>
# Then the old vstep-5 card closing </div>
# Then vstep-4's own closing </div>

# Let's find the exact pattern: the AI panel div + closing divs
OLD_EXTRA = '''        <div id="v-ai-calc-panel" class="is-hidden" style="margin-top:14px;"></div>
      </div>
    </div>
  </div>
  <div class="card" id="vstep-8"'''

NEW_EXTRA = '''        <div id="v-ai-calc-panel" class="is-hidden" style="margin-top:14px;"></div>
      </div>
    </div>
  </div>
  <div class="card" id="vstep-8"'''

# This is the same — the extra </div> from vstep-5 needs to be removed
# Let's count: after the merge, the structure is:
# vstep-4 opening <div>
#   ...content...
#   [merged vstep-5 content]
#     ...
#     <div class="section-divider">  (AI Deal Analysis)
#       ...
#     </div>  <- closes AI Deal Analysis section-divider
#   </div>  <- closes section-divider voucher-subsection
#   <- HERE was the old vstep-5 closing </div> — now extra
# </div>  <- should be vstep-4 closing
# <div vstep-8>

# So we have ONE extra </div> between the last </div> of vstep-5 content and vstep-4's closing
OLD_EXTRA2 = '''      </div>
    </div>
  </div>
  </div>
  <div class="card" id="vstep-8"'''

NEW_EXTRA2 = '''      </div>
    </div>
  </div>
  <div class="card" id="vstep-8"'''

if OLD_EXTRA2 in html:
    html = html.replace(OLD_EXTRA2, NEW_EXTRA2, 1)
    print('✓ Removed extra closing </div> from old vstep-5 wrapper')
else:
    print('✗ Could not find extra </div> pattern — checking...')
    # Find the area around vstep-8
    idx = html.find('id="vstep-8"')
    if idx >= 0:
        print(repr(html[idx-200:idx+50]))

with open('client/public/broker_tool.html', 'w') as f:
    f.write(html)

print('Done.')
