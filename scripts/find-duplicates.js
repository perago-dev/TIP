#!/usr/bin/env node
/**
 * find-duplicates.js
 *
 * Scans the repo for JS files with the same filename in multiple directories.
 * In NetSuite support repos, the same script often lives in folders named after
 * developers or environments (Production/, Sandbox/, Grace/, Viel/, etc.).
 * Duplicate files drift over time — this surfaces the ambiguity.
 *
 * Usage: node scripts/find-duplicates.js
 * Exit code 1 if duplicates found (so CI can warn).
 */

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', '__tests__', 'scripts']);

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const root = process.cwd();
const allFiles = walk(root);

// Group by filename (case-insensitive, normalized)
const byName = {};
for (const filePath of allFiles) {
  const name = path.basename(filePath).toLowerCase();
  if (!byName[name]) byName[name] = [];
  byName[name].push(path.relative(root, filePath));
}

const duplicates = Object.entries(byName).filter(([, paths]) => paths.length > 1);

if (duplicates.length === 0) {
  console.log('✓ No duplicate script filenames found.');
  process.exit(0);
}

console.log(`\n⚠ Found ${duplicates.length} duplicate script filename(s):\n`);

for (const [name, paths] of duplicates.sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${name} (${paths.length} copies)`);
  for (const p of paths) {
    console.log(`    • ${p}`);
  }
}

console.log(
  `\nDuplicate scripts may have drifted out of sync. Confirm which copy is canonical before making changes.\n`
);

process.exit(1);
