const fs = require('fs');

let content = fs.readFileSync('client/src/pages/CompScreen.tsx', 'utf8');

// Exports
content = content.replace(/function CompScreen/g, 'export function CompScreen');
content = content.replace(/function AdminScreen/g, 'export function AdminScreen');
content = content.replace(/function ContractScreen/g, 'export function ContractScreen');
content = content.replace(/function DocsScreen/g, 'export function DocsScreen');
content = content.replace('export default CompScreen;', '');

// Add React state
const oldCompScreenDef = 'export function CompScreen() {\n  return (';
const newCompScreenDef = \export function CompScreen() {
  const [compType, setCompType] = React.useState('lease');
  const compsQuery = trpc.compData.search.useQuery({ compType: compType === 'both' ? 'lease' : compType });
  const comps = compsQuery.data?.results || [];

  return (\;
content = content.replace(oldCompScreenDef, newCompScreenDef);

// Replace comp filters
const oldSegmented = \alue="lease" onChange={()=>{}}\;
const newSegmented = \alue={compType} onChange={setCompType}\;
content = content.replace(oldSegmented, newSegmented);

// Array replacement - use substring matching to avoid regex escaping hell
const staticArray = \            {[
              {addr:'1810 W MacArthur Blvd', tenant:'Arrowhead Logistics', sf:'22,400', rate:'.41', term:'7 yr', closed:'Feb 2026', score:'A'},
              {addr:'3200 Airway Ave', tenant:'Confidential', sf:'31,200', rate:'.38', term:'5 yr', closed:'Jan 2026', score:'A'},
              {addr:'2212 S Hathaway St', tenant:'Pacific Foods', sf:'18,900', rate:'.32', term:'10 yr', closed:'Dec 2025', score:'B'},
              {addr:'650 E Dyer Rd', tenant:'Relay Robotics', sf:'26,700', rate:'.44', term:'5 yr', closed:'Nov 2025', score:'A'},
              {addr:'440 Fischer Ave', tenant:'Harbor Paints', sf:'19,800', rate:'.29', term:'3 yr', closed:'Oct 2025', score:'B'},
              {addr:'1125 Victoria St', tenant:'Vantage 3PL', sf:'35,100', rate:'.33', term:'7 yr', closed:'Sep 2025', score:'B'},
            ].map((r,i) => (\;

const newArray = \            {compsQuery.isLoading && <div style={{ padding: 20 }}>Loading comps...</div>}
            {comps.map((r,i) => (\;
content = content.replace(staticArray, newArray);

const oldRowBody = \                <div>
                  <div style={{ fontWeight: 600 }}>{r.addr}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Costa Mesa · Industrial</div>
                </div>
                <div style={{ color: 'var(--ink-600)' }}>{r.tenant}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-700)' }}>{r.sf}</div>
                <div className="lee-mono" style={{ fontWeight: 600 }}>{r.rate}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-600)' }}>{r.term}</div>
                <div style={{ color: 'var(--ink-600)' }}>{r.closed}</div>
                <div><Badge tone={r.score==='A' ? 'success' : 'neutral'} size="sm">{r.score}</Badge></div>\;

const newRowBody = \                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.city} · {r.propertyType}</div>
                </div>
                <div style={{ color: 'var(--ink-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tenantName || r.buyerName || 'Confidential'}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-700)' }}>{r.sfLeased || r.sfSold || '—'}</div>
                <div className="lee-mono" style={{ fontWeight: 600 }}>{r.rate || r.salePrice || '—'}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-600)' }}>{r.leaseTerm || '—'}</div>
                <div style={{ color: 'var(--ink-600)' }}>{r.leaseDate || r.saleDate || '—'}</div>
                <div><Badge tone="success" size="sm">A</Badge></div>\;
content = content.replace(oldRowBody, newRowBody);

content = content.replace('value="12"', 'value={comps.length}');
content = content.replace('12 comps · sorted by relevance', '{comps.length} comps · sorted by relevance');
content = content.replace('6 of 12 selected', '{comps.length} selected');

fs.writeFileSync('client/src/pages/CompScreen.tsx', content, 'utf8');
console.log('updated');
