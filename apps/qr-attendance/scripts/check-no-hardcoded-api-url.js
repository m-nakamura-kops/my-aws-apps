#!/usr/bin/env node
/**
 * フロントと API 関連ソースに、削除済みになり得る API Gateway ホストの直書きが
 * 戻っていないかを確認する。
 *
 * 許可するもの:
 * - process.env.NEXT_PUBLIC_API_URL
 * - process.env.API_ID から組み立てる `https://${apiId}.execute-api.${region}.amazonaws.com`
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const scanRoots = [
  path.join(root, 'frontend/src'),
  path.join(root, 'backend/functions'),
];

const forbidden = [
  {
    name: 'execute-api host literal',
    re: /execute-api\.[a-z0-9-]+\.amazonaws\.com/,
  },
  {
    name: 'API_ID fallback literal',
    re: /API_ID\s*\|\|\s*['"][a-z0-9]+['"]/,
  },
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) out.push(p);
  }
}

const files = [];
for (const dir of scanRoots) walk(dir, files);

const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.re.test(text)) {
      hits.push(`${path.relative(root, file)}: ${rule.name}`);
    }
  }
}

if (hits.length) {
  console.error('Hardcoded API endpoint found:');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`OK: no hardcoded API Gateway host in ${files.length} files`);
