const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'docs', 'evidence', 'fe-201-dom-usage.txt');

function normalize(content) {
  return String(content || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .sort()
    .join('\n');
}

function main() {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error('[fe-201-dom-audit] FAIL: snapshot file is missing:', SNAPSHOT);
    process.exit(1);
  }

  let current = '';
  try {
    current = execFileSync('rg', ['-n', 'innerHTML|outerHTML|insertAdjacentHTML', 'public/js', 'views'], {
      cwd: ROOT,
      encoding: 'utf8'
    });
  } catch (error) {
    if (error && error.status === 1) {
      current = '';
    } else {
      throw error;
    }
  }

  const expected = fs.readFileSync(SNAPSHOT, 'utf8');

  if (normalize(current) !== normalize(expected)) {
    console.error('[fe-201-dom-audit] FAIL: DOM HTML API usage changed. Update the FE-201 audit and classification before merging.');
    process.exit(1);
  }

  console.log('[fe-201-dom-audit] PASS');
}

main();
