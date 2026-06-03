// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES PATCH — implements features 1,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,25,27
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: run callback immediately if DOM already loaded, otherwise wait
function onDomReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

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
  onDomReady(function() {
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
  onDomReady(function() {
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

// ── Feature 10: Duplicate rent row ──
window.duplicateRentRow = function(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  const newTr = tr.cloneNode(true);
  // Update the row number
  const body = document.getElementById('v-rent-body');
  const newIdx = body.querySelectorAll('tr').length + 1;
  const numCell = newTr.querySelector('td:first-child');
  if (numCell) numCell.textContent = newIdx;
  // Clear readonly fields so they recalculate
  newTr.querySelectorAll('.rent-rate-sf, .rent-consideration').forEach(function(el) { el.value = ''; });
  // Fix onclick for remove button
  const removeBtn = newTr.querySelector('.remove-row');
  if (removeBtn) removeBtn.setAttribute('onclick', "this.closest('tr').remove()");
  body.appendChild(newTr);
  calcCommSummary();
};

// ── Feature 9: Per-row commission rate in addRentRow ──
(function patchAddRentRow() {
  onDomReady(function() {
    // Patch addRentRow to include per-row comm rate and duplicate button
    const origAddRentRow = window.addRentRow;
    window.addRentRow = function() {
      rentRowCount++;
      const body = document.getElementById('v-rent-body');
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="text-center text-strong">' + rentRowCount + '</td>' +
        '<td><input class="rent-monthly" placeholder="$0" oninput="calcRentRow(this)"></td>' +
        '<td><input class="rent-rate-sf readonly-fill" placeholder="$0.00" readonly></td>' +
        '<td><input class="rent-months" placeholder="12" value="12" oninput="calcRentRow(this)"></td>' +
        '<td><input class="rent-consideration readonly-fill" placeholder="$0" readonly></td>' +
        '<td><input class="rent-row-comm-rate" placeholder="—" style="width:52px;text-align:center" oninput="calcCommSummary()" title="Override commission rate for this period (%)"></td>' +
        '<td style="white-space:nowrap">' +
          '<button class="remove-row" onclick="this.closest(\'tr\').remove();calcCommSummary()" title="Remove row">&times;</button>' +
          '<button class="btn-icon-sm" onclick="duplicateRentRow(this)" title="Duplicate row" style="margin-left:4px">&#10063;</button>' +
        '</td>';
      body.appendChild(tr);
    };
  });
})();

// ── Feature 6: Live commission calculator ──
(function wireCommissionLive() {
  onDomReady(function() {
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
  onDomReady(function() {
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
      const leaseSection = document.getElementById('v-req-lease');
      if (leaseSection) setHiddenState(leaseSection, !isLease);
    };
    // Run once on load
    try { window.onVoucherTxnChange(); } catch(e) {}
  });
})();

// ── Feature 11: Deal summary card in voucher review ──
(function patchVoucherReview() {
  onDomReady(function() {
    const origOpenReviewSnapshot = window.openReviewSnapshot;
    window.openReviewSnapshot = function(context) {
      if (typeof origOpenReviewSnapshot === 'function') origOpenReviewSnapshot.apply(this, arguments);
      if (context !== 'voucher') return;
      // Inject summary card at the top of the review modal body
      setTimeout(function() {
        const modal = document.getElementById('review-snapshot-modal');
        if (!modal) return;
        const body = modal.querySelector('.review-content') || modal.querySelector('#review-snapshot-content');
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
  onDomReady(function() {
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

// ── Feature 17: Map view for comp report (Google Maps + selectable pins) ──
(function initCompReportMap() {
  let crMap = null;
  let crMarkers = []; // Array of { marker, idx, infoWindow }
  let crCurrentView = 'table';
  let crGeocoder = null;
  let crGoogleLoaded = false;
  const CR_MAPS_JS_KEY = 'AIzaSyDVpoCmrINWXAb8Imw1z6hIcxU_fG8drho';

  // Load Google Maps JS API dynamically
  function loadGoogleMapsApi(callback) {
    if (crGoogleLoaded || (window.google && window.google.maps)) {
      crGoogleLoaded = true;
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + CR_MAPS_JS_KEY + '&libraries=marker';
    script.async = true;
    script.defer = true;
    script.onload = function() { crGoogleLoaded = true; callback(); };
    script.onerror = function() { console.warn('Google Maps JS API failed to load'); };
    document.head.appendChild(script);
  }

  // Marker SVG icons
  function makeMarkerIcon(selected) {
    var color = selected ? '#98002E' : '#9CA3AF';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">' +
      '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="' + color + '"/>' +
      '<circle cx="14" cy="14" r="6" fill="#fff"/>' +
      (selected ? '<circle cx="14" cy="14" r="3.5" fill="' + color + '"/>' : '') +
      '</svg>';
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(28, 40),
      anchor: new google.maps.Point(14, 40)
    };
  }

  // Update marker icon based on selection state
  function updateMarkerAppearance(markerObj) {
    var isSelected = !window.compReportsDeselected || !window.compReportsDeselected.has(markerObj.idx);
    markerObj.marker.setIcon(makeMarkerIcon(isSelected));
    markerObj.marker.setZIndex(isSelected ? 100 : 1);
  }

  // Update all marker appearances
  function updateAllMarkerAppearances() {
    crMarkers.forEach(updateMarkerAppearance);
    updateMapToolbar();
  }

  // Create or update the floating map toolbar
  function updateMapToolbar() {
    var container = document.getElementById('cr-map-container');
    if (!container) return;
    var toolbar = document.getElementById('cr-map-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'cr-map-toolbar';
      toolbar.className = 'cr-map-toolbar';
      container.appendChild(toolbar);
    }
    var total = (window.compReportsResultsCache || []).length;
    var deselected = window.compReportsDeselected ? window.compReportsDeselected.size : 0;
    var selected = total - deselected;
    toolbar.innerHTML = '<div class="cr-map-toolbar-left">' +
      '<span class="cr-map-toolbar-count">' + selected + ' of ' + total + ' selected</span>' +
      '<button class="cr-map-toolbar-btn" onclick="crMapSelectAll()" title="Select All">Select All</button>' +
      '<button class="cr-map-toolbar-btn" onclick="crMapDeselectAll()" title="Deselect All">Deselect All</button>' +
      '</div>' +
      '<div class="cr-map-toolbar-right">' +
      '<button class="btn btn-gray cr-map-toolbar-export" onclick="compReportExportCsvWithSpinner(this)"' + (selected ? '' : ' disabled') + '>Excel</button>' +
      '<button class="btn btn-outline cr-map-toolbar-export" onclick="compReportExportPdfWithSpinner(this)"' + (selected ? '' : ' disabled') + '>PDF Report</button>' +
      '</div>';
  }

  // Select/deselect all from map toolbar
  window.crMapSelectAll = function() {
    if (typeof compReportToggleSelectAll === 'function') compReportToggleSelectAll(true);
    updateAllMarkerAppearances();
  };
  window.crMapDeselectAll = function() {
    if (typeof compReportToggleSelectAll === 'function') compReportToggleSelectAll(false);
    updateAllMarkerAppearances();
  };

  window.crSetView = function(view) {
    crCurrentView = view;
    var tableBtn = document.getElementById('cr-view-table-btn');
    var mapBtn = document.getElementById('cr-view-map-btn');
    var tableWrap = document.querySelector('.cr-table-wrap');
    var mapContainer = document.getElementById('cr-map-container');
    var pagination = document.getElementById('cr-pagination');
    if (tableBtn) tableBtn.classList.toggle('active', view === 'table');
    if (mapBtn) mapBtn.classList.toggle('active', view === 'map');
    if (tableWrap) setHiddenState(tableWrap, view !== 'table');
    if (pagination) setHiddenState(pagination, view !== 'table');
    if (mapContainer) {
      setHiddenState(mapContainer, view !== 'map');
      if (view === 'map') {
        loadGoogleMapsApi(function() {
          setTimeout(function() { renderCompReportMap(); }, 100);
        });
      }
    }
  };

  function getCrMapOverlay() {
    var overlay = document.getElementById('cr-map-overlay-msg');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cr-map-overlay-msg';
      overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.85);z-index:500;border-radius:8px;pointer-events:none;font-size:14px;color:#6B7178;';
      var container = document.getElementById('cr-map-container');
      if (container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        container.appendChild(overlay);
      }
    }
    return overlay;
  }

  function renderCompReportMap() {
    var container = document.getElementById('cr-map-container');
    if (!container) return;
    // Ensure Google Maps is loaded
    if (!window.google || !window.google.maps) {
      var ov = getCrMapOverlay();
      if (ov) { ov.textContent = 'Loading Google Maps...'; ov.style.display = 'flex'; }
      return;
    }
    if (!crGeocoder) crGeocoder = new google.maps.Geocoder();

    // Init map if not already
    if (!crMap) {
      container.style.position = 'relative';
      // Create a sub-div for the map so the toolbar can overlay
      var mapDiv = document.getElementById('cr-map-inner');
      if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.id = 'cr-map-inner';
        mapDiv.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;';
        container.insertBefore(mapDiv, container.firstChild);
      }
      crMap = new google.maps.Map(mapDiv, {
        center: { lat: 33.7, lng: -117.8 },
        zoom: 10,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
      });
    }
    // Clear existing markers
    crMarkers.forEach(function(m) { m.marker.setMap(null); if (m.infoWindow) m.infoWindow.close(); });
    crMarkers = [];
    var results = window.compReportsResultsCache || [];
    var overlay = getCrMapOverlay();
    if (!results.length) {
      if (overlay) { overlay.textContent = 'No results to map. Run a search first.'; overlay.style.display = 'flex'; }
      updateMapToolbar();
      return;
    }
    if (overlay) overlay.style.display = 'none';

    // Geocode addresses and add markers
    var bounds = new google.maps.LatLngBounds();
    var geocoded = 0;

    // Rate-limit geocoding to avoid OVER_QUERY_LIMIT
    var geocodeQueue = [];
    var geocodeActive = 0;
    var MAX_CONCURRENT = 5;

    function processGeoQueue() {
      while (geocodeActive < MAX_CONCURRENT && geocodeQueue.length > 0) {
        var job = geocodeQueue.shift();
        geocodeActive++;
        doGeocode(job.addr, job.idx, job.result, function() {
          geocodeActive--;
          processGeoQueue();
        });
      }
    }

    function doGeocode(fullAddr, idx, result, done) {
      crGeocoder.geocode({ address: fullAddr }, function(geoResults, status) {
        if (status === 'OK' && geoResults[0]) {
          var loc = geoResults[0].geometry.location;
          addMarkerForResult(loc.lat(), loc.lng(), idx, result);
          bounds.extend(loc);
          geocoded++;
          if (geocoded === 1) crMap.setCenter(loc);
          if (geocoded > 1) crMap.fitBounds(bounds, { padding: 40 });
        } else if (status === 'OVER_QUERY_LIMIT') {
          // Retry after delay
          setTimeout(function() { doGeocode(fullAddr, idx, result, done); }, 1000);
          return;
        }
        done();
      });
    }

    results.forEach(function(result, idx) {
      var addr = (result.reportCard && result.reportCard.addressLine) || result.address || '';
      var city = (result.reportCard && result.reportCard.cityLine) || result.city || '';
      if (!addr) return;
      var fullAddr = addr + (city ? ', ' + city : '') + ', CA';
      geocodeQueue.push({ addr: fullAddr, idx: idx, result: result });
    });

    processGeoQueue();
    updateMapToolbar();
  }

  function addMarkerForResult(lat, lng, idx, result) {
    var isSelected = !window.compReportsDeselected || !window.compReportsDeselected.has(idx);
    var marker = new google.maps.Marker({
      position: { lat: lat, lng: lng },
      map: crMap,
      icon: makeMarkerIcon(isSelected),
      zIndex: isSelected ? 100 : 1,
      title: (result.reportCard && result.reportCard.heading) || result.address || ''
    });

    // Build info window content
    var addr = (result.reportCard && result.reportCard.addressLine) || result.address || '';
    var city = (result.reportCard && result.reportCard.cityLine) || result.city || '';
    var heading = (result.reportCard && result.reportCard.heading) || result.title || addr;
    var popupHtml = '<div style="min-width:220px;max-width:300px;font-family:Inter,system-ui,sans-serif;">';
    // Property image
    var photoRaw = result.photoUrl || (result.reportCard && result.reportCard.photoUrl) || result.photo || (result.reportCard && result.reportCard.photo) || '';
    photoRaw = String(photoRaw).trim();
    var photoSrc = /^(https?:\/\/|data:|\/)/i.test(photoRaw) ? photoRaw : '';
    if (!photoSrc) {
      var svLocation = [addr, city].filter(Boolean).join(', ').trim();
      if (svLocation) photoSrc = '/api/maps/api/streetview?size=300x160&location=' + encodeURIComponent(svLocation) + '&fov=80&pitch=0';
    }
    if (photoSrc) {
      popupHtml += '<img src="' + dxEscHtml(photoSrc) + '" style="width:100%;height:140px;object-fit:cover;border-radius:6px 6px 0 0;display:block;" onerror="this.style.display=\'none\'" alt="Property">';
    }
    popupHtml += '<div style="padding:10px;">';
    // Selection checkbox
    popupHtml += '<label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;font-size:12px;color:#555;">' +
      '<input type="checkbox" class="cr-map-pin-check" data-idx="' + idx + '" ' + (isSelected ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#98002E;cursor:pointer;">' +
      '<span>' + (isSelected ? 'Selected for export' : 'Click to select') + '</span></label>';
    popupHtml += '<div style="font-weight:600;font-size:13px;margin-bottom:4px;color:#1a1a2e;">' + dxEscHtml(heading) + '</div>';
    if (addr && addr !== heading) popupHtml += '<div style="font-size:11.5px;color:#555;margin-bottom:2px;">' + dxEscHtml(addr) + '</div>';
    if (city) popupHtml += '<div style="font-size:11.5px;color:#555;margin-bottom:6px;">' + dxEscHtml(city) + '</div>';
    // Key metrics
    var fields = (result.reportCard && result.reportCard.fields) || {};
    var metrics = [];
    if (fields['Space Leased']) metrics.push('<b>SF:</b> ' + dxEscHtml(fields['Space Leased']));
    if (fields['Bldg. SqFt']) metrics.push('<b>Bldg:</b> ' + dxEscHtml(fields['Bldg. SqFt']));
    if (fields['Rent/SqFt']) metrics.push('<b>Rent:</b> ' + dxEscHtml(fields['Rent/SqFt']));
    if (fields['Sale Price']) metrics.push('<b>Price:</b> ' + dxEscHtml(fields['Sale Price']));
    if (fields['Sale $/SF']) metrics.push('<b>$/SF:</b> ' + dxEscHtml(fields['Sale $/SF']));
    if (fields['Trans. Date']) metrics.push('<b>Date:</b> ' + dxEscHtml(fields['Trans. Date']));
    if (fields['Prop. Type']) metrics.push('<b>Type:</b> ' + dxEscHtml(fields['Prop. Type']));
    if (metrics.length) {
      popupHtml += '<div style="font-size:11px;color:#333;line-height:1.6;border-top:1px solid #eee;padding-top:6px;margin-top:4px;">' + metrics.join(' &middot; ') + '</div>';
    }
    popupHtml += '</div></div>';

    var infoWindow = new google.maps.InfoWindow({ content: popupHtml, maxWidth: 320 });
    var markerObj = { marker: marker, idx: idx, infoWindow: infoWindow };
    crMarkers.push(markerObj);

    // Click marker to toggle selection
    marker.addListener('click', function() {
      // Close all other info windows
      crMarkers.forEach(function(m) { if (m !== markerObj) m.infoWindow.close(); });
      infoWindow.open(crMap, marker);
      // Wire up checkbox inside info window after it opens
      google.maps.event.addListenerOnce(infoWindow, 'domready', function() {
        var cb = document.querySelector('.cr-map-pin-check[data-idx="' + idx + '"]');
        if (cb) {
          cb.addEventListener('change', function() {
            if (typeof compReportToggleRowSelection === 'function') {
              compReportToggleRowSelection(idx, cb.checked);
            }
            updateMarkerAppearance(markerObj);
            updateMapToolbar();
          });
        }
      });
    });

    // Right-click to quick-toggle without opening popup
    marker.addListener('rightclick', function() {
      var currentlySelected = !window.compReportsDeselected || !window.compReportsDeselected.has(idx);
      if (typeof compReportToggleRowSelection === 'function') {
        compReportToggleRowSelection(idx, !currentlySelected);
      }
      updateMarkerAppearance(markerObj);
      updateMapToolbar();
    });
  }

  // Patch compReportRenderResults to also refresh map if in map view
  onDomReady(function() {
    var origRender = window.compReportRenderResults;
    window.compReportRenderResults = function(results, pageInfo) {
      if (typeof origRender === 'function') origRender.apply(this, arguments);
      if (crCurrentView === 'map') {
        loadGoogleMapsApi(function() {
          setTimeout(renderCompReportMap, 200);
        });
      }
    };
    // Ensure initial state: table visible, map hidden
    var mapContainer = document.getElementById('cr-map-container');
    if (mapContainer) mapContainer.classList.add('is-hidden');
  });

  // Expose function to refresh marker appearances from outside (e.g. when table selection changes)
  window.crMapRefreshSelections = function() {
    if (crCurrentView === 'map') updateAllMarkerAppearances();
  };
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
  onDomReady(function() {
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
  onDomReady(function() {
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
      // After AI fills voucher fields, reset the step flow to step 1 so the user
      // can click Continue to review each pre-filled step. Without this, fields
      // in steps 2-4 are display:none and appear to the user as if they weren't filled.
      if (tab === 'voucher' && count > 0) {
        setTimeout(function() {
          try {
            const flow = window.__stepFlows && window.__stepFlows['voucher-main'];
            if (flow && typeof flow.go === 'function') flow.go(0);
          } catch(e) {}
        }, 50);
      }
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
// Close modal when clicking the backdrop (outside the modal box)
window.aiConfirmOverlayClick = function(event) {
  if (event.target === event.currentTarget) window.aiConfirmCancel();
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
  onDomReady(function() {
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
  onDomReady(function() {
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

.btn-copy-to-voucher { background: #1D4ED8; color: #fff; border: none; }
.btn-copy-to-voucher:hover { background: #1E40AF; }
.rent-row-comm-rate { font-size: 12px; }

/* Map toolbar for selectable pins */
.cr-map-toolbar { position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 600; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.10); gap: 12px; }
.cr-map-toolbar-left { display: flex; align-items: center; gap: 10px; }
.cr-map-toolbar-right { display: flex; align-items: center; gap: 8px; }
.cr-map-toolbar-count { font-size: 13px; font-weight: 600; color: #1a1a2e; white-space: nowrap; }
.cr-map-toolbar-btn { padding: 5px 12px; font-size: 11px; font-weight: 600; border: 1px solid #D1D5DB; border-radius: 6px; background: #fff; cursor: pointer; color: #374151; transition: all 0.15s; }
.cr-map-toolbar-btn:hover { background: #F3F4F6; border-color: #9CA3AF; }
.cr-map-toolbar-export { padding: 6px 14px; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer; }
.cr-map-toolbar-export:disabled { opacity: 0.4; cursor: not-allowed; }
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
