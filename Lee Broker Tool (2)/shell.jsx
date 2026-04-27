/* Lee Broker Tool — App Shell: header, tab nav, broker profile, AI button */

function AppShell({ activeTab, onTab, profile, onProfileClick, onAiClick, children, viewportH = 1080, viewportW = 1440 }) {
  const tabs = [
    { id: 'listing', label: 'Listings', icon: Icons.Listing },
    { id: 'sign', label: 'Sign Orders', icon: Icons.Sign },
    { id: 'voucher', label: 'Vouchers', icon: Icons.Voucher },
    { id: 'comp', label: 'Comps', icon: Icons.Comp },
    { id: 'contract', label: 'Contracts', icon: Icons.Contract },
    { id: 'docs', label: 'Documents', icon: Icons.Docs },
    { id: 'admin', label: 'Admin', icon: Icons.Admin },
  ];

  return (
    <div className="lee-app" style={{
      width: viewportW, height: viewportH, display: 'flex', flexDirection: 'column',
      background: 'var(--ink-50)', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <header style={{
        height: 56, flexShrink: 0,
        background: 'var(--ink-900)', color: '#fff',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 24,
        borderBottom: '1px solid var(--ink-800)',
      }}>
        {/* Logo lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--lee-crimson)', color: '#fff', fontWeight: 800, fontSize: 14,
            letterSpacing: '-0.04em', borderRadius: 4,
          }}>L</div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>LEE &amp; ASSOCIATES</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-400)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Newport Beach · Broker Desk
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}/>

        {/* Global search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: 280, height: 32, padding: '0 12px',
          background: 'rgba(255,255,255,.07)',
          borderRadius: 6, color: 'var(--ink-300)',
          fontSize: 13,
        }}>
          <Icons.Search size={14}/>
          <span>Search deals, properties, brokers…</span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 10, padding: '2px 5px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>⌘K</span>
        </div>

        {/* AI button */}
        <button onClick={onAiClick} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 32, padding: '0 12px',
          background: 'var(--ai-gradient)',
          border: 'none', borderRadius: 6,
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 0 0 1px rgba(255,255,255,.08) inset, 0 4px 12px rgba(139,95,240,.35)',
        }}>
          <Icons.Sparkles size={14}/>
          Deal Assist
        </button>

        <RequestTracker/>

        <button style={{ background:'transparent', border:'none', color: 'var(--ink-300)', cursor:'pointer', position:'relative', padding: 8 }}>
          <Icons.Bell size={18}/>
          <span style={{ position:'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 999, background: 'var(--lee-crimson)' }}/>
        </button>

        {/* Profile */}
        <button onClick={onProfileClick} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          height: 36, padding: '0 10px 0 4px',
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 8, color: '#fff', cursor: 'pointer',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--lee-crimson)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>{profile?.initials || 'TB'}</div>
          <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{profile?.name || 'Taylor Barnes'}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-400)' }}>{profile?.title || 'Broker · DRE #02135478'}</div>
          </div>
          <Icons.ChevronDown size={14} style={{ color: 'var(--ink-400)' }}/>
        </button>
      </header>

      {/* Tab rail */}
      <nav style={{
        height: 52, flexShrink: 0,
        background: 'var(--ink-0)',
        borderBottom: '1px solid var(--ink-200)',
        display: 'flex', alignItems: 'stretch',
        padding: '0 24px',
      }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          const Ic = t.icon;
          return (
            <button key={t.id} onClick={() => onTab && onTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 18px',
              fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? 'var(--lee-crimson)' : 'var(--ink-600)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              position: 'relative',
              letterSpacing: '-0.005em',
            }}>
              <Ic size={16}/>
              {t.label}
              {active && (
                <span style={{
                  position: 'absolute', left: 12, right: 12, bottom: -1, height: 2,
                  background: 'var(--lee-crimson)', borderRadius: '2px 2px 0 0',
                }}/>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap: 10, color: 'var(--ink-500)', fontSize: 12 }}>
          <span className="lee-eyebrow" style={{ fontSize: 10 }}>System</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:999, background:'var(--ok-500)' }}/>
            All services operational
          </span>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

// Progress bar that sits under page title
function StepProgress({ step, total, percent }) {
  const pct = percent ?? Math.round((step / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--ink-200)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'var(--lee-crimson)',
          borderRadius: 999, transition: 'width .3s var(--ease-out)',
        }}/>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>
        Step {step} of {total} <span style={{ color: 'var(--ink-400)' }}>· {pct}%</span>
      </div>
    </div>
  );
}

// Page header — consistent per tab
function PageHeader({ title, description, eyebrow, right, children }) {
  return (
    <div style={{
      background: 'var(--ink-0)',
      borderBottom: '1px solid var(--ink-200)',
      padding: '24px 32px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div>
          {eyebrow && <div className="lee-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
            {title}
          </div>
          {description && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4, maxWidth: 640 }}>{description}</div>}
        </div>
        {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div>}
      </div>
      {children && <div style={{ marginTop: 20 }}>{children}</div>}
    </div>
  );
}

// Segmented control (for sub-tabs like Add/Modify or Lease/Sale)
function Segmented({ options, value, onChange, size = 'md' }) {
  const h = size === 'sm' ? 30 : 36;
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--ink-100)', borderRadius: 8,
      border: '1px solid var(--ink-200)',
    }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange && onChange(v)} style={{
            height: h, padding: '0 14px',
            fontSize: size === 'sm' ? 12 : 13, fontWeight: active ? 600 : 500,
            color: active ? 'var(--ink-900)' : 'var(--ink-600)',
            background: active ? 'var(--ink-0)' : 'transparent',
            border: 'none', borderRadius: 6, cursor: 'pointer',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)' : 'none',
            transition: 'all .12s',
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ── Request Tracker popover — shows my submissions & queue position ────
function RequestTracker() {
  const [open, setOpen] = React.useState(false);
  const requests = [
    { id:'V-2026-0418', type:'Voucher', label:'2847 Newport Blvd · $127,935', stage:'admin-review', pos: 2, eta:'~1h' },
    { id:'L-2026-0412', type:'Listing', label:'1250 E Alton Ave', stage:'mls-push', pos: 1, eta:'~15m' },
    { id:'S-2026-0410', type:'Sign Order', label:'3400 Bristol St · 3 signs', stage:'vendor', pos: 5, eta:'3 days' },
    { id:'V-2026-0405', type:'Voucher', label:'875 W 17th St · $58,200', stage:'complete' },
  ];
  const inQueue = requests.filter(r => r.stage !== 'complete').length;
  const stages = [
    { id:'submitted',     label:'Submitted' },
    { id:'admin-review',  label:'Admin review' },
    { id:'mls-push',      label:'MLS / Dealius' },
    { id:'vendor',        label:'Vendor' },
    { id:'complete',      label:'Complete' },
  ];
  const stageIndex = (s) => stages.findIndex(x => x.id === s);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display:'flex', alignItems:'center', gap: 8, height: 32, padding: '0 12px',
        background: open ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)',
        border:'1px solid rgba(255,255,255,.08)', borderRadius: 6,
        color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        <span style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width: 14, height: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--warn-500)', boxShadow: '0 0 0 0 rgba(212,136,6,.6)', animation: 'leeBeacon 1.8s ease-out infinite' }}/>
        </span>
        Requests
        <span style={{
          padding: '1px 6px', borderRadius: 999,
          background: 'var(--lee-crimson)', color:'#fff',
          fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
        }}>{inQueue}</span>
        <Icons.ChevronDown size={12} style={{ color: 'var(--ink-400)' }}/>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset: 0, zIndex: 40 }}/>
          <div style={{
            position:'absolute', top: 40, right: 0, width: 460, zIndex: 41,
            background: 'var(--ink-0)', color: 'var(--ink-900)',
            border: '1px solid var(--ink-200)', borderRadius: 12,
            boxShadow: '0 24px 60px rgba(10,10,11,.25)',
            overflow: 'hidden', fontFamily: 'var(--font-sans)',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--ink-150)', display:'flex', alignItems:'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>My requests</div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{inQueue} in progress · {requests.length - inQueue} complete this week</div>
              </div>
              <button style={{ fontSize: 11, fontWeight: 600, color: 'var(--lee-crimson)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>

            {/* Request list */}
            <div style={{ maxHeight: 460, overflow: 'auto' }}>
              {requests.map((r, i) => {
                const done = r.stage === 'complete';
                const si = stageIndex(r.stage);
                return (
                  <div key={r.id} style={{
                    padding: '14px 18px',
                    borderTop: i > 0 ? '1px solid var(--ink-150)' : 'none',
                    background: done ? 'var(--ink-0)' : 'var(--ink-0)',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
                      <Badge tone={done ? 'success' : (r.type === 'Voucher' ? 'crimson' : r.type === 'Listing' ? 'slate' : 'neutral')} size="sm">{r.type}</Badge>
                      <div style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                      <span className="lee-mono" style={{ fontSize: 10, color: 'var(--ink-400)' }}>{r.id}</span>
                    </div>

                    {/* Stage rail */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      {stages.map((s, idx) => {
                        const past = idx < si;
                        const current = idx === si;
                        const active = past || current;
                        const isDone = done && idx === stages.length - 1;
                        return (
                          <React.Fragment key={s.id}>
                            <div style={{
                              display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
                              minWidth: 0, flexShrink: 0,
                            }}>
                              <div style={{
                                width: current ? 14 : 10, height: current ? 14 : 10, borderRadius: 999,
                                background: isDone ? 'var(--ok-500)' : (current ? 'var(--lee-crimson)' : (past ? 'var(--ink-700)' : 'var(--ink-200)')),
                                border: current ? '3px solid var(--lee-crimson-wash)' : 'none',
                                boxShadow: current ? '0 0 0 2px var(--lee-crimson), 0 0 0 5px var(--lee-crimson-glow)' : 'none',
                                transition: 'all .2s',
                              }}/>
                            </div>
                            {idx < stages.length - 1 && (
                              <div style={{
                                flex: 1, height: 2, margin: current ? '0 3px' : '0 2px',
                                background: past ? 'var(--ink-700)' : 'var(--ink-200)',
                              }}/>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      {stages.map((s, idx) => (
                        <div key={s.id} style={{
                          fontSize: 9.5, fontWeight: idx === si ? 700 : 500,
                          color: idx === si ? 'var(--lee-crimson)' : (idx < si ? 'var(--ink-600)' : 'var(--ink-400)'),
                          letterSpacing: '0.02em',
                        }}>{s.label}</div>
                      ))}
                    </div>

                    {/* Status row */}
                    {!done && (
                      <div style={{ marginTop: 10, display:'flex', alignItems:'center', gap: 8, padding: '8px 10px', background: 'var(--ink-50)', borderRadius: 6 }}>
                        <span style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: 999, background: 'var(--warn-500)' }}/>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-700)' }}>
                          <b>#{r.pos}</b> in {stages[si]?.label.toLowerCase()} queue
                        </span>
                        <span style={{ color: 'var(--ink-300)' }}>·</span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>Est. {r.eta}</span>
                        <div style={{ flex: 1 }}/>
                        <button style={{ fontSize: 11, fontWeight: 600, color: 'var(--lee-crimson)', background: 'none', border: 'none', cursor: 'pointer' }}>Details →</button>
                      </div>
                    )}
                    {done && (
                      <div style={{ marginTop: 10, display:'flex', alignItems:'center', gap: 8, padding: '8px 10px', background: 'var(--ok-100)', borderRadius: 6 }}>
                        <Icons.CheckCircle size={12} style={{ color: 'var(--ok-600)' }}/>
                        <span style={{ fontSize: 11.5, color: 'var(--ok-600)', fontWeight: 600 }}>Processed · Dealius confirmed</span>
                        <div style={{ flex: 1 }}/>
                        <button style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-600)', background: 'none', border: 'none', cursor: 'pointer' }}>View receipt →</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes leeBeacon { 0% { box-shadow: 0 0 0 0 rgba(212,136,6,.55); } 70% { box-shadow: 0 0 0 8px rgba(212,136,6,0); } 100% { box-shadow: 0 0 0 0 rgba(212,136,6,0); } }`}</style>
    </div>
  );
}

Object.assign(window, { AppShell, StepProgress, PageHeader, Segmented, RequestTracker });
