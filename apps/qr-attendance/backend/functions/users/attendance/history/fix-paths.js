const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.log('index.js not found');
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');

// 共有モジュールのパスを修正: ../../../../shared/... を ./shared/... に
content = content.replace(
  /require\((['"])(\.\.\/){4}shared\/([^'"]+)\1\)/g,
  "require('./shared/$3')"
);

// 引用符の不一致も修正（'..." や "...' を修正）
content = content.replace(
  /require\((['"])([^'"]+)(['"])\2\)/g,
  "require('$2')"
);

fs.writeFileSync(indexPath, content, 'utf8');
console.log('Fixed require paths in index.js');
