#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const VERSION = process.env.ASSET_VERSION || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

const filesToStamp = [
  path.join(PUBLIC_DIR, 'index.html'),
  path.join(PUBLIC_DIR, 'login.html'),
];

for (const file of filesToStamp) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const updated = content.replace(/__ASSET_VERSION__/g, VERSION);
    if (updated !== content) {
      fs.writeFileSync(file, updated, 'utf8');
      console.log(`[stamp-assets] Stamped ${path.relative(ROOT, file)} with version ${VERSION}`);
    } else {
      console.log(`[stamp-assets] No placeholders found in ${path.relative(ROOT, file)}`);
    }
  } catch (err) {
    console.error(`[stamp-assets] Failed to stamp ${file}:`, err.message);
    process.exitCode = 1;
  }
}
