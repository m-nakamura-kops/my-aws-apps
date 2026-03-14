const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.log('index.js not found');
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');

// パスを修正: ../../../../shared/... を ./shared/... に
content = content.replace(
  /require\(['"]\.\.\/\.\.\/\.\.\/\.\.\/shared\/([^'"]+)['"]\)/g,
  "require('./shared/$1')"
);

fs.writeFileSync(indexPath, content, 'utf8');
console.log('Fixed require paths in index.js');
