#!/usr/bin/env node
/**
 * check-mason-version.js
 *
 * Reads the Mason skill version from .claude/skills/mason/SKILL.md and
 * compares it against the MASON_VERSION env var set by CI (sourced from
 * the scout repo's latest release tag or a pinned value in ci.yml).
 *
 * Usage: node scripts/check-mason-version.js
 * Exit code 1 if the installed version doesn't match the expected version.
 */

const fs = require('fs');
const path = require('path');

const SKILL_MD = path.join(process.cwd(), '.claude', 'skills', 'mason', 'SKILL.md');

if (!fs.existsSync(SKILL_MD)) {
  console.error('✗ Mason skill not found at .claude/skills/mason/SKILL.md');
  console.error('  Run the CI template setup to install it.');
  process.exit(1);
}

const content = fs.readFileSync(SKILL_MD, 'utf8');
const match = content.match(/version:\s*["']?(\d+\.\d+\.\d+)["']?/);

if (!match) {
  console.error('✗ Could not parse version from Mason SKILL.md');
  process.exit(1);
}

const installedVersion = match[1];
const expectedVersion = process.env.MASON_VERSION;

if (!expectedVersion) {
  // No expected version set — just report what's installed
  console.log(`Mason ${installedVersion} installed.`);
  process.exit(0);
}

if (installedVersion === expectedVersion) {
  console.log(`✓ Mason ${installedVersion} is current.`);
  process.exit(0);
}

console.log(`⚠ Mason version mismatch:`);
console.log(`  Installed: ${installedVersion}`);
console.log(`  Expected:  ${expectedVersion}`);
console.log(`  Update .claude/skills/mason/ from the scout repo ci-templates/netsuite-suitescript/.claude/skills/mason/`);
process.exit(1);
