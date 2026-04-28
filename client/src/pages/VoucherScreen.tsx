import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { 
  Icons, PageHeader, StepProgress, Segmented, Button, Card, Badge, 
  Input, Select, StepCard, Field, Toggle, Metric, SummaryRow, FormSection, FormRow 
} from '../design/index.jsx';

// Missing primitives
function SectionHeader({ eyebrow, title, description, right }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        {eyebrow && <div className="lee-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)' }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 2 }}>{description}</div>}
      </div>
      {right}
    </div>
  );
}
/* Lee Broker Tool â€” Commission Voucher screen */

export default function VoucherScreen() {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState('add');


  const [dateOfLease, setDateOfLease] = useState("04/18/2026");
  const [lessor, setLessor] = useState("Irvine Company");
  const [lessee, setLessee] = useState("Pacific Logistics");
  const [totalConsideration, setTotalConsideration] = useState("2,132,250.00");
  const [totalCommission, setTotalCommission] = useState("127,935.00");
  const [dueToLee, setDueToLee] = useState("63,967.50");

  const submitMutation = trpc.submissions.submit.useMutation({
    onSuccess: () => toast.success("Voucher submitted successfully!"),
    onError: (err) => toast.error("Error: " + err.message),
  });

  const handleSubmit = async () => {
    await submitMutation.mutateAsync({
      formType: 'voucher',
      payload: {
        dateOfLease, lessor, lessee, totalConsideration, totalCommission, dueToLee,
        address: "2847 Newport Blvd, Costa Mesa CA 92627"
      }
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="Commission Voucher"
        description="Submit a completed deal for commission processing and Dealius submission."
        right={<>
          <Badge tone="slate" size="md">Draft Â· Last saved 2 min ago</Badge>
          <Button variant="ghost" size="sm" icon={<Icons.Send size={14}/>}>Send to admin</Button>
        </>}
      >
        <StepProgress step={5} total={8} percent={62}/>
      </PageHeader>

      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step summary chips */}
          <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
            {['Property','Parties','Financials','Commission','Rent schedule'].map(l => (
              <Badge key={l} tone="success" size="md" icon={<Icons.Check size={11} strokeWidth={3}/>}>{l}</Badge>
            ))}
            <Badge tone="crimson" size="md">Rent schedule Â· in progress</Badge>
            <Badge size="md">Invoicing</Badge>
            <Badge size="md">Documents</Badge>
          </div>

          {/* Commission distribution */}
          <Card>
            <SectionHeader
              eyebrow="Step 4"
              title="Commission distribution"
              description="Allocate the gross commission across internal and outside agents."
              right={<Button variant="ghost" size="sm" icon={<Icons.Plus size={14}/>}>Add agent</Button>}
            />
            <CommissionTable/>
          </Card>

          {/* Rent schedule */}
          <Card>
            <SectionHeader
              eyebrow="Step 5 Â· Active"
              title="Monthly rent schedule"
              description="Step-ups, free rent and base rent across the term."
              right={<Segmented size="sm" options={['Monthly','Annual']} value="Monthly" onChange={()=>{}}/>}
            />
            <RentTable/>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="ghost" icon={<Icons.Chevron size={14} style={{transform:'rotate(180deg)'}}/>}>Back</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary">Save draft</Button>
              <Button variant="primary" iconRight={<Icons.Arrow size={14}/>}>Continue to invoicing</Button>
            </div>
          </div>
        </div>

        <VoucherRail/>
      </div>
    </div>
  );
}

function CommissionTable() {
  const { user } = useAuth();
  const rows = [
    {name: user?.name || 'Broker', side:'Procuring', pct: 40, chipTone:'success', split:'Internal'},
    {name:'Marcus Reeves', side:'Listing', pct: 35, chipTone:'crimson', split:'Internal'},
    {name:'Janice Lee (CBRE)', side:'Referral', pct: 15, chipTone:'warn', split:'Outside'},
    {name:'House override', side:'Both', pct: 10, chipTone:'ai', split:'House'},
  ];
  const total = rows.reduce((s,r)=>s+r.pct,0);
  const ok = total === 100;
  return (
    <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns: '1.4fr 1fr .8fr 1fr 40px', padding: '10px 16px', background: 'var(--ink-50)', fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <div>Agent</div><div>Side</div><div>Split</div><div style={{textAlign:'right'}}>% of commission</div><div/>
      </div>
      {rows.map((r,i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns: '1.4fr 1fr .8fr 1fr 40px', padding: '12px 16px', alignItems:'center', borderTop: '1px solid var(--ink-150)', background: 'var(--ink-0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink-100)', color:'var(--ink-600)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 700 }}>
              {r.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{r.split}</div>
            </div>
          </div>
          <div><Badge tone={r.chipTone} size="sm">{r.side}</Badge></div>
          <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{r.split}</div>
          <div style={{ textAlign: 'right' }}>
            <span className="lee-mono" style={{ fontSize: 14, fontWeight: 700 }}>{r.pct}%</span>
            <div className="lee-mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>${(127935 * r.pct/100).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>
          <button style={{ background:'transparent', border:'none', color:'var(--ink-400)', cursor:'pointer' }}><Icons.MoreV size={14}/></button>
        </div>
      ))}
      <div style={{
        display:'grid', gridTemplateColumns: '1.4fr 1fr .8fr 1fr 40px',
        padding: '14px 16px', background: ok ? 'var(--ok-100)' : 'var(--err-100)',
        borderTop: '2px solid var(--ink-200)', alignItems:'center',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform:'uppercase', color: 'var(--ink-700)' }}>Total</div>
        <div/><div/>
        <div style={{ textAlign:'right' }}>
          <span className="lee-mono" style={{ fontSize: 16, fontWeight: 700, color: ok ? 'var(--ok-600)' : 'var(--err-600)' }}>{total}%</span>
        </div>
        <div style={{ color: ok ? 'var(--ok-500)' : 'var(--err-600)' }}>{ok ? <Icons.Check size={16} strokeWidth={2.4}/> : <Icons.Warn size={16}/>}</div>
      </div>
    </div>
  );
}

function RentTable() {
  const rows = [
    {mo:'Mo 1-2',   months:'Apr 2026 â€“ May 2026', baseRate: 0,    sf: 24500, monthly: 0, note:'Free rent'},
    {mo:'Mo 3-12',  months:'Jun 2026 â€“ Mar 2027', baseRate: 1.45, sf: 24500, monthly: 35525},
    {mo:'Mo 13-24', months:'Apr 2027 â€“ Mar 2028', baseRate: 1.50, sf: 24500, monthly: 36750},
    {mo:'Mo 25-36', months:'Apr 2028 â€“ Mar 2029', baseRate: 1.55, sf: 24500, monthly: 37975},
    {mo:'Mo 37-48', months:'Apr 2029 â€“ Mar 2030', baseRate: 1.60, sf: 24500, monthly: 39200},
    {mo:'Mo 49-60', months:'Apr 2030 â€“ Mar 2031', baseRate: 1.66, sf: 24500, monthly: 40670},
  ];
  const total = rows.reduce((s,r)=>s+r.monthly*parseInt(r.mo.match(/-(\d+)/)?.[1]||1) - (r.monthly * parseInt(r.mo.match(/Mo (\d+)/)?.[1]||1) - r.monthly), 2132250);
  return (
    <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns: '1fr 1.6fr 1fr 1fr 1fr', padding: '10px 16px', background: 'var(--ink-50)', fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <div>Period</div><div>Dates</div><div style={{textAlign:'right'}}>Rate/SF/Mo</div><div style={{textAlign:'right'}}>SF</div><div style={{textAlign:'right'}}>Monthly</div>
      </div>
      {rows.map((r,i) => {
        const free = r.baseRate === 0;
        return (
          <div key={i} style={{
            display:'grid', gridTemplateColumns: '1fr 1.6fr 1fr 1fr 1fr',
            padding: '10px 16px', alignItems:'center',
            borderTop: '1px solid var(--ink-150)',
            background: free ? 'var(--warn-100)' : (i%2===0 ? 'var(--ink-0)' : 'var(--ink-50)'),
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 600 }}>{r.mo}{free && <div style={{ fontSize: 10, color:'var(--warn-600)', fontWeight: 700, letterSpacing: '0.08em' }}>FREE RENT</div>}</div>
            <div style={{ color: 'var(--ink-600)', fontSize: 12 }}>{r.months}</div>
            <div className="lee-mono" style={{ textAlign:'right' }}>${r.baseRate.toFixed(2)}</div>
            <div className="lee-mono" style={{ textAlign:'right', color: 'var(--ink-500)' }}>{r.sf.toLocaleString()}</div>
            <div className="lee-mono" style={{ textAlign:'right', fontWeight: 700 }}>${r.monthly.toLocaleString()}</div>
          </div>
        );
      })}
      <div style={{ display:'grid', gridTemplateColumns: '1fr 1.6fr 1fr 1fr 1fr', padding: '14px 16px', background: 'var(--ink-900)', color: '#fff', borderTop: '2px solid var(--ink-900)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)' }}>Total consideration</div>
        <div/><div/><div/>
        <div className="lee-mono" style={{ textAlign:'right', fontSize: 18, fontWeight: 700 }}>$2,132,250</div>
      </div>
    </div>
  );
}

function VoucherRail() {
  return (
    <div style={{ display:'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Invoice</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Invoice to: Landlord</div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Pacific Holdings LLC Â· Ref LD-4491</div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RowKV k="Gross commission" v="$127,935.00"/>
          <RowKV k="Internal split" v="$95,951.25" sub/>
          <RowKV k="Outside/referral" v="$19,190.25" sub/>
          <RowKV k="House" v="$12,793.50" sub/>
          <div style={{ height: 1, background: 'var(--ink-150)', margin: '4px 0' }}/>
          <RowKV k="Total invoice" v="$127,935.00" big/>
        </div>

        <div style={{ marginTop: 16, display:'flex', flexDirection:'column', gap: 8 }}>
          <Button variant="primary" size="sm" style={{ width: '100%' }} icon={<Icons.Send size={14}/>}>Submit to Dealius</Button>
          <Button variant="secondary" size="sm" style={{ width: '100%' }} icon={<Icons.Download size={14}/>}>Download voucher PDF</Button>
        </div>
      </Card>

      <Card padding={18} style={{ background: 'var(--ink-900)', color: '#fff', border: '1px solid var(--ink-900)' }}>
        <div className="lee-eyebrow" style={{ color: 'var(--ink-400)', marginBottom: 6 }}>Post-submission</div>
        <div style={{ fontSize: 13, color: 'var(--ink-200)', marginBottom: 12, lineHeight: 1.5 }}>
          After Dealius receives this voucher, we'll queue:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TodoRow icon={<Icons.Sign size={14}/>} label="Remove signs from property"/>
          <TodoRow icon={<Icons.Listing size={14}/>} label="Notify MLS of closed status"/>
          <TodoRow icon={<Icons.Docs size={14}/>} label="Archive closed deal to Dropbox"/>
        </div>
      </Card>
    </div>
  );
}

function RowKV({ k, v, sub, big }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: sub ? 11 : 12, color: sub ? 'var(--ink-500)' : 'var(--ink-600)' }}>{sub && '  â†³ '}{k}</span>
      <span className="lee-mono" style={{ fontSize: big ? 18 : 13, fontWeight: big ? 700 : (sub ? 500 : 600), color: big ? 'var(--ink-900)' : 'var(--ink-700)' }}>{v}</span>
    </div>
  );
}
function TodoRow({ icon, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-300)' }}>{icon}</span>
      <span style={{ color: '#fff', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Queued</span>
    </div>
  );
}







