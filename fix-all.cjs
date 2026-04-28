const fs = require('fs');
const path = require('path');

const files = [
  'client/src/pages/ListingScreen.tsx',
  'client/src/pages/SignScreen.tsx',
  'client/src/design/index.jsx'
];

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // The most aggressive string replacements based on double/triple encoding artifacts
  content = content.replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, '—');
  content = content.replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“/g, '–');
  content = content.replace(/Ãƒâ€š·/g, '·');
  content = content.replace(/ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢/g, '→');
  
  content = content.replace(/Ã¢â‚¬â€ /g, '—');
  content = content.replace(/Ã¢â‚¬â€œ/g, '–');
  content = content.replace(/Ã¢â€ Â³/g, '↳');
  content = content.replace(/Ã¢â€ â‚¬/g, '─');
  content = content.replace(/Ã¢Å¡Â /g, '⚠');

  // Some more common ones
  content = content.replace(/â€”/g, '—');
  content = content.replace(/â€“/g, '–');
  content = content.replace(/â†’/g, '→');
  content = content.replace(/Â·/g, '·');
  
  // Just in case, replace actual em-dashes and en-dashes with simple hyphens to avoid any further encoding issues
  content = content.replace(/—/g, '-');
  content = content.replace(/–/g, '-');
  
  // Replace weird dots with simple dots
  content = content.replace(/·/g, '.');
  content = content.replace(/Ã—/g, 'x');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed ' + filePath);
  }
});
