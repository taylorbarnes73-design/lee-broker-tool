/* Lee Broker Tool — Sign Request + Voucher screens */

function SignRequestScreen() {
  const [shape, setShape] = React.useState('sf');
  const [qty, setQty] = React.useState({ '4x8': 2, '6x8': 0, 'other': 0, 'banner': 1 });
  const [otherSize, setOtherSize] = React.useState('');
  const [bannerSize, setBannerSize] = React.useState('');
  const [nameRider, setNameRider] = React.useState(true);

  const step = (k, d) => setQty(q => ({ ...q, [k]: Math.max(0, q[k] + d) }));

  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="Sign Order"
        description="Order and install signage for an active listing. PO # is auto-generated."
        right={<>
          <Badge tone="neutral" icon={<Icons.Copy size={11}/>}>PO-2026-0418</Badge>
          <Button variant="ghost" size="sm">Save draft</Button>
        </>}
      />
      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems:'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Property */}
          <Card>
            <SectionHeader eyebrow="Step 1" title="Which listing?"/>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
              <Field label="Listing" required>
                <Input prefix={<Icons.Building size={14}/>} defaultValue="2847 Newport Blvd, Costa Mesa"/>
              </Field>
              <Field label="Deal type"><Input auto value="Lease · Industrial"/></Field>
              <Field label="Suite">
                <Input defaultValue="Entire building"/>
              </Field>
            </div>
          </Card>

          {/* Configuration */}
          <Card>
            <SectionHeader eyebrow="Step 2" title="Configuration" description="How should the sign be mounted?"/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                {id:'sf', label:'S/F', sub:'Single-face', icon:<SignIcon type="sf"/>},
                {id:'df', label:'D/F', sub:'Double-face', icon:<SignIcon type="df"/>},
                {id:'vshape', label:'V-Shape', sub:'Two panels at angle', icon:<SignIcon type="vshape"/>},
              ].map(opt => {
                const active = shape === opt.id;
                return (
                  <button key={opt.id} onClick={() => setShape(opt.id)} style={{
                    padding: '18px 14px',
                    background: active ? 'var(--lee-crimson-wash)' : 'var(--ink-0)',
                    border: `1.5px solid ${active ? 'var(--lee-crimson)' : 'var(--ink-200)'}`,
                    borderRadius: 10, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'all .14s',
                    boxShadow: active ? '0 2px 8px rgba(155,13,42,.12)' : 'none',
                    position: 'relative',
                  }}>
                    <div style={{ color: active ? 'var(--lee-crimson)' : 'var(--ink-500)' }}>{opt.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-900)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: -4 }}>{opt.sub}</div>
                    {active && <div style={{ position:'absolute', top:8, right:8, width:16, height:16, borderRadius:999, background:'var(--lee-crimson)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><Icons.Check size={10} strokeWidth={3}/></div>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Specifications */}
          <Card>
            <SectionHeader eyebrow="Step 3" title="Sign specifications" right={<Badge tone="crimson" size="sm">{Object.values(qty).reduce((a,b)=>a+b,0)} signs total</Badge>}/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {k:'4x8',    label:"4' × 8'",  desc:'Standard roadside panel'},
                {k:'6x8',    label:"6' × 8'",  desc:'Large frontage panel'},
                {k:'other',  label:'Other',     desc:'Custom size', sizeInput: true, sizeValue: otherSize,  setSize: setOtherSize,  placeholder: 'e.g. 3×4'},
                {k:'banner', label:'Banner',    desc:'Vinyl banner', sizeInput: true, sizeValue: bannerSize, setSize: setBannerSize, placeholder: 'Size'},
              ].map(row => {
                const n = qty[row.k];
                const active = n > 0;
                return (
                  <div key={row.k} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: active ? 'var(--lee-crimson-wash)' : 'var(--ink-50)',
                    border: `1px solid ${active ? 'rgba(155,13,42,.2)' : 'var(--ink-200)'}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ width: 90 }}>
                      <div className="lee-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{row.desc}</div>
                    </div>
                    {row.sizeInput ? (
                      <input
                        value={row.sizeValue}
                        onChange={e => row.setSize(e.target.value)}
                        placeholder={row.placeholder}
                        style={{ flex: 1, height: 36, padding: '0 12px', fontSize: 13, border: '1px solid var(--ink-200)', borderRadius: 6, background: 'var(--ink-0)', outline: 'none' }}
                      />
                    ) : (
                      <div style={{ flex: 1 }}/>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, border: '1px solid var(--ink-200)', borderRadius: 8, background: 'var(--ink-0)' }}>
                      <button onClick={() => step(row.k, -1)} style={stepBtn}><Icons.Minus size={14}/></button>
                      <div style={{ width: 40, textAlign: 'center', fontWeight: 700, fontSize: 15, color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-500)' }}>{n}</div>
                      <button onClick={() => step(row.k, 1)} style={stepBtn}><Icons.Plus size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'var(--ink-50)', borderRadius: 8, border: '1px solid var(--ink-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle on={nameRider} onClick={() => setNameRider(!nameRider)}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Name rider <span style={{ fontWeight: 500, color: 'var(--ink-500)' }}>· Optional</span></div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Add broker name to rider panel</div>
                </div>
                {nameRider && <Input defaultValue="Taylor Barnes · 714.555.0142" style={{ width: 280 }}/>}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader eyebrow="Step 4" title="Requested by &amp; access" description="Who's the point of contact; how do installers get on site?"/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Field label="Agent" required><Input defaultValue="Taylor Barnes"/></Field>
              <Field label="Shared Expense %"><Input suffix="%" defaultValue="50"/></Field>
              <Field label="Install by"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Apr 28, 2026"/></Field>
              <Field label="Access" span={3}>
                <Input defaultValue="Gate code 4421#. Contact property manager at 949-555-0100 if locked."/>
              </Field>
              <Field label="Comments / placement notes" span={3} optional>
                <textarea defaultValue="Install on Newport Blvd frontage, right of the driveway. Avoid blocking tenant signage on the north elevation." style={textareaStyle}/>
              </Field>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary">Save draft</Button>
            <Button variant="primary" icon={<Icons.Send size={14}/>}>Submit order</Button>
          </div>
        </div>

        <OrderSummaryRail qty={qty} shape={shape}/>
      </div>
    </div>
  );
}

function SignIcon({ type }) {
  // S/F = Single-face post sign — one panel on a post, front view
  if (type === 'sf') return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* panel */}
      <rect x="12" y="10" width="40" height="24" rx="1.5"/>
      {/* divider line (for name rider) */}
      <path d="M12 28h40" strokeOpacity=".45"/>
      {/* post */}
      <path d="M32 34v18"/>
      {/* ground */}
      <path d="M22 52h20"/>
    </svg>
  );
  // D/F = Double-face — panels back-to-back, shown in a slight 3/4 view
  if (type === 'df') return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* front panel */}
      <rect x="10" y="12" width="36" height="22" rx="1.5"/>
      {/* back panel offset */}
      <path d="M46 12l8 4v22l-8 4" />
      <path d="M46 34l8 4"/>
      {/* post */}
      <path d="M28 34v18"/>
      {/* ground */}
      <path d="M18 52h20"/>
    </svg>
  );
  // V-Shape = two panels meeting at a V, shown from top-down-ish perspective
  if (type === 'vshape') return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* left panel */}
      <path d="M32 10 14 18v16l18 8z"/>
      {/* right panel */}
      <path d="M32 10l18 8v16l-18 8z"/>
      {/* center seam */}
      <path d="M32 10v32" strokeOpacity=".55"/>
      {/* post */}
      <path d="M32 42v10"/>
      {/* ground */}
      <path d="M22 52h20"/>
    </svg>
  );
  return null;
}

const stepBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6,
  color: 'var(--ink-700)',
};

const textareaStyle = {
  minHeight: 80, padding: 12, fontSize: 14, lineHeight: 1.5,
  background: 'var(--ink-0)', border: '1px solid var(--ink-200)', borderRadius: 6,
  fontFamily: 'var(--font-sans)', color: 'var(--ink-900)', outline: 'none', resize: 'vertical',
};

function OrderSummaryRail({ qty, shape }) {
  const prices = { '4x8': 285, '6x8': 420, 'other': 175, 'banner': 95 };
  const labels = { '4x8': "4' × 8'", '6x8': "6' × 8'", 'other': 'Other', 'banner': 'Banner' };
  const shapeLabel = { sf: 'S/F', df: 'D/F', vshape: 'V-Shape' }[shape] || shape;
  const total = Object.entries(qty).reduce((sum, [k, n]) => sum + (prices[k] || 0) * n, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Order summary</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>2847 Newport Blvd</div>
        <div style={{ fontSize: 12, color:'var(--ink-500)', marginTop: 2 }}>PO-2026-0418 · {shapeLabel}</div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--ink-150)', paddingTop: 12, display:'flex', flexDirection:'column', gap: 6 }}>
          {Object.entries(qty).filter(([,n])=>n>0).map(([k,n]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-600)' }}>{labels[k]}  · × {n}</span>
              <span className="lee-mono" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>
                ${(prices[k]*n).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--ink-200)', display:'flex', justifyContent:'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Estimated total</span>
          <span className="lee-mono" style={{ fontSize: 20, fontWeight: 700 }}>${total.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>Split 50% with landlord · your share ${(total/2).toLocaleString()}</div>
      </Card>

      <Card padding={18} style={{ background: 'var(--ink-50)' }}>
        <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Vendor</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Coast Sign &amp; Graphics</div>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop:2 }}>Typical install: 3-5 business days</div>
      </Card>
    </div>
  );
}

Object.assign(window, { SignRequestScreen });
