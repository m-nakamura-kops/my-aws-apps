#!/usr/bin/env node
/**
 * Lambda関数のrequireパスを修正するスクリプト
 * ../../../shared/... を ./shared/... に変更
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('index.js not found');
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');

// require("../../../shared/...") を require("./shared/...") に置換
content = content.replace(
  /require\(["']\.\.\/\.\.\/\.\.\/shared\//g,
  'require("./shared/'
);

fs.writeFileSync(indexPath, content, 'utf8');
console.log('Fixed require paths in index.js');
