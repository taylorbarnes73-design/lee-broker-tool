import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Icons, PageHeader, StepProgress, Segmented, Button, Card, Badge, 
  Input, Select, StepCard, Field, Toggle 
} from '../design/index.jsx';
/* Lee Broker Tool — Listing Entry screen */

export default function ListingEntryScreen() {
  const [subTab, setSubTab] = useState('add');
  const [propType, setPropType] = useState('Industrial');
  const [dealType, setDealType] = useState('Lease');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [aiExtracted, setAiExtracted] = useState<Record<string, string> | null>(null);
  const submitMutation = trpc.submissions.create.useMutation({
    onSuccess: () => toast.success("Listing submitted successfully!"),
    onError: (err) => toast.error("Error: " + err.message),
  });
  const scrapeBrochure = trpc.aiAssist.scrapeBrochure.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setAiExtracted(data.fields);
        toast.success(`Deal Assist extracted ${data.fieldCount} fields`);
      } else {
        toast.error(`Deal Assist failed: ${('error' in data && data.error) || 'unknown error'}`);
      }
    },
    onError: (err) => toast.error(`Deal Assist error: ${err.message}`),
  });
  // Convert the selected file to a data URL the server can fetch, then call scrapeBrochure.
  // This avoids needing a separate S3 upload round-trip.
  async function handleBrochureFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const mimeType = file.type.startsWith('image/')
        ? (file.type as 'image/jpeg' | 'image/png' | 'image/webp')
        : 'application/pdf';
      scrapeBrochure.mutate({ fileUrl: dataUrl, mimeType });
    };
    reader.onerror = () => toast.error('Could not read file');
    reader.readAsDataURL(file);
  }

  const handleSubmit = async () => {
    await submitMutation.mutateAsync({
      type: 'listing',
      propertyType: propType,
      transactionType: dealType,
      address: '2847 Newport Blvd',
      city: 'Costa Mesa',
      state: 'CA',
      zip: '92627',
      subTab,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="New Listing"
        description="Enter a new listing and submit to MLS. Upload a brochure to let Deal Assist fill the form for you."
        right={<>
          <Segmented
            options={[{value:'add', label:'Add Listing'}, {value:'modify', label:'Modify Listing'}]}
            value={subTab} onChange={setSubTab} size="sm"
          />
          <Button variant="ghost" size="sm" icon={<Icons.Help size={14}/>}>Help</Button>
        </>}
      >
        <StepProgress step={3} total={7} percent={38}/>
      </PageHeader>

      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI brochure upload — ambient but prominent */}
          <Card padding={0} style={{
            background: 'linear-gradient(120deg, #FBF8FE 0%, #FEF4F6 100%)',
            border: '1px solid rgba(139,95,240,.2)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'var(--ai-gradient)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
                boxShadow: '0 6px 18px rgba(139,95,240,.3)',
              }}>
                <Icons.Wand size={22}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Skip the typing — drop a brochure
                  <Badge tone="ai" size="sm" icon={<Icons.Sparkles size={10}/>}>AI</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 2 }}>
                  We'll extract address, SF, rate, term, photos and pre-fill this form in ~8 seconds.
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleBrochureFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                variant="ai"
                size="sm"
                icon={<Icons.Upload size={14}/>}
                onClick={() => fileInputRef.current?.click()}
                disabled={scrapeBrochure.isPending}
              >
                {scrapeBrochure.isPending ? 'Extracting…' : 'Upload brochure'}
              </Button>
            </div>
            {aiExtracted && Object.keys(aiExtracted).length > 0 && (
              <div style={{
                borderTop: '1px solid rgba(139,95,240,.2)',
                padding: '12px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
                fontSize: 12,
              }}>
                {Object.entries(aiExtracted).slice(0, 12).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: 'var(--ink-500)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                    <div style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Step 1 — complete */}
          <StepCard
            step={1} total={7} status="complete"
            title="Transaction type"
            summary="Lease · Industrial · 2,847 Newport Blvd, Costa Mesa CA 92627"
          />

          {/* Step 2 — complete */}
          <StepCard
            step={2} total={7} status="complete"
            title="Property details"
            summary="24,500 SF · Clear height 28' · 4 DH doors · Built 2005"
          />

          {/* Step 3 — active */}
          <StepCard
            step={3} total={7} status="active"
            title="Listing terms"
            subtitle="Rate, term, commission and what's shown to MLS."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              <Field label="Asking rate" required aiFilled>
                <Input prefix="$" suffix="/ SF / Mo" defaultValue="1.45"/>
              </Field>
              <Field label="Term">
                <Select value="5" onChange={()=>{}} options={[
                  {value:'neg', label:'Negotiable'},
                  {value:'3', label:'3 years'},
                  {value:'5', label:'5 years'},
                  {value:'7', label:'7 years'},
                  {value:'10', label:'10 years'},
                ]}/>
              </Field>
              <Field label="NNN / Expense type" required>
                <Select value="NNN" onChange={()=>{}} options={['NNN','Gross','Modified Gross','Industrial Gross']}/>
              </Field>
              <Field label="Available">
                <Input prefix={<Icons.Calendar size={14}/>} defaultValue="June 1, 2026"/>
              </Field>

              <Field label="Commission — listing side" required span={1}>
                <Input suffix="%" defaultValue="3.00"/>
              </Field>
              <Field label="Commission — procuring" required span={1}>
                <Input suffix="%" defaultValue="3.00"/>
              </Field>
              <Field label="Total consideration" span={2}>
                <Input auto value="$2,132,250.00" prefix="$" style={{fontFamily:'var(--font-mono)'}}/>
              </Field>
            </div>

            {/* MLS visibility toggle */}
            <div style={{
              marginTop: 24, padding: 16,
              background: 'var(--ink-50)', border: '1px solid var(--ink-200)',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--lee-slate-wash)', color: 'var(--lee-slate)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icons.Eye size={18}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>Reveal prices to MLS</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1 }}>Off hides asking rate on CoStar &amp; AIR feeds; agents will "Call for info".</div>
              </div>
              <Toggle on={true}/>
            </div>

            {/* Footer actions */}
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="ghost" icon={<Icons.Chevron size={14} style={{transform:'rotate(180deg)'}}/>}>Back</Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary">Save draft</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={submitMutation.isPending} iconRight={<Icons.Arrow size={14}/>}>{submitMutation.isPending ? "Saving..." : "Continue to agents"}</Button>
              </div>
            </div>
          </StepCard>

          {/* Remaining locked */}
          <StepCard step={4} total={7} status="locked" title="Agents &amp; commission split"/>
          <StepCard step={5} total={7} status="locked" title="Property description &amp; media"/>
          <StepCard step={6} total={7} status="locked" title="Upload agreements"/>
          <StepCard step={7} total={7} status="locked" title="Review &amp; submit to MLS"/>
        </div>

        {/* Right rail */}
        <ListingSidebar/>
      </div>
    </div>
  );
}

function ListingSidebar() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 16, position: 'sticky', top: 24 }}>
      {/* Deal summary */}
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Deal at a glance</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>
          2847 Newport Blvd
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Costa Mesa, CA 92627</div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Metric label="Size" value="24,500" unit="SF"/>
          <Metric label="Rate" value="$1.45" unit="/SF/Mo NNN"/>
          <Metric label="Term" value="5" unit="years"/>
          <Metric label="Available" value="Jun 1"/>
        </div>

        <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--ink-150)', borderBottom: '1px solid var(--ink-150)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Est. total consideration</span>
            <span className="lee-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>$2,132,250</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Est. commission</span>
            <span className="lee-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--lee-crimson)' }}>$127,935</span>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SummaryRow ok label="Property details"/>
          <SummaryRow ok label="Transaction"/>
          <SummaryRow current label="Terms"/>
          <SummaryRow label="Agents"/>
          <SummaryRow label="Media"/>
          <SummaryRow label="Agreements"/>
        </div>
      </Card>

      {/* AI insights */}
      <Card padding={18} style={{ background: '#FBF8FE', border: '1px solid rgba(139,95,240,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icons.Sparkles size={14} style={{ color: 'var(--ai-500)' }}/>
          <div className="lee-eyebrow" style={{ color: 'var(--ai-500)' }}>Market context</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.5 }}>
          Your asking rate is <b>6% above</b> the median for industrial space in Costa Mesa (last 90 days: $1.37/SF/Mo NNN).
        </div>
        <button style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--ai-500)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          See 12 comparable deals →
        </button>
      </Card>
    </div>
  );
}

function Metric({ label, value, unit }: any) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-500)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="lee-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{unit}</span>}
      </div>
    </div>
  );
}

function SummaryRow({ ok, current, label }: { ok?: boolean; current?: boolean; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <div style={{
        width: 14, height: 14, borderRadius: 999,
        background: ok ? 'var(--ok-500)' : (current ? 'var(--lee-crimson)' : 'var(--ink-200)'),
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {ok && <Icons.Check size={10} strokeWidth={3}/>}
        {current && <span style={{ width: 4, height: 4, borderRadius: 999, background: '#fff' }}/>}
      </div>
      <span style={{
        color: ok ? 'var(--ink-500)' : (current ? 'var(--ink-900)' : 'var(--ink-500)'),
        fontWeight: current ? 600 : 500,
        textDecoration: ok ? 'line-through' : 'none',
        textDecorationColor: 'var(--ink-300)',
      }}>{label}</span>
    </div>
  );
}





