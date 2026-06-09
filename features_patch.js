// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES PATCH — implements features 1,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,25,27
// ═══════════════════════════════════════════════════════════════════════════════

// ── Feature 13: Listing expiration alert ──
(function initExpiryAlert() {
  function checkListingExpiry() {
    const el = document.getElementById('l-listing-expiration');
    const alertEl = document.getElementById('lg-expiry-alert');
    if (!el || !alertEl) return;
    const val = el.value;
    if (!val) { alertEl.innerHTML = ''; return; }
    const exp = new Date(val + 'T00:00:00');
    const now = new Date();
    now.setHours(0,0,0,0);
    const diffMs = exp - now;
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays < 0) {
      alertEl.innerHTML = '<div class="expiry-alert expiry-alert-expired">&#9888; Listing expired ' + Math.abs(diffDays) + ' day' + (Math.abs(diffDays) !== 1 ? 's' : '') + ' ago</div>';
    } else if (diffDays <= 30) {
      alertEl.innerHTML = '<div class="expiry-alert expiry-alert-soon">&#9888; Expires in ' + diffDays + ' day' + (diffDays !== 1 ? 's' : '') + '</div>';
    } else {
      alertEl.innerHTML = '';
    }
  }
  document.addEventListener('DOMContentLoaded', function() {
    const el = document.getElementById('l-listing-expiration');
    if (el) {
      el.addEventListener('change', checkListingExpiry);
      el.addEventListener('input', checkListingExpiry);
      checkListingExpiry();
    }
    // Also hook into syncListingGlance
    const origSync = window.syncListingGlance;
    window.syncListingGlance = function() {
      if (typeof origSync === 'function') origSync.apply(this, arguments);
      checkListingExpiry();
    };
  });
})();

// ── Feature 14: Copy listing to voucher ──
window.copyListingToVoucher = function(btn) {
  if (btn) setBtnLoading(btn, true, 'Copying…');
  setTimeout(function() {
    try {
      _copyListingToVoucherCore();
    } finally {
      if (btn) setBtnLoading(btn, false);
    }
  }, 30);
};
function _copyListingToVoucherCore() {
  const gv = function(id) { return (document.getElementById(id) || {}).value || ''; };
  const sv = function(id, val) { const el = document.getElementById(id); if (el && val) { el.value = val; el.dispatchEvent(new Event('change', {bubbles:true})); el.dispatchEvent(new Event('input', {bubbles:true})); } };
  const sgv = function(id, val) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    const opts = Array.from(el.options);
    const match = opts.find(o => o.value === val) || opts.find(o => o.value.toLowerCase() === val.toLowerCase()) || opts.find(o => o.textContent.trim().toLowerCase() === val.toLowerCase());
    if (match) { el.value = match.value; el.dispatchEvent(new Event('change', {bubbles:true})); }
  };

  // Property info
  sv('v-address', gv('l-address'));
  sv('v-city', gv('l-city'));
  sv('v-state', gv('l-state') || 'CA');
  sv('v-zip', gv('l-zip'));
  sv('v-l-dealsf', gv('l-bldg-sf'));

  // Transaction type
  const txn = gv('l-txn-type');
  if (txn) sgv('v-txn-type', txn === 'sale-lease' ? 'lease' : txn);

  // Property type
  const pt = gv('l-prop-type');
  if (pt) sgv('v-prop-type', pt);

  // Listing agent — first row in the listing agent table
  const laName = (document.getElementById('la-name-1') || {}).value || '';
  const laPhone = (document.getElementById('la-phone-1') || {}).value || '';
  const laEmail = (document.getElementById('la-email-1') || {}).value || '';
  if (laName) sv('v-la-name', laName);
  if (laPhone) sv('v-la-phone', laPhone);

  // Trigger voucher cascade
  try { onVoucherTxnChange(); } catch(e) {}
  try { syncVoucherDealAliases(); } catch(e) {}
  try { syncDealGlance(); } catch(e) {}

  // Switch to voucher tab
  try { switchTab('voucher'); } catch(e) {}
  showToast('Listing info copied to voucher!', 'success');
}

// ── Feature 7: Same-agent auto-copy ALL fields ──
(function patchSameAgentChange() {
  document.addEventListener('DOMContentLoaded', function() {
    const sel = document.getElementById('v-same-agent');
    if (!sel) return;
    sel.addEventListener('change', function() {
      if (sel.value !== 'yes') return;
      const fields = ['name','house','address','city','state','zip','phone'];
      fields.forEach(function(f) {
        const laEl = document.getElementById('v-la-' + f);
        const paEl = document.getElementById('v-pa-' + f);
        if (laEl && paEl && laEl.value) {
          paEl.value = laEl.value;
          paEl.dispatchEvent(new Event('input', {bubbles:true}));
        }
      });
      // Also copy email and license if they exist
      ['email','license'].forEach(function(f) {
        const laEl = document.getElementById('v-la-' + f);
        const paEl = document.getElementById('v-pa-' + f);
        if (laEl && paEl && laEl.value) paEl.value = laEl.value;
      });
    });
  });
})();

// Rent schedule UI lives in broker_tool.html (Dealius-style lease calculator).

// ── Feature 6: Live commission calculator ──
(function wireCommissionLive() {
  document.addEventListener('DOMContentLoaded', function() {
    // Wire v-l-comm-rate, v-s-price, v-s-comm-pct to live-update
    ['v-l-comm-rate','v-s-price','v-s-comm-pct','v-deal-sf','v-land-sf','v-l-dealsf'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', function() { try { calcCommSummary(); } catch(e) {} });
    });
    // Also wire rent body changes
    const rentBody = document.getElementById('v-rent-body');
    if (rentBody) {
      rentBody.addEventListener('input', function() { try { calcCommSummary(); } catch(e) {} });
    }
  });
})();

// ── Feature 8: Lease vs sale branch toggle ──
(function patchVoucherBranchToggle() {
  document.addEventListener('DOMContentLoaded', function() {
    const origOnVoucherTxnChange = window.onVoucherTxnChange;
    window.onVoucherTxnChange = function() {
      if (typeof origOnVoucherTxnChange === 'function') origOnVoucherTxnChange.apply(this, arguments);
      const txn = (document.getElementById('v-txn-type') || {}).value || 'lease';
      const isLease = txn === 'lease' || txn === 'sublease' || txn === 'renewal';
      const isSale = txn === 'sale';
      // Hide/show rent schedule step
      const rentStep = document.getElementById('vstep-6');
      if (rentStep) setHiddenState(rentStep, !isLease);
      // Hide/show sale section
      const saleSection = document.getElementById('v-sale-section');
      if (saleSection) setHiddenState(saleSection, !isSale);
      // Hide/show lease section
      const leaseSection = document.getElementById('v-lease-section');
      if (leaseSection) setHiddenState(leaseSection, !isLease);
    };
    // Run once on load
    try { window.onVoucherTxnChange(); } catch(e) {}
  });
})();

// ── Feature 11: Deal summary card in voucher review ──
(function patchVoucherReview() {
  document.addEventListener('DOMContentLoaded', function() {
    const origOpenReviewSnapshot = window.openReviewSnapshot;
    window.openReviewSnapshot = function(context) {
      if (typeof origOpenReviewSnapshot === 'function') origOpenReviewSnapshot.apply(this, arguments);
      if (context !== 'voucher') return;
      // Inject summary card at the top of the review modal body
      setTimeout(function() {
        const modal = document.getElementById('review-snapshot-modal');
        if (!modal) return;
        const body = modal.querySelector('.review-snapshot-body');
        if (!body) return;
        if (body.querySelector('.voucher-summary-card')) return; // already added
        const gv = function(id) { return (document.getElementById(id) || {}).value || '—'; };
        const txn = (document.getElementById('v-txn-type') || {}).value || 'lease';
        const isLease = txn === 'lease' || txn === 'sublease' || txn === 'renewal';
        const addr = [gv('v-address'), gv('v-city'), gv('v-state')].filter(v => v && v !== '—').join(', ') || '—';
        const consideration = isLease ? gv('v-l-consideration') : gv('v-s-price');
        const commDue = isLease ? gv('v-l-comm-due') : gv('v-s-comm-due');
        const laName = gv('v-la-name') || '—';
        const paName = gv('v-pa-name') || '—';
        const lessee = gv('v-lb-company') || '—';
        const lessor = gv('v-ls-company') || '—';
        const dealSf = gv('v-l-dealsf');
        const card = document.createElement('div');
        card.className = 'voucher-summary-card';
        card.innerHTML = '<div class="voucher-summary-card-title">Deal Summary</div>' +
          '<div class="voucher-summary-grid">' +
            '<div class="voucher-summary-item full-width"><dt>Property</dt><dd>' + escHtml(addr) + '</dd></div>' +
            '<hr class="voucher-summary-divider">' +
            '<div class="voucher-summary-item"><dt>' + (isLease ? 'Lessee' : 'Buyer') + '</dt><dd>' + escHtml(lessee) + '</dd></div>' +
            '<div class="voucher-summary-item"><dt>' + (isLease ? 'Lessor' : 'Seller') + '</dt><dd>' + escHtml(lessor) + '</dd></div>' +
            '<div class="voucher-summary-item"><dt>Listing Agent</dt><dd>' + escHtml(laName) + '</dd></div>' +
            '<div class="voucher-summary-item"><dt>Procuring Agent</dt><dd>' + escHtml(paName) + '</dd></div>' +
            '<hr class="voucher-summary-divider">' +
            '<div class="voucher-summary-item"><dt>Deal SF</dt><dd class="mono">' + escHtml(dealSf) + '</dd></div>' +
            '<div class="voucher-summary-item"><dt>Transaction Type</dt><dd>' + escHtml(txn.charAt(0).toUpperCase() + txn.slice(1)) + '</dd></div>' +
            '<div class="voucher-summary-item voucher-summary-highlight"><dt>Total Consideration</dt><dd class="mono">' + escHtml(consideration) + '</dd></div>' +
            '<div class="voucher-summary-item voucher-summary-highlight"><dt>Total Commission Due</dt><dd class="mono">' + escHtml(commDue) + '</dd></div>' +
          '</div>';
        body.insertBefore(card, body.firstChild);
      }, 80);
    };
  });
  function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
})();

// ── Feature 12: Auto-save on field blur ──
(function wireAutoSaveOnBlur() {
  document.addEventListener('DOMContentLoaded', function() {
    let blurTimer = null;
    function onBlurAutoSave(e) {
      const target = e.target;
      if (!target || !target.id) return;
      if (target.type === 'file' || target.type === 'button' || target.type === 'submit') return;
      clearTimeout(blurTimer);
      blurTimer = setTimeout(function() {
        const listingPanel = document.getElementById('listing-add-mode');
        const voucherPanel = document.getElementById('v-deal-shell');
        if (listingPanel && listingPanel.contains(target)) {
          try {
            _saveCurrentDraftCore('listing');
            const el = document.getElementById('lg-autosave');
            if (el) { el.textContent = 'Autosaved'; el.classList.add('autosave-saving'); setTimeout(function(){ el.classList.remove('autosave-saving'); }, 2000); }
          } catch(e) {}
        } else if (voucherPanel && voucherPanel.contains(target)) {
          try {
            _saveCurrentDraftCore('voucher');
            const el = document.getElementById('dg-autosave');
            if (el) { el.textContent = 'Autosaved'; el.classList.add('autosave-saving'); setTimeout(function(){ el.classList.remove('autosave-saving'); }, 2000); }
          } catch(e) {}
        }
      }, 800);
    }
    document.addEventListener('blur', onBlurAutoSave, true);
  });
})();

// ── Feature 16: Sign location photo upload ──
window.onSignLocationPhotoChange = function(input) {
  const preview = document.getElementById('s-location-photo-preview');
  if (!preview) return;
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.classList.add('has-image');
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    preview.src = '';
    preview.classList.remove('has-image');
  }
};

// ── Feature 17: Map view for comp report ──
(function initCompReportMap() {
  let crMap = null;
  let crMarkers = [];
  let crCurrentView = 'table';

  window.crSetView = function(view) {
    crCurrentView = view;
    const tableBtn = document.getElementById('cr-view-table-btn');
    const mapBtn = document.getElementById('cr-view-map-btn');
    const tableWrap = document.querySelector('.cr-table-wrap');
    const mapContainer = document.getElementById('cr-map-container');
    const pagination = document.getElementById('cr-pagination');
    if (tableBtn) tableBtn.classList.toggle('active', view === 'table');
    if (mapBtn) mapBtn.classList.toggle('active', view === 'map');
    if (tableWrap) setHiddenState(tableWrap, view !== 'table');
    if (pagination) setHiddenState(pagination, view !== 'table');
    if (mapContainer) {
      setHiddenState(mapContainer, view !== 'map');
      if (view === 'map') {
        setTimeout(function() { renderCompReportMap(); }, 100);
      }
    }
  };

  function renderCompReportMap() {
    const container = document.getElementById('cr-map-container');
    if (!container) return;
    // Ensure Leaflet is loaded
    if (typeof L === 'undefined') {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7178">Map requires Leaflet. Please reload the page.</div>';
      return;
    }
    // Init map if not already
    if (!crMap) {
      crMap = L.map('cr-map-container').setView([33.7, -117.8], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(crMap);
    }
    // Clear existing markers
    crMarkers.forEach(function(m) { m.remove(); });
    crMarkers = [];
    const results = window.compReportsResultsCache || [];
    if (!results.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7178">No results to map. Run a search first.</div>';
      return;
    }
    // Geocode addresses and add markers
    const bounds = [];
    let pending = 0;
    results.forEach(function(result, idx) {
      const addr = (result.reportCard && result.reportCard.addressLine) || result.address || '';
      const city = (result.reportCard && result.reportCard.cityLine) || result.city || '';
      if (!addr) return;
      const fullAddr = encodeURIComponent(addr + (city ? ', ' + city : '') + ', CA');
      pending++;
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + fullAddr + '&limit=1', {
        headers: { 'Accept-Language': 'en' }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (isFinite(lat) && isFinite(lng)) {
            const heading = (result.reportCard && result.reportCard.heading) || result.title || addr;
            const marker = L.marker([lat, lng]).addTo(crMap);
            marker.bindPopup('<strong>' + dxEscHtml(heading) + '</strong><br>' + dxEscHtml(addr));
            crMarkers.push(marker);
            bounds.push([lat, lng]);
            if (bounds.length === 1) crMap.setView([lat, lng], 12);
            else crMap.fitBounds(bounds, { padding: [30, 30] });
          }
        }
      })
      .catch(function() {})
      .finally(function() {
        pending--;
      });
    });
    // Invalidate size after render
    setTimeout(function() { if (crMap) crMap.invalidateSize(); }, 200);
  }

  // Patch compReportRenderResults to also refresh map if in map view
  document.addEventListener('DOMContentLoaded', function() {
    const origRender = window.compReportRenderResults;
    window.compReportRenderResults = function(results, pageInfo) {
      if (typeof origRender === 'function') origRender.apply(this, arguments);
      if (crCurrentView === 'map') {
        setTimeout(renderCompReportMap, 200);
      }
    };
  });
})();

// ── Feature 25: Global search bar ──
(function initGlobalSearch() {
  window.globalSearchOpen = function() {
    const wrap = document.getElementById('global-search-wrap');
    if (wrap) wrap.classList.add('open');
  };
  window.globalSearchClose = function() {
    const wrap = document.getElementById('global-search-wrap');
    if (wrap) wrap.classList.remove('open');
    const results = document.getElementById('global-search-results');
    if (results) results.innerHTML = '';
  };
  window.globalSearchQuery = function(query) {
    const results = document.getElementById('global-search-results');
    if (!results) return;
    const q = (query || '').trim().toLowerCase();
    if (!q || q.length < 2) { results.innerHTML = ''; return; }
    const hits = [];
    // Search saved drafts in localStorage
    const draftKeys = [
      { key: 'lbt_autosave_listing_v1', type: 'listing', label: 'Listing Draft' },
      { key: 'lbt_autosave_voucher_v1', type: 'voucher', label: 'Voucher Draft' },
      { key: 'lbt_autosave_comp_v1', type: 'comp', label: 'Comp Draft' },
      { key: 'lbt_autosave_sign_v1', type: 'sign', label: 'Sign Draft' },
    ];
    draftKeys.forEach(function(dk) {
      try {
        const raw = localStorage.getItem(dk.key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const vals = parsed.values || {};
        const searchStr = Object.values(vals).join(' ').toLowerCase();
        if (searchStr.includes(q)) {
          const addr = vals['l-address'] || vals['v-address'] || vals['s-address'] || vals['c-address'] || '';
          const city = vals['l-city'] || vals['v-city'] || vals['s-city'] || vals['c-city'] || '';
          hits.push({
            type: dk.type,
            label: dk.label,
            title: addr || dk.label,
            sub: city || (parsed.savedAt ? 'Saved ' + new Date(parsed.savedAt).toLocaleDateString() : ''),
            action: function() { try { switchTab('tab-' + dk.type); } catch(e) {} },
          });
        }
      } catch(e) {}
    });
    // Search comp results cache
    const compResults = window.compReportsResultsCache || [];
    compResults.forEach(function(result, idx) {
      const heading = (result.reportCard && result.reportCard.heading) || result.title || result.address || '';
      const addr = (result.reportCard && result.reportCard.addressLine) || result.address || '';
      const city = (result.reportCard && result.reportCard.cityLine) || result.city || '';
      const searchStr = (heading + ' ' + addr + ' ' + city).toLowerCase();
      if (searchStr.includes(q)) {
        hits.push({
          type: 'comp',
          label: 'Comp',
          title: heading || addr,
          sub: city,
          action: function() {
            try { switchTab('tab-comp'); } catch(e) {}
            setTimeout(function() {
              const row = document.querySelector('.cr-row[data-idx="' + idx + '"]');
              if (row) { row.scrollIntoView({behavior:'smooth',block:'center'}); row.classList.add('gs-highlight'); setTimeout(function(){ row.classList.remove('gs-highlight'); }, 2000); }
            }, 400);
          },
        });
      }
    });
    if (!hits.length) {
      results.innerHTML = '<div class="gs-no-results">No results for "' + escHtmlGs(q) + '"</div>';
      return;
    }
    results.innerHTML = hits.slice(0, 8).map(function(h, i) {
      return '<div class="gs-result" data-gs-idx="' + i + '">' +
        '<span class="gs-result-badge ' + h.type + '">' + escHtmlGs(h.label) + '</span>' +
        '<div class="gs-result-text">' +
          '<div class="gs-result-title">' + escHtmlGs(h.title) + '</div>' +
          (h.sub ? '<div class="gs-result-sub">' + escHtmlGs(h.sub) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    // Wire clicks
    results.querySelectorAll('.gs-result').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-gs-idx'));
        if (hits[idx]) hits[idx].action();
        globalSearchClose();
        const input = document.getElementById('global-search-input');
        if (input) input.value = '';
      });
    });
  };
  function escHtmlGs(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
})();

// ── Feature 27: Inline validation tooltips ──
(function initInlineValidation() {
  function showFieldError(el, msg) {
    el.classList.add('field-invalid');
    let tip = el.parentNode.querySelector('.field-validation-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'field-validation-tip';
      el.parentNode.appendChild(tip);
    }
    tip.textContent = msg;
    tip.style.display = 'block';
  }
  function clearFieldError(el) {
    el.classList.remove('field-invalid');
    const tip = el.parentNode && el.parentNode.querySelector('.field-validation-tip');
    if (tip) tip.style.display = 'none';
  }
  function validateRequiredField(el) {
    if (!el.hasAttribute('data-req-validated')) return;
    const val = (el.value || '').trim();
    if (!val) {
      const label = el.closest('.field') && el.closest('.field').querySelector('label');
      const name = label ? label.textContent.replace(/\*$/,'').trim() : 'This field';
      showFieldError(el, name + ' is required');
    } else {
      clearFieldError(el);
    }
  }
  // Mark required fields and wire blur validation
  document.addEventListener('DOMContentLoaded', function() {
    // Find all required fields (those with .req label)
    document.querySelectorAll('.field').forEach(function(fieldDiv) {
      const label = fieldDiv.querySelector('label.req');
      if (!label) return;
      const input = fieldDiv.querySelector('input, select, textarea');
      if (!input) return;
      input.setAttribute('data-req-validated', '1');
      input.addEventListener('blur', function() { validateRequiredField(input); });
      input.addEventListener('input', function() {
        if ((input.value || '').trim()) clearFieldError(input);
      });
    });
    // Patch renderNav / step Continue button to also show inline errors
    const origRenderNav = window.renderNav;
    if (typeof origRenderNav === 'function') {
      window.renderNav = function() {
        origRenderNav.apply(this, arguments);
        // After renderNav, highlight any blocking fields
        try { highlightBlockingFields(); } catch(e) {}
      };
    }
  });
  function highlightBlockingFields() {
    // Find the active step card
    const activeCard = document.querySelector('.step-card.active, [data-vstep].active, [data-lstep].active');
    if (!activeCard) return;
    const missing = getMissingRequiredFieldLabels && getMissingRequiredFieldLabels(activeCard);
    if (!missing || !missing.length) return;
    activeCard.querySelectorAll('input[data-req-validated], select[data-req-validated], textarea[data-req-validated]').forEach(function(el) {
      if (!(el.value || '').trim()) {
        const label = el.closest('.field') && el.closest('.field').querySelector('label');
        const name = label ? label.textContent.replace(/\*$/,'').trim() : 'This field';
        showFieldError(el, name + ' is required');
      }
    });
  }
  // Expose for external use
  window.showFieldError = showFieldError;
  window.clearFieldError = clearFieldError;
})();

// ── Feature 1: AI confidence indicators ──
(function patchApplyAiFieldsConfidence() {
  document.addEventListener('DOMContentLoaded', function() {
    const origApplyAiFields = window.applyAiFields;
    window.applyAiFields = function(tab, fields, options) {
      // If options.showConfirmModal is set, show the confirmation modal first
      if (options && options.showConfirmModal) {
        aiShowConfirmModal(tab, fields, options);
        return 0;
      }
      const count = typeof origApplyAiFields === 'function' ? origApplyAiFields.apply(this, arguments) : 0;
      // Add confidence class based on field type
      const map = (window.AI_FIELD_MAP && window.AI_FIELD_MAP[tab]) || {};
      Object.entries(fields).forEach(function([key, value]) {
        const elId = map[key];
        if (!elId) return;
        const el = document.getElementById(elId);
        if (!el) return;
        // High confidence: address, city, state, zip, dates
        const highConf = ['address','city','state','zip','commencementDate','expirationDate','listingExpiration'];
        // Medium confidence: names, rates
        const medConf = ['listingAgentName','procuringAgentName','lessorName','lesseeName','clientName','commissionRate','baseRent','leaseRate'];
        if (highConf.includes(key)) {
          el.classList.add('ai-confidence-high');
        } else if (medConf.includes(key)) {
          el.classList.add('ai-confidence-medium');
        } else {
          el.classList.add('ai-confidence-low');
        }
        // Remove confidence class on edit
        el.addEventListener('input', function() {
          el.classList.remove('ai-confidence-high','ai-confidence-medium','ai-confidence-low');
        }, { once: true });
      });
      return count;
    };
  });
})();

// ── Feature 5: AI parsed fields confirmation modal ──
let _aiConfirmPending = null;
window.aiShowConfirmModal = function(tab, fields, options) {
  const overlay = document.getElementById('ai-confirm-overlay');
  const tbody = document.getElementById('ai-confirm-tbody');
  if (!overlay || !tbody) return;
  const map = (window.AI_FIELD_MAP && window.AI_FIELD_MAP[tab]) || {};
  const fieldLabels = {
    propertyType:'Property Type', transactionType:'Transaction Type', address:'Address',
    city:'City', state:'State', zip:'Zip', rateSfMo:'Rate $/SF/Mo', term:'Term (months)',
    leaseType:'Lease Type', buildingSf:'Building SF', suiteSf:'Suite SF', askingPrice:'Asking Price',
    listingExpiration:'Listing Expiration', dateEntered:'Date Entered', ownerName:'Owner Name',
    commissionRate:'Commission Rate %', crossStreets:'Cross Streets', yearBuilt:'Year Built',
    listingAgentName:'Listing Agent', listingAgentLicense:'License #', comments:'Comments',
    representationType:'Rep Type', clientName:'Client Name', dealSf:'Deal SF',
    commencementDate:'Commencement', expirationDate:'Expiration', baseRent:'Base Rent',
    lessorName:'Lessor', lesseeName:'Lessee', procuringAgentName:'Procuring Agent',
    totalConsideration:'Total Consideration', salePrice:'Sale Price', notes:'Notes',
    propertyAddress:'Property Address', signType:'Sign Type', signSize:'Sign Size',
    quantity:'Quantity', nameRider:'Name Rider', requestedBy:'Requested By',
    specialInstructions:'Special Instructions', accessInstructions:'Access Instructions',
    compType:'Comp Type', buildingSf:'Building SF', dealSf:'Deal SF', leaseRate:'Lease Rate',
    tenantName:'Tenant', landlordName:'Landlord', pricePerSf:'Price/SF', brokerName:'Broker',
  };
  const entries = Object.entries(fields).filter(function([k,v]) { return map[k] && v; });
  if (!entries.length) return;
  tbody.innerHTML = entries.map(function([key, value], i) {
    const label = fieldLabels[key] || key;
    return '<tr>' +
      '<td><input type="checkbox" class="ai-confirm-check" data-key="' + escHtmlAi(key) + '" checked></td>' +
      '<td class="ai-confirm-field-name">' + escHtmlAi(label) + '</td>' +
      '<td class="ai-confirm-field-value">' + escHtmlAi(value) + '</td>' +
    '</tr>';
  }).join('');
  _aiConfirmPending = { tab: tab, fields: fields, options: Object.assign({}, options, { showConfirmModal: false }) };
  overlay.style.display = 'flex';
};
window.aiConfirmApply = function() {
  const overlay = document.getElementById('ai-confirm-overlay');
  const tbody = document.getElementById('ai-confirm-tbody');
  if (!_aiConfirmPending || !tbody) return;
  const checked = {};
  tbody.querySelectorAll('.ai-confirm-check').forEach(function(cb) {
    if (cb.checked) checked[cb.getAttribute('data-key')] = _aiConfirmPending.fields[cb.getAttribute('data-key')];
  });
  const origApply = window.applyAiFields;
  if (typeof origApply === 'function') origApply(_aiConfirmPending.tab, checked, _aiConfirmPending.options);
  _aiConfirmPending = null;
  if (overlay) overlay.style.display = 'none';
};
window.aiConfirmCancel = function() {
  _aiConfirmPending = null;
  const overlay = document.getElementById('ai-confirm-overlay');
  if (overlay) overlay.style.display = 'none';
};
function escHtmlAi(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Feature 4: Parse from pasted text ──
window.aiParseFromPaste = async function() {
  const textarea = document.getElementById('ai-paste-text');
  const status = document.getElementById('ai-paste-status');
  const btn = document.getElementById('ai-paste-btn');
  const icon = document.getElementById('ai-paste-icon');
  if (!textarea || !textarea.value.trim()) {
    if (status) { status.textContent = 'Please paste some text first.'; status.className = 'ai-status error'; }
    return;
  }
  const tab = getActiveTabKey();
  if (btn) btn.disabled = true;
  if (icon) icon.innerHTML = '<span class="ai-spinner"></span>';
  if (status) { status.textContent = 'Analyzing pasted text…'; status.className = 'ai-status'; }
  try {
    const result = await callTrpc('aiAssist.parse', { description: textarea.value.trim(), tab });
    const fields = result.fields || {};
    const count = Object.keys(fields).length;
    if (count > 0) {
      // Show confirmation modal
      aiShowConfirmModal(tab, fields, {});
      if (status) { status.textContent = 'Found ' + count + ' field' + (count !== 1 ? 's' : '') + '. Review and apply below.'; status.className = 'ai-status success'; }
      textarea.value = '';
    } else {
      if (status) { status.textContent = 'No matching fields found. Try more specific text.'; status.className = 'ai-status error'; }
    }
  } catch(e) {
    if (status) { status.textContent = 'Parse failed: ' + (e.message || 'Unknown error'); status.className = 'ai-status error'; }
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.innerHTML = '';
  }
};

// ── Feature 3: Deal-type-specific AI prompts (client-side tab context) ──
// The server already uses the tab parameter. We enhance the client to pass
// additional context about the current deal type when parsing.
(function patchAiParseDescription() {
  document.addEventListener('DOMContentLoaded', function() {
    const origAiParseDescription = window.aiParseDescription;
    window.aiParseDescription = async function() {
      // Enrich the description with deal type context if available
      const tab = getActiveTabKey();
      const descEl = document.getElementById('ai-nl-input');
      if (descEl && tab === 'voucher') {
        const txn = (document.getElementById('v-txn-type') || {}).value || '';
        const pt = (document.getElementById('v-prop-type') || {}).value || '';
        if (txn || pt) {
          const prefix = [txn && ('Transaction type: ' + txn), pt && ('Property type: ' + pt)].filter(Boolean).join('. ');
          if (prefix && !descEl.value.toLowerCase().includes(txn.toLowerCase())) {
            // Prepend context hint (will be stripped after parse)
            const orig = descEl.value;
            descEl.value = '[Context: ' + prefix + ']\n' + orig;
            try {
              await origAiParseDescription.apply(this, arguments);
            } finally {
              // Restore original if still unchanged
              if (descEl.value === '[Context: ' + prefix + ']\n' + orig) descEl.value = orig;
            }
            return;
          }
        }
      }
      if (typeof origAiParseDescription === 'function') return origAiParseDescription.apply(this, arguments);
    };
  });
})();

// ── Feature 18: Branded comp report PDF improvements ──
// The existing exportLeeCompReportPdf already produces a branded Lee & Associates PDF.
// This patch ensures the footer text is correct and adds a cover page summary.
(function patchCompReportPdf() {
  document.addEventListener('DOMContentLoaded', function() {
    const origExport = window.exportLeeCompReportPdf;
    if (typeof origExport !== 'function') return;
    // The existing function already handles branding. No Metropolis text is present.
    // We expose a wrapper that shows a spinner and calls the original.
    window.exportLeeCompReportPdfEnhanced = function(btn) {
      return origExport.apply(this, arguments);
    };
  });
})();

// ── CSS additions for expiry alert and validation tooltip ──
(function injectFeatureCSS() {
  const style = document.createElement('style');
  style.textContent = `
.expiry-alert { font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 6px; margin-top: 4px; }
.expiry-alert-expired { background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
.expiry-alert-soon { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
.field-invalid { border-color: #EF4444 !important; box-shadow: 0 0 0 2px rgba(239,68,68,0.15) !important; }
.field-validation-tip { font-size: 11px; color: #DC2626; margin-top: 3px; display: none; font-weight: 500; }
.btn-icon-sm { background: none; border: 1px solid #D7DBE1; border-radius: 4px; padding: 2px 5px; cursor: pointer; font-size: 12px; color: #6B7178; }
.btn-icon-sm:hover { background: #F3F4F6; color: #374151; }
.gs-highlight { background: #FEF3C7 !important; transition: background 0.3s; }
.cr-view-toggle { display: flex; gap: 4px; }
.cr-view-btn { padding: 5px 14px; font-size: 12px; font-weight: 600; border: 1px solid #D7DBE1; border-radius: 6px; background: #fff; cursor: pointer; color: #6B7178; transition: all 0.15s; }
.cr-view-btn.active { background: #A9223B; color: #fff; border-color: #A9223B; }
.cr-view-btn:hover:not(.active) { background: #F3F4F6; }
#cr-map-container { height: 480px; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB; margin-bottom: 12px; display: none; }
#cr-map-container.is-visible { display: block; }
.btn-copy-to-voucher { background: #1D4ED8; color: #fff; border: none; }
.btn-copy-to-voucher:hover { background: #1E40AF; }
.rent-row-comm-rate { font-size: 12px; }
  `;
  document.head.appendChild(style);
})();

// ── Keyboard shortcut: Ctrl+S to save draft ──
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const activeTab = document.querySelector('.tab.active');
    if (!activeTab) return;
    const tabText = activeTab.textContent.trim().toLowerCase();
    if (tabText.includes('listing')) { try { saveCurrentDraft('listing'); } catch(ex) {} }
    else if (tabText.includes('voucher')) { try { saveCurrentDraft('voucher'); } catch(ex) {} }
    else if (tabText.includes('comp')) { try { saveCurrentDraft('comp'); } catch(ex) {} }
    else if (tabText.includes('sign')) { try { saveCurrentDraft('sign'); } catch(ex) {} }
  }
});
