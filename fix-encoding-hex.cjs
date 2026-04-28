const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

// Map hex representation of the bad sequences to the good strings
const replacementsHex = {
  'c383c2a2c3a2e2809ac2acc3a2e282acc29d': '—', // Ã¢â‚¬â€ 
  'c383e2809ac3a2e282ace280a0c3a2e2809ac2ac': '—', // ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  'c383e2809ac3a2e282ace280a0c3a2e2809ac593': '–', // ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“
  'c383c2a2c3a2e2809ac2acc3a2e282acc593': '–', // Ã¢â‚¬â€œ
  'c383e2809ac382c2b7': '·', // Ãƒâ€š·
  'c383c2a2c3a2e280a0c2a0c383e280a0c3a2e2809ac2ac': '→', // ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
  'c383c2a2c3a2e280a0c2a0c382c2b3': '↳', // Ã¢â€ Â³
  'c383c2a2c3a2e280a0c2a0c3a2e280a0c2a0': '─', // Ã¢â€ â‚¬
  'c383c2a2c385c2a1c382c2a0': '⚠', // Ã¢Å¡Â 
};

const replacements = {};
for (const [hex, good] of Object.entries(replacementsHex)) {
  replacements[Buffer.from(hex, 'hex').toString('utf8')] = good;
}

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
