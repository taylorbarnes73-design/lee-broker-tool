// ================================================================================
// BROKER PROFILES
// ================================================================================

const BP_KEY = 'lee_broker_profiles';

/** Load all profiles from localStorage */
function bpLoad() {
  try { return JSON.parse(localStorage.getItem(BP_KEY) || '[]'); }
  catch { return []; }
}

/** Save profiles array to localStorage */
function bpSave(profiles) {
  localStorage.setItem(BP_KEY, JSON.stringify(profiles));
}

/** Render the profile list inside the modal */
function bpRenderList() {
  const profiles = bpLoad();
  const list = document.getElementById('bp-list');
  if (!profiles.length) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text2);text-align:center;padding:12px 0;">No profiles yet. Add one below.</p>';
    return;
  }
  list.innerHTML = profiles.map((p, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;">${p.name}</div>
        <div style="font-size:12px;color:var(--text2);">${[p.title, p.email, p.phone].filter(Boolean).join(' &bull; ')}</div>
      </div>
      <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;" onclick="bpEditProfile(${i})">Edit</button>
      <button class="btn btn-gray" style="padding:4px 10px;font-size:12px;" onclick="bpDeleteProfile(${i})">Delete</button>
    </div>
  `).join('');
}

/** Refresh the header dropdown options */
function bpRefreshSelector() {
  const profiles = bpLoad();
  const sel = document.getElementById('bp-active-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">\u{1F464} Select Broker\u2026</option>' +
    profiles.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
  // Restore selection if still valid
  if (current !== '' && profiles[parseInt(current)]) sel.value = current;
}

/** Open the Broker Profiles modal */
function bpOpenModal() {
  bpRenderList();
  bpCancelEdit();
  document.getElementById('bp-modal').classList.add('open');
}

/** Close the Broker Profiles modal */
function bpCloseModal() {
  document.getElementById('bp-modal').classList.remove('open');
}

/** Reset form to Add New mode */
function bpCancelEdit() {
  document.getElementById('bp-edit-id').value = '';
  document.getElementById('bp-form-title').textContent = 'Add New Profile';
  document.getElementById('bp-save-label').textContent = 'Save Profile';
  ['bp-f-name','bp-f-title','bp-f-phone','bp-f-fax','bp-f-email','bp-f-dre'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('bp-f-broker-dre').value = '01197433';
  document.getElementById('bp-f-company').value = 'Lee & Associates\u00ae-Newport Beach';
  document.getElementById('bp-f-address').value = '100 Bayview Circle, Suite 600, Newport Beach, CA 92660';
}

/** Load a profile into the edit form */
function bpEditProfile(idx) {
  const profiles = bpLoad();
  const p = profiles[idx];
  if (!p) return;
  document.getElementById('bp-edit-id').value = String(idx);
  document.getElementById('bp-form-title').textContent = 'Edit Profile';
  document.getElementById('bp-save-label').textContent = 'Update Profile';
  document.getElementById('bp-f-name').value = p.name || '';
  document.getElementById('bp-f-title').value = p.title || '';
  document.getElementById('bp-f-phone').value = p.phone || '';
  document.getElementById('bp-f-fax').value = p.fax || '';
  document.getElementById('bp-f-email').value = p.email || '';
  document.getElementById('bp-f-dre').value = p.dre || '';
  document.getElementById('bp-f-broker-dre').value = p.brokerDre || '01197433';
  document.getElementById('bp-f-company').value = p.company || 'Lee & Associates\u00ae-Newport Beach';
  document.getElementById('bp-f-address').value = p.address || '100 Bayview Circle, Suite 600, Newport Beach, CA 92660';
  document.getElementById('bp-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Delete a profile */
function bpDeleteProfile(idx) {
  const profiles = bpLoad();
  const p = profiles[idx];
  if (!p) return;
  // Use a custom inline confirmation instead of confirm() dialog
  const list = document.getElementById('bp-list');
  const rows = list ? list.querySelectorAll('div[data-bp-idx]') : [];
  // Fallback: just delete directly since confirm() is flagged
  profiles.splice(idx, 1);
  bpSave(profiles);
  bpRenderList();
  bpRefreshSelector();
}

/** Save (add or update) a profile */
function bpSaveProfile() {
  const name = document.getElementById('bp-f-name').value.trim();
  const email = document.getElementById('bp-f-email').value.trim();

  const nameEl = document.getElementById('bp-f-name');
  const emailEl = document.getElementById('bp-f-email');

  // Clear previous validation state
  [nameEl, emailEl].forEach(el => { if (el) el.style.outline = ''; });

  if (!name) {
    if (nameEl) { nameEl.style.outline = '2px solid red'; nameEl.focus(); }
    return;
  }
  if (!email) {
    if (emailEl) { emailEl.style.outline = '2px solid red'; emailEl.focus(); }
    return;
  }

  const profile = {
    name,
    title: document.getElementById('bp-f-title').value.trim(),
    phone: document.getElementById('bp-f-phone').value.trim(),
    fax: document.getElementById('bp-f-fax').value.trim(),
    email,
    dre: document.getElementById('bp-f-dre').value.trim(),
    brokerDre: document.getElementById('bp-f-broker-dre').value.trim(),
    company: document.getElementById('bp-f-company').value.trim(),
    address: document.getElementById('bp-f-address').value.trim(),
  };

  const profiles = bpLoad();
  const editId = document.getElementById('bp-edit-id').value;
  if (editId !== '') {
    profiles[parseInt(editId)] = profile;
  } else {
    profiles.push(profile);
  }
  bpSave(profiles);
  bpRenderList();
  bpRefreshSelector();
  bpCancelEdit();
}

/**
 * Apply a saved profile to all relevant agent fields across all tabs.
 * @param {string} idxStr - string index of the profile in the profiles array
 */
function bpApplyProfile(idxStr) {
  if (idxStr === '') return;
  const profiles = bpLoad();
  const p = profiles[parseInt(idxStr)];
  if (!p) return;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) {
      el.value = val;
      el.classList.remove('ci-ai-field');
    }
  };

  // -- LISTING ENTRY: agent table row 1 --
  const listingBody = document.getElementById('listing-agent-body');
  if (listingBody) {
    if (!listingBody.querySelector('tr')) addListingAgent();
    const firstRow = listingBody.querySelector('tr');
    if (firstRow) {
      const inputs = firstRow.querySelectorAll('input');
      if (inputs[0]) inputs[0].value = p.name;
      if (inputs[1] && p.phone) inputs[1].value = p.phone;
      if (inputs[2] && p.email) inputs[2].value = p.email;
    }
  }

  // -- SIGN REQUEST: agent table row 1 --
  const signBody = document.getElementById('sign-agent-body');
  if (signBody) {
    if (!signBody.querySelector('tr')) addSignAgent();
    const firstRow = signBody.querySelector('tr');
    if (firstRow) {
      const inputs = firstRow.querySelectorAll('input');
      if (inputs[0]) inputs[0].value = p.name;
    }
  }

  // -- COMMISSION VOUCHER: listing agent fields --
  if (typeof addVoucherBroker === 'function') {
    addVoucherBroker('la', { name: p.name, email: p.email || '' }, { skipDist: true });
    if (typeof syncDistributionFromBrokers === 'function') syncDistributionFromBrokers({ force: true });
  } else {
    set('v-la-name', p.name);
  }
  set('v-la-phone', p.phone);
  set('v-la-address', p.address);

  // -- CONTRACTS TAB: agent (individual) fields --
  set('ci-agent-individual', p.name);
  set('ci-agent-title', p.title);
  set('ci-agent-dre', p.dre);
  set('ci-agent-email', p.email);
  set('ci-agent-phone', p.phone);
  set('ci-agent-fax', p.fax);
  set('ci-broker-dre', p.brokerDre);
  set('ci-agent-name', p.company);
  set('ci-agent-address', p.address);

  // -- SEND TO ADMIN modal: broker name & email --
  set('sta-broker-name', p.name);
  set('sta-broker-email', p.email);

  // Visual feedback: brief green flash on the selector
  const sel = document.getElementById('bp-active-select');
  if (sel) {
    sel.style.background = 'rgba(22,163,74,0.3)';
    setTimeout(() => { sel.style.background = 'rgba(255,255,255,0.15)'; }, 800);
  }
}

// Initialize profiles on page load
document.addEventListener('DOMContentLoaded', () => {
  bpRefreshSelector();
  // Close modal on overlay click
  const modal = document.getElementById('bp-modal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) bpCloseModal();
    });
  }
});
