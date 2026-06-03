/**
 * CoStar-style chip filter system for Comp Reports
 * Provides search-as-you-type with chips and smart location hierarchy.
 */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA: Location hierarchy
  // ═══════════════════════════════════════════════════════════════════════════

  var MARKETS = ['Orange County','Los Angeles','Inland Empire','Riverside','San Bernardino','San Diego'];

  var SUBMARKETS = ['IBC','NOC','SOC','SAE','SCM','WC','NM','Mid Cities','Airport Area','IE East','IE West',
    'Anaheim','Brea/Fullerton','Cerritos','Chino/Chino Hills','Corona','Costa Mesa/Newport','Cypress',
    'Fontana/Rialto','Huntington Beach','Industry','Irvine','La Mirada/Norwalk','Long Beach','Mira Loma',
    'National City','Ontario','Orange/Tustin','Perris','Rancho Dominguez','Riverside','Santa Ana',
    'South Bay','Torrance','Vernon/Commerce'];

  var CITIES = ['Anaheim','Buena Park','Brea','Carson','Cerritos','Chino','Chino Hills','Corona',
    'Costa Mesa','Cypress','El Segundo','Fontana','Fullerton','Garden Grove','Huntington Beach',
    'Industry','Irvine','La Mirada','Lake Forest','Laguna Hills','Laguna Niguel','Long Beach',
    'Los Angeles','National City','Newport Beach','Ontario','Orange','Perris','Placentia',
    'Rancho Dominguez','Riverside','Santa Ana','Torrance','Tustin','Vernon','Westminster'];

  var PROP_TYPES = ['Industrial','Office','Retail','Land','Flex','R&D/Flex'];

  // City → Market mapping
  var CITY_TO_MARKET = {
    'Anaheim': 'Orange County', 'Buena Park': 'Orange County', 'Brea': 'Orange County',
    'Costa Mesa': 'Orange County', 'Cypress': 'Orange County', 'Fullerton': 'Orange County',
    'Garden Grove': 'Orange County', 'Huntington Beach': 'Orange County', 'Irvine': 'Orange County',
    'Lake Forest': 'Orange County', 'Laguna Hills': 'Orange County', 'Laguna Niguel': 'Orange County',
    'Newport Beach': 'Orange County', 'Orange': 'Orange County', 'Placentia': 'Orange County',
    'Santa Ana': 'Orange County', 'Tustin': 'Orange County', 'Westminster': 'Orange County',
    'Carson': 'Los Angeles', 'Cerritos': 'Los Angeles', 'El Segundo': 'Los Angeles',
    'Long Beach': 'Los Angeles', 'Los Angeles': 'Los Angeles', 'Rancho Dominguez': 'Los Angeles',
    'Torrance': 'Los Angeles', 'Vernon': 'Los Angeles', 'Industry': 'Los Angeles',
    'La Mirada': 'Los Angeles',
    'Chino': 'Inland Empire', 'Chino Hills': 'Inland Empire', 'Corona': 'Inland Empire',
    'Fontana': 'Inland Empire', 'Ontario': 'Inland Empire', 'Perris': 'Inland Empire',
    'Riverside': 'Inland Empire',
    'National City': 'San Diego'
  };

  // Submarket → Market mapping
  var SUBMARKET_TO_MARKET = {
    'IBC': 'Orange County', 'NOC': 'Orange County', 'SOC': 'Orange County',
    'SAE': 'Orange County', 'SCM': 'Orange County', 'WC': 'Orange County',
    'Airport Area': 'Orange County', 'Anaheim': 'Orange County', 'Brea/Fullerton': 'Orange County',
    'Costa Mesa/Newport': 'Orange County', 'Cypress': 'Orange County',
    'Huntington Beach': 'Orange County', 'Irvine': 'Orange County', 'Orange/Tustin': 'Orange County',
    'Santa Ana': 'Orange County',
    'NM': 'Los Angeles', 'Mid Cities': 'Los Angeles', 'Cerritos': 'Los Angeles',
    'Industry': 'Los Angeles', 'La Mirada/Norwalk': 'Los Angeles', 'Long Beach': 'Los Angeles',
    'Rancho Dominguez': 'Los Angeles', 'South Bay': 'Los Angeles', 'Torrance': 'Los Angeles',
    'Vernon/Commerce': 'Los Angeles',
    'IE East': 'Inland Empire', 'IE West': 'Inland Empire', 'Chino/Chino Hills': 'Inland Empire',
    'Corona': 'Inland Empire', 'Fontana/Rialto': 'Inland Empire', 'Mira Loma': 'Inland Empire',
    'Ontario': 'Inland Empire', 'Perris': 'Inland Empire', 'Riverside': 'Inland Empire',
    'National City': 'San Diego'
  };

  // Market → Cities
  var MARKET_TO_CITIES = {};
  Object.keys(CITY_TO_MARKET).forEach(function(city) {
    var mkt = CITY_TO_MARKET[city];
    if (!MARKET_TO_CITIES[mkt]) MARKET_TO_CITIES[mkt] = [];
    MARKET_TO_CITIES[mkt].push(city);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHIP INPUT COMPONENT
  // ═══════════════════════════════════════════════════════════════════════════

  function ChipInput(config) {
    this.containerId = config.containerId;
    this.chipsId = config.chipsId;
    this.searchId = config.searchId;
    this.dropdownId = config.dropdownId;
    this.items = config.items; // [{value, label, type, market?}]
    this.selected = []; // [{value, label, type}]
    this.onChangeCallback = config.onChange || function() {};
    this.init();
  }

  ChipInput.prototype.init = function() {
    var self = this;
    this.container = document.getElementById(this.containerId);
    this.chipsWrap = document.getElementById(this.chipsId);
    this.searchInput = document.getElementById(this.searchId);
    this.dropdown = document.getElementById(this.dropdownId);

    if (!this.container || !this.searchInput || !this.dropdown) return;

    this.searchInput.addEventListener('input', function() { self.onSearch(); });
    this.searchInput.addEventListener('focus', function() { self.onSearch(); });
    this.searchInput.addEventListener('keydown', function(e) { self.onKeydown(e); });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!self.container.contains(e.target)) {
        self.closeDropdown();
      }
    }, { capture: true, passive: true });

    // Click on container focuses input
    this.container.addEventListener('click', function(e) {
      if (e.target === self.container || e.target === self.chipsWrap) {
        self.searchInput.focus();
      }
    });
  };

  ChipInput.prototype.onSearch = function() {
    var query = (this.searchInput.value || '').trim().toLowerCase();
    var selectedValues = new Set(this.selected.map(function(s) { return s.value + '|' + s.type; }));

    // Filter items
    var matches = this.items.filter(function(item) {
      if (selectedValues.has(item.value + '|' + item.type)) return false;
      if (!query) return true;
      return item.label.toLowerCase().indexOf(query) !== -1;
    });

    // Group by type
    var groups = {};
    matches.forEach(function(item) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });

    this.renderDropdown(groups, query);
  };

  ChipInput.prototype.renderDropdown = function(groups, query) {
    var self = this;
    var html = '';
    var typeOrder = ['market', 'submarket', 'city', 'proptype'];
    var typeLabels = { market: 'Markets', submarket: 'Submarkets', city: 'Cities', proptype: 'Property Types' };
    var hasResults = false;

    typeOrder.forEach(function(type) {
      var items = groups[type];
      if (!items || !items.length) return;
      hasResults = true;
      html += '<div class="cr-chip-dd-group">';
      html += '<div class="cr-chip-dd-group-label">' + typeLabels[type] + '</div>';
      items.slice(0, 10).forEach(function(item) {
        var marketHint = item.market ? ' <span class="cr-chip-dd-hint">' + item.market + '</span>' : '';
        html += '<div class="cr-chip-dd-item" data-value="' + item.value.replace(/"/g, '&quot;') + '" data-type="' + item.type + '">';
        html += '<span class="cr-chip-dd-item-label">' + self.highlightMatch(item.label, query) + '</span>';
        html += marketHint;
        html += '</div>';
      });
      if (items.length > 10) {
        html += '<div class="cr-chip-dd-more">' + (items.length - 10) + ' more\u2026</div>';
      }
      html += '</div>';
    });

    if (!hasResults && query) {
      html = '<div class="cr-chip-dd-empty">No matches for \u201c' + query + '\u201d</div>';
    }

    this.dropdown.innerHTML = html;
    this.dropdown.classList.toggle('open', !!html);

    // Bind click events
    this.dropdown.querySelectorAll('.cr-chip-dd-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        self.addItem(el.dataset.value, el.dataset.type);
      });
    });
  };

  ChipInput.prototype.highlightMatch = function(text, query) {
    if (!query) return text;
    var idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return text.substring(0, idx) + '<strong>' + text.substring(idx, idx + query.length) + '</strong>' + text.substring(idx + query.length);
  };

  ChipInput.prototype.addItem = function(value, type) {
    var item = this.items.find(function(i) { return i.value === value && i.type === type; });
    if (!item) return;

    // Check if already selected
    var exists = this.selected.some(function(s) { return s.value === value && s.type === type; });
    if (exists) return;

    this.selected.push({ value: item.value, label: item.label, type: item.type });

    // Smart auto-inference: if a city is selected, auto-add its market
    if (type === 'city' && CITY_TO_MARKET[value]) {
      var market = CITY_TO_MARKET[value];
      var marketExists = this.selected.some(function(s) { return s.value === market && s.type === 'market'; });
      if (!marketExists) {
        var marketItem = this.items.find(function(i) { return i.value === market && i.type === 'market'; });
        if (marketItem) {
          this.selected.push({ value: marketItem.value, label: marketItem.label, type: 'market' });
        }
      }
    }

    // If a submarket is selected, auto-add its market
    if (type === 'submarket' && SUBMARKET_TO_MARKET[value]) {
      var mkt = SUBMARKET_TO_MARKET[value];
      var mktExists = this.selected.some(function(s) { return s.value === mkt && s.type === 'market'; });
      if (!mktExists) {
        var mktItem = this.items.find(function(i) { return i.value === mkt && i.type === 'market'; });
        if (mktItem) {
          this.selected.push({ value: mktItem.value, label: mktItem.label, type: 'market' });
        }
      }
    }

    this.searchInput.value = '';
    this.renderChips();
    this.closeDropdown();
    this.onChangeCallback(this.selected);
  };

  ChipInput.prototype.removeItem = function(value, type) {
    this.selected = this.selected.filter(function(s) {
      return !(s.value === value && s.type === type);
    });

    // If removing a market, also remove its cities and submarkets (smart cleanup)
    if (type === 'market') {
      var marketCities = MARKET_TO_CITIES[value] || [];
      var self = this;
      this.selected = this.selected.filter(function(s) {
        if (s.type === 'city' && marketCities.indexOf(s.value) !== -1) return false;
        if (s.type === 'submarket' && SUBMARKET_TO_MARKET[s.value] === value) return false;
        return true;
      });
    }

    this.renderChips();
    this.onChangeCallback(this.selected);
  };

  ChipInput.prototype.renderChips = function() {
    var self = this;
    var html = '';
    var typeColors = { market: '#98002E', submarket: '#D4546A', city: '#4A90D9', proptype: '#6B7280' };
    var typeIcons = { market: '\u25CF', submarket: '\u25CB', city: '\u25A0', proptype: '\u25C6' };

    this.selected.forEach(function(chip) {
      var color = typeColors[chip.type] || '#6B7280';
      html += '<span class="cr-chip" data-type="' + chip.type + '" style="--chip-color:' + color + '">';
      html += '<span class="cr-chip-icon">' + (typeIcons[chip.type] || '') + '</span>';
      html += '<span class="cr-chip-label">' + chip.label + '</span>';
      html += '<button type="button" class="cr-chip-remove" data-value="' + chip.value.replace(/"/g, '&quot;') + '" data-type="' + chip.type + '">&times;</button>';
      html += '</span>';
    });

    this.chipsWrap.innerHTML = html;

    // Bind remove events
    this.chipsWrap.querySelectorAll('.cr-chip-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.removeItem(btn.dataset.value, btn.dataset.type);
      });
    });
  };

  ChipInput.prototype.closeDropdown = function() {
    this.dropdown.classList.remove('open');
  };

  ChipInput.prototype.onKeydown = function(e) {
    if (e.key === 'Backspace' && !this.searchInput.value && this.selected.length) {
      var last = this.selected[this.selected.length - 1];
      this.removeItem(last.value, last.type);
    }
    if (e.key === 'Escape') {
      this.closeDropdown();
      this.searchInput.blur();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Select first visible item
      var first = this.dropdown.querySelector('.cr-chip-dd-item');
      if (first) {
        this.addItem(first.dataset.value, first.dataset.type);
      }
    }
  };

  ChipInput.prototype.getValues = function(type) {
    return this.selected.filter(function(s) { return s.type === type; }).map(function(s) { return s.value; });
  };

  ChipInput.prototype.clear = function() {
    this.selected = [];
    this.renderChips();
    this.onChangeCallback(this.selected);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function initCoStarFilters() {
    // Build location items list
    var locationItems = [];
    MARKETS.forEach(function(m) { locationItems.push({ value: m, label: m, type: 'market' }); });
    SUBMARKETS.forEach(function(s) {
      locationItems.push({ value: s, label: s, type: 'submarket', market: SUBMARKET_TO_MARKET[s] || '' });
    });
    CITIES.forEach(function(c) {
      locationItems.push({ value: c, label: c, type: 'city', market: CITY_TO_MARKET[c] || '' });
    });

    // Build property type items list
    var propTypeItems = [];
    PROP_TYPES.forEach(function(p) { propTypeItems.push({ value: p, label: p, type: 'proptype' }); });

    // Initialize location chip input
    var locationChip = new ChipInput({
      containerId: 'cr-location-chip-input',
      chipsId: 'cr-location-chips',
      searchId: 'cr-location-search',
      dropdownId: 'cr-location-dropdown',
      items: locationItems,
      onChange: function(selected) { syncToLegacyDropdowns(locationChip, propTypeChip); }
    });

    // Initialize property type chip input
    var propTypeChip = new ChipInput({
      containerId: 'cr-proptype-chip-input',
      chipsId: 'cr-proptype-chips',
      searchId: 'cr-proptype-search',
      dropdownId: 'cr-proptype-dropdown',
      items: propTypeItems,
      onChange: function(selected) { syncToLegacyDropdowns(locationChip, propTypeChip); }
    });

    // Transaction type toggle
    var toggleGroup = document.getElementById('cr-comp-type-toggle');
    var hiddenSelect = document.getElementById('cr-comp-type');
    if (toggleGroup) {
      toggleGroup.querySelectorAll('.cr-toggle-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          toggleGroup.querySelectorAll('.cr-toggle-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          if (hiddenSelect) hiddenSelect.value = btn.dataset.value;
        });
      });
    }

    // Sync chip selections to hidden legacy dropdowns
    function syncToLegacyDropdowns(locChip, ptChip) {
      var cityEl = document.getElementById('cr-city');
      var marketEl = document.getElementById('cr-market');
      var subMarketEl = document.getElementById('cr-submarket');
      var propTypeEl = document.getElementById('cr-property-type');

      if (cityEl && cityEl._setCrVals) cityEl._setCrVals(locChip.getValues('city'));
      if (marketEl && marketEl._setCrVals) marketEl._setCrVals(locChip.getValues('market'));
      if (subMarketEl && subMarketEl._setCrVals) subMarketEl._setCrVals(locChip.getValues('submarket'));
      if (propTypeEl && propTypeEl._setCrVals) propTypeEl._setCrVals(ptChip.getValues('proptype'));
    }

    // Override compReportResetFilters to also clear chips
    var origReset = window.compReportResetFilters;
    window.compReportResetFilters = function() {
      locationChip.clear();
      propTypeChip.clear();
      if (origReset) origReset();
    };

    // Store references for external access
    window._crLocationChip = locationChip;
    window._crPropTypeChip = propTypeChip;
  }

  // Run after DOM is ready and legacy dropdowns are initialized
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initCoStarFilters, 100);
    });
  } else {
    setTimeout(initCoStarFilters, 100);
  }

})();
