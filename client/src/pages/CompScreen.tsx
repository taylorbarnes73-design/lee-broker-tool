import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Icons, PageHeader, StepProgress, Segmented, Button, Card, Badge, 
  Input, Select, StepCard, Field, Toggle, Metric, SummaryRow, FormSection, FormRow, SectionHeader 
} from '../design/index.jsx';
/* Lee Broker Tool — Comps, Admin, Contracts, Documents, AI panel */

// ── Comp Reports (the user said this is a mess — redesign as a clear workflow) ──
function CompScreen() {
  return (
    <div>
      <PageHeader
        eyebrow="Market Intelligence"
        title="Comparable Reports"
        description="Pull sale and lease comps for a subject property. Export as a branded PDF packet."
        right={<>
          <Button variant="secondary" size="sm" icon={<Icons.Upload size={14}/>}>Import CSV</Button>
          <Button variant="primary" size="sm" icon={<Icons.Plus size={14}/>}>New comp report</Button>
        </>}
      />
      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems:'start' }}>
        {/* Left: subject + filters */}
        <div style={{ display:'flex', flexDirection:'column', gap: 16, position:'sticky', top: 24 }}>
          <Card padding={20}>
            <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Subject property</div>
            <div style={{ width: '100%', height: 120, background: 'linear-gradient(135deg, var(--ink-100), var(--ink-200))', borderRadius: 8, position:'relative', overflow:'hidden', marginBottom: 12 }}>
              <div style={{ position:'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,.03) 10px 11px)' }}/>
              <div style={{ position:'absolute', bottom: 8, left: 10, fontSize: 10, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform:'uppercase' }}>Satellite preview</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>2847 Newport Blvd</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Costa Mesa, CA 92627</div>
            <div style={{ marginTop: 12, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
              <Pill label="Type" value="Industrial"/>
              <Pill label="Size" value="24,500 SF"/>
              <Pill label="Built" value="2005"/>
              <Pill label="Clear" value="28'"/>
            </div>
          </Card>

          <Card padding={20}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 12 }}>
              <div className="lee-eyebrow">Filters</div>
              <button style={{ fontSize: 11, color: 'var(--lee-crimson)', background:'none', border:'none', cursor:'pointer', fontWeight: 600 }}>Reset</button>
            </div>
            <Field label="Comp type"><Segmented size="sm" value="lease" onChange={()=>{}} options={[{value:'lease',label:'Lease'},{value:'sale',label:'Sale'},{value:'both',label:'Both'}]}/></Field>
            <div style={{ marginTop: 12 }}><Field label="Radius"><Select value="3" onChange={()=>{}} options={['1 mile','3 miles','5 miles','10 miles']}/></Field></div>
            <div style={{ marginTop: 12 }}><Field label="Size range"><Input suffix="SF" defaultValue="15,000 – 40,000"/></Field></div>
            <div style={{ marginTop: 12 }}><Field label="Closed within"><Select value="12mo" onChange={()=>{}} options={['3 months','6 months','12 months','24 months']}/></Field></div>
            <div style={{ marginTop: 16, display:'flex', alignItems:'center', gap:10, padding: '10px 12px', background:'var(--ai-100)', borderRadius: 8, border:'1px solid rgba(110,63,217,.2)' }}>
              <Icons.Sparkles size={14} style={{ color:'var(--ai-500)' }}/>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-700)' }}><b>Deal Assist</b> picked these filters from your subject</div>
            </div>
          </Card>
        </div>

        {/* Right: results */}
        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          {/* Stats strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Comps found" value="12" unit=""/>
            <StatCard label="Median rate" value="$1.37" unit="/SF/Mo NNN" trend="+4.2% YoY"/>
            <StatCard label="Avg term" value="5.4" unit="yrs"/>
            <StatCard label="Avg TI" value="$12" unit="/SF" trend="-8%"/>
          </div>

          {/* Map + list combo */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '12px 20px', borderBottom: '1px solid var(--ink-150)' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>12 comps · sorted by relevance</div>
              <div style={{ display:'flex', gap: 6 }}>
                <Segmented size="sm" options={[{value:'list',label:<Icons.List size={12}/>},{value:'grid',label:<Icons.Grid size={12}/>},{value:'map',label:<Icons.Pin size={12}/>}]} value="list" onChange={()=>{}}/>
                <Button variant="ghost" size="sm" icon={<Icons.Sort size={12}/>}>Sort</Button>
                <Button variant="ghost" size="sm" icon={<Icons.Filter size={12}/>}>Columns</Button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns: '32px 2fr 1fr .8fr 1fr .8fr .8fr 32px', padding: '10px 20px', background: 'var(--ink-50)', fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <div/><div>Property</div><div>Tenant</div><div>SF</div><div>Rate</div><div>Term</div><div>Closed</div><div/>
            </div>
            {[
              {addr:'1810 W MacArthur Blvd', tenant:'Arrowhead Logistics', sf:'22,400', rate:'$1.41', term:'7 yr', closed:'Feb 2026', score:'A'},
              {addr:'3200 Airway Ave', tenant:'Confidential', sf:'31,200', rate:'$1.38', term:'5 yr', closed:'Jan 2026', score:'A'},
              {addr:'2212 S Hathaway St', tenant:'Pacific Foods', sf:'18,900', rate:'$1.32', term:'10 yr', closed:'Dec 2025', score:'B'},
              {addr:'650 E Dyer Rd', tenant:'Relay Robotics', sf:'26,700', rate:'$1.44', term:'5 yr', closed:'Nov 2025', score:'A'},
              {addr:'440 Fischer Ave', tenant:'Harbor Paints', sf:'19,800', rate:'$1.29', term:'3 yr', closed:'Oct 2025', score:'B'},
              {addr:'1125 Victoria St', tenant:'Vantage 3PL', sf:'35,100', rate:'$1.33', term:'7 yr', closed:'Sep 2025', score:'B'},
            ].map((r,i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns: '32px 2fr 1fr .8fr 1fr .8fr .8fr 32px', padding: '12px 20px', alignItems:'center', borderTop: '1px solid var(--ink-150)', fontSize: 13 }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--lee-crimson)' }}/>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.addr}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Costa Mesa · Industrial</div>
                </div>
                <div style={{ color: 'var(--ink-600)' }}>{r.tenant}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-700)' }}>{r.sf}</div>
                <div className="lee-mono" style={{ fontWeight: 600 }}>{r.rate}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-600)' }}>{r.term}</div>
                <div style={{ color: 'var(--ink-600)' }}>{r.closed}</div>
                <div><Badge tone={r.score==='A' ? 'success' : 'neutral'} size="sm">{r.score}</Badge></div>
              </div>
            ))}
            <div style={{ padding: '14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop: '1px solid var(--ink-150)', background: 'var(--ink-50)' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>6 of 12 selected</div>
              <div style={{ display:'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" icon={<Icons.Download size={14}/>}>Export CSV</Button>
                <Button variant="primary" size="sm" icon={<Icons.Docs size={14}/>}>Build PDF packet</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Pill({label, value}: any) {
  return (
    <div style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 6, padding: '6px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--ink-500)', fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color:'var(--ink-900)', marginTop:1 }}>{value}</div>
    </div>
  );
}
function StatCard({label,value,unit,trend}: any) {
  return (
    <Card padding={16}>
      <div className="lee-eyebrow">{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap: 4, marginTop: 4 }}>
        <span className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{unit}</span>
      </div>
      {trend && <div style={{ fontSize: 11, color: trend.startsWith('-') ? 'var(--err-600)' : 'var(--ok-600)', fontWeight: 600, marginTop: 2 }}>{trend}</div>}
    </Card>
  );
}

// ── Admin Portal — inbox, Dealius push, agent roster ──
function AdminScreen() {
  const [view, setView] = React.useState('inbox');
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Admin Portal"
        description="Inbox of broker submissions, Dealius listing & deal input, agent roster, and office operations."
        right={<>
          <Badge tone="crimson" size="md">7 pending</Badge>
          <Button variant="secondary" size="sm" icon={<Icons.Download size={14}/>}>Export week</Button>
          <Button variant="primary" size="sm" icon={<Icons.Plus size={14}/>}>Add agent</Button>
        </>}
      />

      {/* View switcher */}
      <div style={{ padding: '0 32px', borderBottom: '1px solid var(--ink-200)', display:'flex', gap: 2 }}>
        {[
          {id:'inbox', label:'Submissions inbox', count: 7},
          {id:'dealius', label:'Dealius push', count: 3},
          {id:'roster', label:'Agent roster', count: 24},
          {id:'ops', label:'Office ops'},
        ].map(v => {
          const active = v.id === view;
          return (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              padding: '12px 18px', background:'transparent', border:'none', cursor:'pointer',
              fontSize: 13.5, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lee-crimson)' : 'var(--ink-600)',
              borderBottom: active ? '2px solid var(--lee-crimson)' : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {v.label}
              {v.count !== undefined && (
                <span className="lee-mono" style={{
                  padding: '1px 6px', borderRadius: 999,
                  background: active ? 'var(--lee-crimson-wash)' : 'var(--ink-100)',
                  color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-600)',
                  fontSize: 10, fontWeight: 700,
                }}>{v.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {view === 'inbox' && <AdminInbox/>}
      {view === 'dealius' && <AdminDealius/>}
      {view === 'roster' && <AdminRoster/>}
      {view === 'ops' && <AdminOps/>}
    </div>
  );
}

// ── Inbox: submissions with submitter info + queue context ──
function AdminInbox() {
  const rows = [
    {type:'Voucher', icon:<Icons.Voucher size={14}/>, prop:'2847 Newport Blvd · Costa Mesa', agent:'Taylor Barnes', agentTitle:'Senior Associate', avatar:'TB', amt:'$127,935', age:'2h 14m', tone:'crimson', id:'V-2026-0418', flag:'Co-broker split'},
    {type:'Listing', icon:<Icons.Listing size={14}/>, prop:'1250 E Alton Ave · Santa Ana', agent:'Rick Turner', agentTitle:'Principal', avatar:'RT', amt:'—', age:'4h 02m', tone:'slate', id:'L-2026-0412', flag:null},
    {type:'Sign', icon:<Icons.Sign size={14}/>, prop:'3400 Bristol St · Costa Mesa', agent:'Taylor Barnes', agentTitle:'Senior Associate', avatar:'TB', amt:'$705', age:'6h 38m', tone:'neutral', id:'S-2026-0410', flag:null},
    {type:'Voucher', icon:<Icons.Voucher size={14}/>, prop:'875 W 17th St · Costa Mesa', agent:'Matt Durkin', agentTitle:'Associate', avatar:'MD', amt:'$58,200', age:'1d', tone:'crimson', id:'V-2026-0404', flag:'Missing W-9'},
    {type:'Contract', icon:<Icons.Contract size={14}/>, prop:'512 Superior Ave · Newport', agent:'Rick Turner', agentTitle:'Principal', avatar:'RT', amt:'—', age:'1d 2h', tone:'ai', id:'C-2026-0401', flag:'4 redlines'},
    {type:'Listing Mod', icon:<Icons.Listing size={14}/>, prop:'2100 Placentia Ave · Costa Mesa', agent:'Carter Harrington', agentTitle:'Associate', avatar:'CH', amt:'—', age:'2d', tone:'slate', id:'L-2026-0395', flag:null},
    {type:'Voucher', icon:<Icons.Voucher size={14}/>, prop:'6400 W Coast Hwy · Newport', agent:'Taylor Barnes', agentTitle:'Senior Associate', avatar:'TB', amt:'$41,300', age:'3d', tone:'crimson', id:'V-2026-0388', flag:null},
  ];
  return (
    <div style={{ padding: 32, display:'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems:'start' }}>
      <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
        {/* Sub-tabs */}
        <div style={{ display:'flex', gap: 4, borderBottom: '1px solid var(--ink-200)', padding: '0 4px' }}>
          {['Pending · 7','In review · 2','Approved · 142','Rejected · 3','All'].map((t,i) => (
            <button key={i} style={{
              padding: '9px 14px', background:'transparent', border:'none', cursor:'pointer',
              fontSize: 12.5, fontWeight: i===0 ? 700 : 500,
              color: i===0 ? 'var(--ink-900)' : 'var(--ink-500)',
              borderBottom: i===0 ? '2px solid var(--ink-900)' : '2px solid transparent',
              marginBottom: -1,
            }}>{t}</button>
          ))}
          <div style={{ flex: 1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding: '0 4px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, width: 220, height: 32, padding:'0 10px', background:'var(--ink-0)', border:'1px solid var(--ink-200)', borderRadius: 6 }}>
              <Icons.Search size={13} style={{ color: 'var(--ink-400)' }}/>
              <input placeholder="Search submitter, property…" style={{ flex:1, border:'none', outline:'none', fontSize: 12, background:'transparent' }}/>
            </div>
            <Button variant="secondary" size="sm" icon={<Icons.Filter size={13}/>}>Filter</Button>
          </div>
        </div>

        {/* Column header */}
        <Card padding={0}>
          <div style={{
            display:'grid', gridTemplateColumns: '36px 110px 1.3fr 1.2fr 110px 110px 90px 200px',
            padding: '10px 20px', gap: 12, alignItems:'center',
            background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)',
            fontSize: 10, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <input type="checkbox" style={{ accentColor:'var(--lee-crimson)' }}/>
            <div>Type</div>
            <div>Property / ID</div>
            <div>Submitted by</div>
            <div style={{ textAlign:'right' }}>Amount</div>
            <div>Submitted</div>
            <div>Status</div>
            <div style={{ textAlign:'right' }}>Actions</div>
          </div>

          {rows.map((r,i) => (
            <div key={i} style={{
              display:'grid', gridTemplateColumns: '36px 110px 1.3fr 1.2fr 110px 110px 90px 200px',
              padding: '14px 20px', alignItems:'center', gap: 12,
              borderTop: i>0 ? '1px solid var(--ink-150)' : 'none',
              cursor: 'pointer',
            }}>
              <input type="checkbox" style={{ accentColor:'var(--lee-crimson)' }}/>
              <Badge tone={r.tone} size="sm" icon={r.icon}>{r.type}</Badge>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.prop}</div>
                <div style={{ display:'flex', gap: 8, marginTop: 2, alignItems:'center' }}>
                  <span className="lee-mono" style={{ fontSize: 10, color: 'var(--ink-400)' }}>{r.id}</span>
                  {r.flag && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--warn-100)', color: 'var(--warn-600)', fontWeight: 600 }}>âš  {r.flag}</span>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink-900)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{r.avatar}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.agent}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>{r.agentTitle}</div>
                </div>
              </div>
              <div className="lee-mono" style={{ fontSize: 13, fontWeight: 600, textAlign:'right' }}>{r.amt}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{r.age} ago</div>
              <div><Badge tone="warn" size="sm">Pending</Badge></div>
              <div style={{ display:'flex', gap: 6, justifyContent:'flex-end' }}>
                <Button variant="secondary" size="sm">Review</Button>
                <Button variant="primary" size="sm" icon={<Icons.Check size={13}/>}>Approve</Button>
              </div>
            </div>
          ))}

          {/* Bulk actions bar */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--ink-200)', background: 'var(--ink-50)', display:'flex', alignItems:'center', gap: 10, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-500)' }}>7 items · bulk actions:</span>
            <Button variant="ghost" size="sm" icon={<Icons.Check size={12}/>}>Approve all</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Send size={12}/>}>Push to Dealius</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Download size={12}/>}>Export CSV</Button>
          </div>
        </Card>
      </div>

      {/* Right rail */}
      <div style={{ display:'flex', flexDirection:'column', gap: 16, position:'sticky', top: 24 }}>
        <Card padding={20}>
          <div className="lee-eyebrow" style={{ marginBottom: 10 }}>This week · Newport Beach office</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>14</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Vouchers processed</div>
            </div>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>$1.47M</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Commission closed</div>
            </div>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>3.2h</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Avg turnaround</div>
            </div>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>98%</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>First-pass accept</div>
            </div>
          </div>
        </Card>

        <Card padding={20}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
            <div className="lee-eyebrow">Queue load by type</div>
          </div>
          {[
            {label:'Vouchers', n: 3, max: 7, tone:'var(--lee-crimson)'},
            {label:'Listings', n: 2, max: 7, tone:'var(--ink-900)'},
            {label:'Sign orders', n: 1, max: 7, tone:'var(--ink-500)'},
            {label:'Contracts', n: 1, max: 7, tone:'var(--ai-500)'},
          ].map((q,i) => (
            <div key={i} style={{ marginTop: i===0 ? 0 : 10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: 'var(--ink-700)', fontWeight: 500 }}>{q.label}</span>
                <span className="lee-mono" style={{ color: 'var(--ink-500)' }}>{q.n}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow:'hidden' }}>
                <div style={{ width: `${(q.n/q.max)*100}%`, height:'100%', background: q.tone, borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </Card>

        <Card padding={20}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <Icons.Sparkles size={13} style={{ color:'var(--ai-500)' }}/>
            <div className="lee-eyebrow" style={{ margin: 0 }}>Deal Assist flags</div>
          </div>
          {[
            'V-2026-0404 missing W-9 from co-broker',
            'C-2026-0401 has 4 non-standard redlines',
            'V-2026-0418 split doesn\'t match listing agmt',
          ].map((m,i) => (
            <div key={i} style={{ display:'flex', gap: 8, padding: '8px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none', fontSize: 12, color: 'var(--ink-700)' }}>
              <span style={{ color: 'var(--warn-500)' }}>âš </span>
              {m}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Dealius push: quick-input for listings and deals ──
function AdminDealius() {
  const [mode, setMode] = React.useState('listing');
  const brokersQuery = trpc.brokers.list.useQuery();
  const brokerNames = (brokersQuery.data ?? []).map(b => b.name);
  const defaultLeadBroker = brokerNames[0] ?? 'Taylor Barnes';
  return (
    <div style={{ padding: 32, display:'grid', gridTemplateColumns:'1fr 360px', gap: 24, alignItems:'start' }}>
      <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
        <Card>
          <SectionHeader
            eyebrow="Dealius sync"
            title="Push to Dealius"
            description="Enter or confirm listing and deal data, then push to Dealius for CRM, pipeline and commission tracking."
          />
          <div style={{ marginBottom: 18 }}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                {value:'listing', label:'Listing input'},
                {value:'deal', label:'Deal input'},
              ]}
            />
          </div>

          {mode === 'listing' ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
              <Field label="Property address" required span={2}><Input defaultValue="2847 Newport Blvd, Costa Mesa, CA 92627"/></Field>
              <Field label="Listing type" required><Select value="Exclusive" onChange={()=>{}} options={['Exclusive Right to Sell','Exclusive Right to Lease','Sublease','Open Listing']}/></Field>
              <Field label="Property type" required><Select value="Industrial" onChange={()=>{}} options={['Office','Industrial','Retail','Flex','Land','Multifamily']}/></Field>
              <Field label="SF" required><Input suffix="SF" defaultValue="24,500"/></Field>
              <Field label="Asking rate"><Input prefix="$" suffix="/SF/YR NNN" defaultValue="1.95"/></Field>
              <Field label="Listing start"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Apr 22, 2026"/></Field>
              <Field label="Listing end"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Oct 22, 2026"/></Field>
              <Field label="Lead broker"><Select value={defaultLeadBroker} onChange={()=>{}} options={brokerNames}/></Field>
              <Field label="Co-broker"><Input placeholder="Optional"/></Field>
              <Field label="Commission %"><Input suffix="%" defaultValue="6.00"/></Field>
              <Field label="MLS"><Select value="AIR CRE" onChange={()=>{}} options={['AIR CRE','CoStar','LoopNet','CREXi']}/></Field>
              <Field label="Dealius pipeline stage" span={2}>
                <Select value="Active" onChange={()=>{}} options={['Prospect','Active','Under contract','Closed']}/>
              </Field>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
              <Field label="Deal type" required><Select value="Lease" onChange={()=>{}} options={['Lease','Sale','Sublease','Renewal','Expansion']}/></Field>
              <Field label="Our side" required><Select value="Listing" onChange={()=>{}} options={['Listing','Tenant rep','Buyer rep','Both sides']}/></Field>
              <Field label="Property" required span={2}><Input defaultValue="2847 Newport Blvd, Costa Mesa, CA 92627"/></Field>
              <Field label="Tenant / Buyer"><Input defaultValue="Pacific Coast Distribution LLC"/></Field>
              <Field label="Landlord / Seller"><Input defaultValue="Pacific Holdings LLC"/></Field>
              <Field label="Close / Lease comm. date"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="May 15, 2026"/></Field>
              <Field label="Consideration"><Input prefix="$" defaultValue="4,312,500"/></Field>
              <Field label="Gross commission"><Input prefix="$" defaultValue="258,750"/></Field>
              <Field label="Lee side share"><Input suffix="%" defaultValue="50"/></Field>
              <Field label="Lead broker"><Select value={defaultLeadBroker} onChange={()=>{}} options={brokerNames}/></Field>
              <Field label="Dealius deal ID"><Input className="lee-mono" defaultValue="D-2026-01872"/></Field>
            </div>
          )}

          <div style={{ marginTop: 20, padding: 14, background:'var(--ai-100)', border: '1px solid rgba(110,63,217,.2)', borderRadius: 10, display:'flex', alignItems:'center', gap: 12 }}>
            <Icons.Sparkles size={18} style={{ color: 'var(--ai-500)' }}/>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-700)' }}>
              <b>Deal Assist</b> pre-filled {mode === 'listing' ? '9' : '7'} fields from the submitted voucher and attached listing agreement.
            </div>
            <Button variant="ghost" size="sm">Review sources</Button>
          </div>

          <div style={{ marginTop: 20, display:'flex', gap: 10, justifyContent:'flex-end', paddingTop: 16, borderTop: '1px solid var(--ink-150)' }}>
            <Button variant="secondary">Save draft</Button>
            <Button variant="secondary" icon={<Icons.Download size={14}/>}>Export</Button>
            <Button variant="primary" icon={<Icons.Send size={14}/>}>Push to Dealius</Button>
          </div>
        </Card>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap: 16, position:'sticky', top: 24 }}>
        <Card padding={20}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background:'var(--ok-500)' }}/>
            <div className="lee-eyebrow" style={{ margin: 0 }}>Dealius · Connected</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>
            Last sync 3 min ago · OAuth valid through Jul 2026
          </div>
          <div style={{ marginTop: 12, display:'flex', gap: 8 }}>
            <Button variant="ghost" size="sm">Open Dealius â†’</Button>
            <Button variant="ghost" size="sm">Re-auth</Button>
          </div>
        </Card>

        <Card padding={20}>
          <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Recent pushes</div>
          {[
            {id:'L-2026-0412', label:'1250 E Alton Ave', when:'12m ago', ok:true},
            {id:'D-2026-01868', label:'Deal · 875 W 17th St', when:'1h ago', ok:true},
            {id:'L-2026-0409', label:'512 Superior Ave', when:'3h ago', ok:false, err:'Missing SF'},
            {id:'D-2026-01864', label:'Deal · 6400 W Coast Hwy', when:'yesterday', ok:true},
          ].map((p,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: p.ok ? 'var(--ok-500)' : 'var(--err-600)' }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }} className="lee-mono">{p.id}{p.err ? ` · ${p.err}` : ''}</div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>{p.when}</div>
            </div>
          ))}
        </Card>

        <Card padding={20}>
          <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Field mapping</div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.6 }}>
            Lee fields mapped to Dealius objects:
          </div>
          <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 6, fontSize: 11.5 }}>
            {[
              ['Voucher â†’ Commission record', 12],
              ['Listing â†’ Property + Listing', 18],
              ['Contract â†’ Document', 6],
            ].map(([k,n],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding: '4px 0' }}>
                <span style={{ color:'var(--ink-700)' }}>{k}</span>
                <span className="lee-mono" style={{ color:'var(--ink-500)' }}>{n} fields</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" style={{ marginTop: 10 }}>Edit mapping â†’</Button>
        </Card>
      </div>
    </div>
  );
}

// ── Agent roster (live from shared/brokerDirectory.ts via trpc.brokers.list) ──
function AdminRoster() {
  const brokersQuery = trpc.brokers.list.useQuery();
  const roster = (brokersQuery.data ?? []).map(b => ({
    name: b.name,
    avatar: b.initials,
    title: /manager/i.test(b.role)
      ? 'Principal'
      : /broker/i.test(b.role)
      ? 'Broker'
      : b.role,
    email: b.email,
    role: b.role,
    id: b.id,
  }));
  const totalAgents = roster.length;
  const activeCount = roster.length;
  return (
    <div style={{ padding: 32, display:'flex', flexDirection:'column', gap: 16 }}>
      {/* Roster stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Agents in directory" value={String(totalAgents)} unit=""/>
        <StatCard label="Active" value={String(activeCount)} unit=""/>
        <StatCard label="Office" value="Newport Beach" unit=""/>
      </div>

      <Card padding={0}>
        <div style={{ padding: '14px 20px', display:'flex', alignItems:'center', gap: 12, borderBottom: '1px solid var(--ink-150)' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Roster</div>
          <Badge size="sm">{roster.length} agents</Badge>
          <div style={{ flex: 1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:6, width: 260, height: 32, padding:'0 10px', background:'var(--ink-0)', border:'1px solid var(--ink-200)', borderRadius: 6 }}>
            <Icons.Search size={13} style={{ color: 'var(--ink-400)' }}/>
            <input placeholder="Search name or email…" style={{ flex:1, border:'none', outline:'none', fontSize: 12, background:'transparent' }}/>
          </div>
          <Button variant="secondary" size="sm" icon={<Icons.Download size={13}/>}>Export</Button>
        </div>

        {/* Column header */}
        <div style={{
          display:'grid', gridTemplateColumns: '2.2fr 1.3fr 2fr 0.8fr',
          padding: '10px 20px', gap: 12, alignItems:'center',
          background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)',
          fontSize: 10, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <div>Agent</div>
          <div>Role</div>
          <div>Email</div>
          <div style={{ textAlign:'right' }}>ID</div>
        </div>

        {brokersQuery.isLoading && (
          <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--ink-500)' }}>
            Loading roster…
          </div>
        )}

        {roster.map((a,i) => (
          <div key={a.id} style={{
            display:'grid', gridTemplateColumns: '2.2fr 1.3fr 2fr 0.8fr',
            padding: '14px 20px', alignItems:'center', gap: 12,
            borderTop: i>0 ? '1px solid var(--ink-150)' : 'none',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--ink-900)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{a.avatar}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-700)' }}>{a.role}</div>
            <div style={{ minWidth: 0, fontSize: 12, color: 'var(--ink-700)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.email}</div>
            <div className="lee-mono" style={{ fontSize: 11.5, color: 'var(--ink-500)', textAlign:'right' }}>{a.id}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Office ops ──
function AdminOps() {
  return (
    <div style={{ padding: 32, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>Commission payouts · this week</div>
        {[
          {agent:'Taylor Barnes', amt:'$63,968', status:'Scheduled Fri'},
          {agent:'Rick Turner', amt:'$98,441', status:'Awaiting wire'},
          {agent:'Matt Durkin', amt:'$29,100', status:'Paid'},
          {agent:'Libby Gessford', amt:'$152,890', status:'Paid'},
        ].map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.agent}</div>
            <div className="lee-mono" style={{ fontSize: 13, fontWeight: 600 }}>{p.amt}</div>
            <Badge size="sm" tone={p.status === 'Paid' ? 'success' : p.status === 'Scheduled Fri' ? 'neutral' : 'warn'}>{p.status}</Badge>
          </div>
        ))}
      </Card>

      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>Compliance & renewals</div>
        {[
          {who:'Joel Martinez', what:'DRE license expires', when:'34 days', tone:'warn'},
          {who:'Priya Shah', what:'E&O insurance renewal', when:'62 days', tone:'neutral'},
          {who:'Reggie Alvarez', what:'Continuing ed hours', when:'2 of 45h done', tone:'warn'},
          {who:'Office', what:'MLS dues · AIR CRE', when:'Paid Apr 10', tone:'success'},
        ].map((r,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.who}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{r.what}</div>
            </div>
            <Badge size="sm" tone={r.tone}>{r.when}</Badge>
          </div>
        ))}
      </Card>

      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>MLS & data feeds</div>
        {[
          {label:'AIR CRE · listings feed', status:'Syncing', tone:'success', sub:'Last: 3 min ago'},
          {label:'CoStar · comps pull', status:'Syncing', tone:'success', sub:'Last: 12 min ago'},
          {label:'Dealius · deals', status:'Connected', tone:'success', sub:'OAuth valid'},
          {label:'CREXi · listings', status:'Error', tone:'danger', sub:'Reauth required'},
        ].map((f,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{f.sub}</div>
            </div>
            <Badge size="sm" tone={f.tone}>{f.status}</Badge>
          </div>
        ))}
      </Card>

      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>Open tasks</div>
        {[
          'Review voucher V-2026-0404 · missing W-9',
          'Push 3 approved listings to Dealius',
          'Confirm Joel Martinez DRE renewal',
          'Reconcile April commission ledger',
          'Approve sign vendor invoice · $2,140',
        ].map((t,i) => (
          <label key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '8px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor:'var(--lee-crimson)' }}/>
            <span style={{ fontSize: 12.5, color: 'var(--ink-700)' }}>{t}</span>
          </label>
        ))}
      </Card>
    </div>
  );
}

// ── Contract intake ──
function ContractScreen() {
  const [mode, setMode] = React.useState('upload');
  const groups = [
    { name: 'Listing Agreements', items: [
      'Exclusive Right to Sell',
      'Exclusive Right to Lease',
      'Exclusive Right · Sublease',
      'Limited Listing Agreement',
      'Open Listing Agreement',
      'Listing Modification / Extension',
    ]},
    { name: 'Representation', items: [
      'Exclusive Right · Buyer/Lessee',
      'Exclusive Right · Owner Sale',
      'Exclusive Right · Owner Lease',
      'Non-Exclusive Buyer Rep',
    ]},
    { name: 'Commission Agreements', items: [
      'Commission Agreement · Lease',
      'Commission Agreement · Sale',
      'Co-Broker Commission Agreement',
      'Referral Agreement',
    ]},
    { name: 'Lease Documents', items: [
      'AIR CRE Standard Industrial / Commercial',
      'AIR CRE Multi-Tenant Industrial',
      'AIR CRE Office Lease',
      'AIR CRE Retail Lease',
      'Lease Addendum',
      'Sublease Agreement',
      'Consent to Sublease',
      'Amendment to Lease',
      'Estoppel Certificate',
      'SNDA',
      'Notice to Vacate',
      'Early Termination',
    ]},
    { name: 'Purchase & Sale', items: [
      'AIR CRE Standard Purchase Agreement',
      'Letter of Intent · Purchase',
      'Counter Offer',
      'PSA Addendum',
      'Assignment of Purchase Agreement',
    ]},
    { name: 'Disclosures', items: [
      'Agency Disclosure (CAR)',
      'Agency Confirmation',
      'Natural Hazard Disclosure',
      'Commercial Property Disclosure',
      'Lead-Based Paint Disclosure',
      'Environmental / CERCLA',
      'SB-800 Disclosure',
      'Wire Fraud Advisory',
      'Arbitration Advisory',
    ]},
  ];
  const [sel, setSel] = React.useState('Exclusive Right · Owner Lease');
  return (
    <div>
      <PageHeader
        eyebrow="AIR CRE"
        title="Contract Intake"
        description="Prepare exclusive listings, right-to-represent, lease, purchase and commission agreements. Upload an Adobe draft and Deal Assist pulls redlines."
      />
      <div style={{ padding: 32, display:'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems:'start' }}>
        <Card padding={16} style={{ maxHeight: 780, overflow: 'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 12, padding: '6px 10px', background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 6 }}>
            <Icons.Search size={13} style={{ color: 'var(--ink-400)' }}/>
            <input placeholder="Search agreements…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }}/>
          </div>
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 14 }}>
              <div className="lee-eyebrow" style={{ marginBottom: 4, padding: '0 8px', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
                <span>{g.name}</span>
                <span style={{ color: 'var(--ink-400)', fontWeight: 500 }}>{g.items.length}</span>
              </div>
              {g.items.map((l, i) => {
                const active = l === sel;
                return (
                  <button key={i} onClick={() => setSel(l)} style={{
                    display:'block', width: '100%', textAlign:'left',
                    padding: '8px 10px', marginBottom: 2,
                    background: active ? 'var(--lee-crimson-wash)' : 'transparent',
                    border: 'none', borderRadius: 6,
                    fontSize: 12.5, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-700)',
                    cursor: 'pointer', lineHeight: 1.35,
                  }}>{l}</button>
                );
              })}
            </div>
          ))}
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          <Card>
            <SectionHeader eyebrow="Selected" title={sel} description="AIR CRE form. Fill fields below, or upload a signed Adobe draft and let AI extract."/>
            <div style={{ display:'flex', gap: 8, marginBottom: 20 }}>
              <Segmented options={[{value:'upload',label:'Upload signed PDF'},{value:'fill',label:'Fill out here'}]} value={mode} onChange={setMode}/>
            </div>

            {mode === 'upload' ? (
              <div style={{
                border: '2px dashed var(--ink-300)', borderRadius: 12,
                padding: 40, textAlign:'center',
                background: 'linear-gradient(180deg, #FBF8FE 0%, var(--ink-0) 100%)',
              }}>
                <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: 14, background: 'var(--ai-gradient)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow: '0 8px 22px rgba(139,95,240,.35)' }}>
                  <Icons.Upload size={26}/>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Drop signed contract PDF</div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4, maxWidth: 420, margin:'4px auto 16px' }}>
                  Beta preview — use the production tool at <a href="/broker_tool.html" style={{ color: 'var(--lee-crimson)', fontWeight: 600, textDecoration: 'none' }}>/broker_tool.html</a> to upload contracts and run extraction.
                </div>
                <Button
                  variant="ai"
                  icon={<Icons.Upload size={14}/>}
                  onClick={() => { window.location.href = '/broker_tool.html#contracts'; }}
                >
                  Open contract tool
                </Button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
                <Field label="Owner name" required><Input defaultValue="Pacific Holdings LLC"/></Field>
                <Field label="Broker of record" required><Input defaultValue="Lee & Associates Newport Beach"/></Field>
                <Field label="Property address" required span={2}><Input defaultValue="2847 Newport Blvd, Costa Mesa, CA 92627"/></Field>
                <Field label="Listing start"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Apr 22, 2026"/></Field>
                <Field label="Listing end"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Oct 22, 2026"/></Field>
                <Field label="Commission %"><Input suffix="%" defaultValue="6.00"/></Field>
                <Field label="Arbitration"><Select value="AAA" onChange={()=>{}} options={['AAA','JAMS','Judicial reference','None']}/></Field>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Documents ──
function DocsScreen() {
  const folders = [
    {name:'Listing Agreements', count: 6, tone:'crimson'},
    {name:'Lease Documents', count: 12, tone:'slate'},
    {name:'Purchase & Sale', count: 8, tone:'neutral'},
    {name:'Commission Agreements', count: 4, tone:'neutral'},
    {name:'Disclosures', count: 9, tone:'warn'},
    {name:'Sign Orders', count: 3, tone:'neutral'},
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Resources"
        title="Document Library"
        description="Downloadable AIR CRE forms, Lee & Associates templates, and office standards."
        right={<>
          <div style={{ display:'flex', alignItems:'center', gap:8, width: 280, height: 36, padding:'0 12px', background:'var(--ink-0)', border:'1px solid var(--ink-200)', borderRadius: 6 }}>
            <Icons.Search size={14} style={{ color: 'var(--ink-400)' }}/>
            <input placeholder="Search 42 documents…" style={{ flex:1, border:'none', outline:'none', fontSize: 13, background:'transparent' }}/>
          </div>
          <Button variant="secondary" size="sm" icon={<Icons.Upload size={14}/>}>Upload</Button>
        </>}
      />
      <div style={{ padding: 32, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 16 }}>
        {folders.map((f,i) => (
          <Card key={i} hoverable padding={20} style={{ cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-600)' }}>
                <Icons.Docs size={20}/>
              </div>
              <Badge tone={f.tone} size="sm">{f.count} files</Badge>
            </div>
            <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600 }}>{f.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>Updated 3 days ago</div>
          </Card>
        ))}
      </div>
      <div style={{ padding: '0 32px 32px' }}>
        <Card padding={0}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ink-150)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Recently used</div>
            <Button variant="ghost" size="sm">See all</Button>
          </div>
          {[
            {name:'AIR CRE Standard Industrial Multi-Tenant Lease', type:'Lease', mod:'Apr 18'},
            {name:'Exclusive Right to Sell — AIR CRE Form', type:'Listing', mod:'Apr 17'},
            {name:'Commission Distribution Voucher — Lee NB', type:'Voucher', mod:'Apr 12'},
            {name:'Agency Disclosure & Confirmation — CAR', type:'Disclosure', mod:'Apr 11'},
          ].map((d,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'24px 1fr 120px 100px 80px', padding: '12px 20px', alignItems:'center', gap: 12, borderTop: i>0 ? '1px solid var(--ink-150)':'none' }}>
              <Icons.Docs size={16} style={{color:'var(--ink-500)'}}/>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
              <Badge size="sm">{d.type}</Badge>
              <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{d.mod}</div>
              <div style={{ display:'flex', gap: 4, justifyContent:'flex-end' }}>
                <button style={{ padding: 6, background:'transparent', border:'none', color:'var(--ink-600)', cursor:'pointer' }}><Icons.Download size={14}/></button>
                <button style={{ padding: 6, background:'transparent', border:'none', color:'var(--ink-600)', cursor:'pointer' }}><Icons.External size={14}/></button>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── AI assist panel (slide-over) ──
function AiPanel({ open, onClose }: any) {
  return (
    <>
      {open && <div onClick={onClose} style={{ position:'absolute', inset: 0, background:'rgba(10,10,11,.4)', zIndex: 20 }}/>}
      <aside style={{
        position:'absolute', top: 0, right: 0, height: '100%', width: 440,
        background: 'var(--ink-0)', borderLeft: '1px solid var(--ink-200)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .3s var(--ease-out)',
        zIndex: 21, display:'flex', flexDirection:'column',
        boxShadow: open ? 'var(--shadow-xl)' : 'none',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--ink-150)', display:'flex', alignItems:'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ai-gradient)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
            <Icons.Sparkles size={16}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Deal Assist</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Claude · fills fields &amp; extracts from docs</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-500)' }}><Icons.X size={18}/></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24, display:'flex', flexDirection:'column', gap: 16 }}>
          {/* Natural language input */}
          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Describe the deal</div>
            <div style={{ border: '1px solid var(--ai-400)', borderRadius: 10, padding: 14, background: '#FBF8FE', boxShadow: 'var(--ring-ai)' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.5 }}>
                5 year industrial lease on 24,500 SF at 2847 Newport Blvd. Tenant is <b>Relay Robotics</b>. Start June 1, 2026, $1.45/SF NNN, 3% annual steps, 2 months free rent, 6% total commission split 50/50 between me and Marcus.
              </div>
              <div style={{ marginTop: 14, display:'flex', gap: 8, justifyContent:'flex-end' }}>
                <Button variant="ghost" size="sm">Clear</Button>
                <Button variant="ai" size="sm" icon={<Icons.Wand size={13}/>}>Populate form</Button>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--ink-200)' }}/>
            <span style={{ fontSize: 10, color: 'var(--ink-400)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--ink-200)' }}/>
          </div>

          <Button variant="secondary" style={{ width: '100%', justifyContent:'flex-start' }} icon={<Icons.Upload size={14}/>}>
            Upload brochure, LOI or contract
          </Button>
          <Button variant="secondary" style={{ width: '100%', justifyContent:'flex-start' }} icon={<Icons.Sparkles size={14}/>}>
            Smart-complete empty fields
          </Button>

          {/* Suggested actions */}
          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Suggestions</div>
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              {[
                'Pull comparable industrial leases within 3mi',
                'Draft the MLS description from property details',
                'Check commission math',
              ].map((s,i) => (
                <button key={i} style={{
                  display:'flex', alignItems:'center', gap: 10,
                  padding: '10px 12px', textAlign:'left',
                  background: 'var(--ink-50)', border: '1px solid var(--ink-200)',
                  borderRadius: 8, cursor:'pointer', fontSize: 13, color: 'var(--ink-700)',
                }}>
                  <Icons.Sparkles size={12} style={{ color: 'var(--ai-500)' }}/>
                  <span style={{ flex: 1 }}>{s}</span>
                  <Icons.Arrow size={12} style={{ color: 'var(--ink-400)' }}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── My Profile modal — single user only; brokers cannot view each other ──
function ProfileModal({ open, onClose }: any) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'absolute', inset: 0, background:'rgba(10,10,11,.4)', zIndex: 30 }}/>
      <div style={{
        position:'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: '85vh', background:'var(--ink-0)',
        borderRadius: 14, boxShadow: 'var(--shadow-xl)', zIndex: 31,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header banner with avatar */}
        <div style={{ position: 'relative', height: 100, background: 'linear-gradient(120deg, var(--ink-900) 0%, var(--lee-crimson-ink) 100%)' }}>
          <button onClick={onClose} style={{ position:'absolute', top: 14, right: 14, background:'rgba(255,255,255,.12)', border:'none', cursor:'pointer', color:'#fff', width: 28, height: 28, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center' }}><Icons.X size={16}/></button>
          <div style={{ position: 'absolute', top: 16, left: 24, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>My Profile</div>
        </div>

        <div style={{ padding: '0 24px', marginTop: -40, display: 'flex', alignItems:'flex-end', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: 'var(--lee-crimson)', color: '#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 26, fontWeight: 800, border: '4px solid var(--ink-0)', boxShadow: 'var(--shadow-md)' }}>TB</div>
          <div style={{ flex: 1, paddingBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Taylor Barnes</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Senior Broker · Industrial · DRE #02135478</div>
          </div>
          <Badge tone="success" size="sm" icon={<Icons.Check size={10} strokeWidth={3}/>}>Signed in</Badge>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display:'flex', flexDirection:'column', gap: 16 }}>
          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Account</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <Field label="First name" required><Input defaultValue="Taylor"/></Field>
              <Field label="Last name" required><Input defaultValue="Barnes"/></Field>
              <Field label="Email" required span={2}><Input prefix="@" defaultValue="taylor.barnes@lee-associates.com" auto/></Field>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 6, display:'flex', alignItems:'center', gap: 4 }}>
              <Icons.Info size={11}/> Email is tied to your sign-in and can't be changed here. Contact Admin to update.
            </div>
          </div>

          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Broker details <span style={{ color: 'var(--ink-400)', fontWeight: 500, textTransform:'none', letterSpacing: 0 }}>— used to pre-fill forms</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <Field label="Title"><Input defaultValue="Senior Broker"/></Field>
              <Field label="DRE license #" required><Input defaultValue="02135478"/></Field>
              <Field label="Direct phone"><Input defaultValue="714.555.0142"/></Field>
              <Field label="Fax"><Input defaultValue="714.555.0143"/></Field>
            </div>
          </div>

          <div style={{ padding: 14, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 10, display:'flex', alignItems:'center', gap: 12 }}>
            <Icons.Lock size={18} style={{ color: 'var(--ink-500)' }}/>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-600)' }}>
              Your profile is private. Other brokers can't see it — only Admin can view it for deal processing.
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems: 'center', paddingTop: 8 }}>
            <Button variant="ghost" size="sm">Sign out</Button>
            <div style={{ display:'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm">Save changes</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export { AdminScreen, ContractScreen, DocsScreen };
export default CompScreen;



