const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const replacements = {
  'Ã¢â‚¬â€ ': '—',
  'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â': '—',
  'Ãƒâ€š·': '·',
  'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“': '–',
  'Ã¢â‚¬â€œ': '–',
  'ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢': '→',
  'Ã¢â€ Â³': '↳',
  'Ã¢â€ â‚¬': '─',
  'Ã¢Å¡Â ': '⚠',
  'â€”': '—',
  'â€“': '–',
  'â†’': '→',
  'Â·': '·',
  'Ã—': '×'
};

walkDir('client/src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [bad, good] of Object.entries(replacements)) {
      if (content.includes(bad)) {
        content = content.split(bad).join(good);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed ' + filePath);
    }
  }
});
