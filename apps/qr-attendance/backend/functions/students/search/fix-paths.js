const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.log('index.js not found');
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');

// パスを修正: ../../../shared/... を ./shared/... に（3階層）
content = content.replace(
  /require\((['"])(\.\.\/){3}shared\/([^'"]+)\1\)/g,
  "require('./shared/$3')"
);

fs.writeFileSync(indexPath, content, 'utf8');
console.log('Fixed require paths in index.js');
