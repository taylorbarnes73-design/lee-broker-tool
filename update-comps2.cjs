const fs = require('fs');

let content = fs.readFileSync('client/src/pages/CompScreen.tsx', 'utf8');

const oldDef = 'export function CompScreen() {\r\n  return (';
const newDef = \export function CompScreen() {
  const [compType, setCompType] = React.useState('lease');
  const compsQuery = trpc.compData.search.useQuery({ compType: compType === 'both' ? 'lease' : compType });
  const comps = compsQuery.data?.results || [];

  return (\;

content = content.replace(oldDef, newDef);
content = content.replace('export function CompScreen() {\\n  return (', newDef); // fallback for LF

// Array replace using start and end points
const startIdx = content.indexOf('{[\\r\\n              {addr:\\'1810');
const fallbackStartIdx = content.indexOf('{[\\n              {addr:\\'1810');

const targetStart = startIdx !== -1 ? startIdx : fallbackStartIdx;

if (targetStart !== -1) {
  const endMarker = '].map((r,i) => (\\r\\n';
  const endMarkerFallback = '].map((r,i) => (\\n';
  
  let endIdx = content.indexOf(endMarker, targetStart);
  let len = endMarker.length;
  if (endIdx === -1) {
    endIdx = content.indexOf(endMarkerFallback, targetStart);
    len = endMarkerFallback.length;
  }
  
  if (endIdx !== -1) {
    const newArray = \{compsQuery.isLoading && <div style={{ padding: 20 }}>Loading comps...</div>}
            {comps.map((r,i) => (\\r\\n\;
    content = content.substring(0, targetStart) + newArray + content.substring(endIdx + len);
  }
}

const oldRowBody = \                <div>\\r\\n                  <div style={{ fontWeight: 600 }}>{r.addr}</div>\\r\\n                  <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Costa Mesa Â· Industrial</div>\\r\\n                </div>\\r\\n                <div style={{ color: 'var(--ink-600)' }}>{r.tenant}</div>\\r\\n                <div className="lee-mono" style={{ color: 'var(--ink-700)' }}>{r.sf}</div>\\r\\n                <div className="lee-mono" style={{ fontWeight: 600 }}>{r.rate}</div>\\r\\n                <div className="lee-mono" style={{ color: 'var(--ink-600)' }}>{r.term}</div>\\r\\n                <div style={{ color: 'var(--ink-600)' }}>{r.closed}</div>\\r\\n                <div><Badge tone={r.score==='A' ? 'success' : 'neutral'} size="sm">{r.score}</Badge></div>\;
const oldRowBodyLF = oldRowBody.replace(/\\r\\n/g, '\\n');

const newRowBody = \                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.city} Â· {r.propertyType}</div>
                </div>
                <div style={{ color: 'var(--ink-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tenantName || r.buyerName || 'Confidential'}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-700)' }}>{r.sfLeased || r.sfSold || 'â€”'}</div>
                <div className="lee-mono" style={{ fontWeight: 600 }}>{r.rate || r.salePrice || 'â€”'}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-600)' }}>{r.leaseTerm || 'â€”'}</div>
                <div style={{ color: 'var(--ink-600)' }}>{r.leaseDate || r.saleDate || 'â€”'}</div>
                <div><Badge tone="success" size="sm">A</Badge></div>\;

content = content.replace(oldRowBody, newRowBody).replace(oldRowBodyLF, newRowBody);

fs.writeFileSync('client/src/pages/CompScreen.tsx', content, 'utf8');
