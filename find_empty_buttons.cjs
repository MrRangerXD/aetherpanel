const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let suspiciousFiles = [];

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    // find button tags
    let buttonRegex = /<button[^>]*>/g;
    let match;
    let issue = false;
    while ((match = buttonRegex.exec(content)) !== null) {
      let tag = match[0];
      if (!tag.includes('onClick') && !tag.includes('type="submit"')) {
        console.log(`Missing onClick: ${filePath} -> ${tag}`);
        issue = true;
      }
    }
  }
});
