const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['app.js', 'config', 'controllers', 'middleware', 'models', 'routes', 'services', 'utils', 'validation'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'public/vendor']);

function walk(entryPath, files) {
  if (!fs.existsSync(entryPath)) return;
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    if (entryPath.endsWith('.js')) files.push(entryPath);
    return;
  }

  const rel = path.relative(ROOT, entryPath).replace(/\\/g, '/');
  if (IGNORED_DIRS.has(rel)) return;

  for (const name of fs.readdirSync(entryPath)) {
    walk(path.join(entryPath, name), files);
  }
}

const files = [];
for (const target of TARGET_DIRS) {
  walk(path.join(ROOT, target), files);
}

let hasError = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  if (result.status !== 0) {
    hasError = true;
    process.stderr.write(`\n[syntax-error] ${path.relative(ROOT, file)}\n`);
    if (result.stderr) process.stderr.write(result.stderr.toString());
  }
}

if (hasError) {
  console.error(`\nLint failed: ${files.length} file(s) checked.`);
  process.exit(1);
}

console.log(`Lint passed: ${files.length} JS file(s) checked.`);
