const fs = require('fs');
const path = require('path');

const replacements = {
  'Ã¢â‚¬â€ ': '—',
  'Ã‚Â·': '·',
  'Ã¢â€ â‚¬': '─',
  'Ã¢Å’Ëœ': '⌘',
  'Ãƒâ€”': '×',
  'Ã¢â€ â€™': '→',
  'Ã¢â‚¬Â¦': '…',
  'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ': '—',
  'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·': '·',
  'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ': '—',
  'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢': '→',
  'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ': '—',
  'A,??': '—',
  'AÂ·': '·',
  'AÂ': ' ',
};

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [bad, good] of Object.entries(replacements)) {
        if (content.includes(bad)) {
          content = content.split(bad).join(good);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir('client/src');
