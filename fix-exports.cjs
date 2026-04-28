const fs = require('fs');
let content = fs.readFileSync('client/src/pages/CompScreen.tsx', 'utf8');
content = content.replace(/export export function/g, 'export function');
fs.writeFileSync('client/src/pages/CompScreen.tsx', content, 'utf8');
