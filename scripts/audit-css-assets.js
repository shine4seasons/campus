const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_ROOT = path.join(ROOT, 'public', 'css');
const VIEWS_ROOT = path.join(ROOT, 'views');

let failed = 0;
const warnings = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}${detail ? ` :: ${detail}` : ''}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[WARN] ${message}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function getCssFiles() {
  return walk(CSS_ROOT).filter((filePath) => filePath.endsWith('.css'));
}

function getViewFiles() {
  return walk(VIEWS_ROOT).filter((filePath) => filePath.endsWith('.ejs'));
}

function auditBalancedBraces(cssFiles) {
  const badFiles = [];

  cssFiles.forEach((filePath) => {
    const text = read(filePath);
    let depth = 0;
    let minDepth = 0;
    for (const ch of text) {
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (depth < minDepth) minDepth = depth;
    }
    if (depth !== 0 || minDepth < 0) {
      badFiles.push(`${rel(filePath)} depth=${depth} min=${minDepth}`);
    }
  });

  check('CSS braces are balanced', badFiles.length === 0, badFiles.join('; '));
}

function collectReferencedStyles() {
  const referenced = new Set([
    'shared.css',
    'main.css',
    'base/tokens.css',
    'base/reset.css',
    'base/utilities.css',
    'components/layout.css',
    'components/topbar.css',
    'components/sidebar.css',
    'components/buttons.css',
    'components/forms.css',
    'components/cards.css',
    'components/tables.css',
    'components/badges.css',
    'components/dropdowns.css',
    'components/modals.css',
    'components/toasts.css',
    'components/product-card.css',
  ]);

  const pageStylesPattern = /pageStyles\s*:\s*\[([^\]]*)\]/g;
  const quotedStringPattern = /['"]([^'"]+)['"]/g;

  getViewFiles().forEach((filePath) => {
    const text = read(filePath);
    let match;
    while ((match = pageStylesPattern.exec(text))) {
      const list = match[1];
      let styleMatch;
      while ((styleMatch = quotedStringPattern.exec(list))) {
        referenced.add(`${styleMatch[1].replace(/\.css$/, '')}.css`);
      }
    }
  });

  return referenced;
}

function auditReferences(cssFiles) {
  const cssFileSet = new Set(
    cssFiles.map((filePath) => path.relative(CSS_ROOT, filePath).replace(/\\/g, '/'))
  );
  const referenced = collectReferencedStyles();

  const missing = Array.from(referenced).filter((stylePath) => !cssFileSet.has(stylePath));
  check('All referenced CSS assets exist', missing.length === 0, missing.join(', '));

  const legacyNames = ['checkout-page.css', 'orders-buyer-page.css'];
  const staleLegacyRefs = legacyNames.filter((stylePath) => referenced.has(stylePath));
  check('Deleted legacy CSS names are not referenced', staleLegacyRefs.length === 0, staleLegacyRefs.join(', '));

  const pageLevelUnreferenced = Array.from(cssFileSet)
    .filter((stylePath) => (
      !referenced.has(stylePath)
      && !stylePath.startsWith('base/')
      && !stylePath.startsWith('components/')
      && stylePath !== 'tailwind-input.css'
    ));

  if (pageLevelUnreferenced.length > 0) {
    warn(`Unreferenced page-level CSS files: ${pageLevelUnreferenced.join(', ')}`);
  }
}

function auditHighRiskDuplicateSelectors(cssFiles) {
  const selectorLocations = new Map();
  const highRiskSelectors = new Set([
    '.container',
    '.btn',
    '.btn-primary',
    '.btn-secondary',
    '.btn-ghost',
    '.btn-danger',
    '.card',
    '.premium-card',
    '.main',
    '.sidebar',
    '.toast',
    '.toast.ok',
    '.toast.err',
    '.toast.success',
    '.toast.error',
  ]);

  cssFiles.forEach((filePath) => {
    const lines = read(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/^\s*([.#][^{,;]+?)\s*\{\s*$/);
      if (!match) return;
      const selector = match[1].trim();
      if (!highRiskSelectors.has(selector)) return;
      if (!selectorLocations.has(selector)) selectorLocations.set(selector, []);
      selectorLocations.get(selector).push(`${rel(filePath)}:${index + 1}`);
    });
  });

  selectorLocations.forEach((locations, selector) => {
    if (locations.length > 1) {
      warn(`High-risk duplicate selector ${selector}: ${locations.join(', ')}`);
    }
  });

  check('High-risk duplicate selector audit completed', true);
}

function auditConflictMarkers(cssFiles) {
  const conflictFiles = cssFiles.filter((filePath) => /<<<<<<<|=======|>>>>>>>/.test(read(filePath)));
  check('CSS has no merge conflict markers', conflictFiles.length === 0, conflictFiles.map(rel).join(', '));
}

function main() {
  const cssFiles = getCssFiles();
  check('CSS asset directory exists', fs.existsSync(CSS_ROOT));
  check('CSS files are present', cssFiles.length > 0, 'no CSS files found');
  auditBalancedBraces(cssFiles);
  auditReferences(cssFiles);
  auditConflictMarkers(cssFiles);
  auditHighRiskDuplicateSelectors(cssFiles);

  if (warnings.length > 0) {
    console.warn(`\nCSS audit warnings: ${warnings.length}. These are non-blocking cascade cleanup targets.`);
  }

  if (failed > 0) {
    console.error(`\nCSS asset audit failed: ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log('\nCSS asset audit passed.');
}

main();
