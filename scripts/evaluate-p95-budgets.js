const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'evidence');

const DEFAULT_THRESHOLDS = {
  '/api/products': { p95Ms: 1200, maxErrorRate: 0.2 },
  '/api/chat': { p95Ms: 1500, maxErrorRate: 0.2 },
  '/api/orders': { p95Ms: 1500, maxErrorRate: 0.2 },
  '/api/admin/reports': { p95Ms: 1800, maxErrorRate: 0.2 }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { baseline: '', current: '' };
  args.forEach((arg) => {
    if (arg.startsWith('--baseline=')) out.baseline = arg.slice('--baseline='.length);
    if (arg.startsWith('--current=')) out.current = arg.slice('--current='.length);
  });
  return out;
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function rate(errors, samples) {
  const total = errors + samples;
  if (!total) return 1;
  return errors / total;
}

function evaluateRun(tag, run) {
  const endpointMap = new Map((run.results || []).map((row) => [row.endpoint, row]));
  const checks = Object.entries(DEFAULT_THRESHOLDS).map(([endpoint, limit]) => {
    const row = endpointMap.get(endpoint);
    if (!row) {
      return {
        endpoint,
        pass: false,
        reason: 'missing_endpoint',
        p95: null,
        errorRate: 1,
        budget: limit
      };
    }
    const p95Ok = Number.isFinite(row.p95) && row.p95 <= limit.p95Ms;
    const errorRate = rate(Number(row.errors || 0), Number(row.samples || 0));
    const errorOk = errorRate <= limit.maxErrorRate;
    return {
      endpoint,
      pass: p95Ok && errorOk,
      reason: p95Ok && errorOk ? 'ok' : (!p95Ok ? 'p95_budget_exceeded' : 'error_budget_exceeded'),
      p95: row.p95,
      errorRate,
      budget: limit
    };
  });

  return {
    tag,
    pass: checks.every((c) => c.pass),
    checks
  };
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function writeOutputs(baselinePath, currentPath, baselineEval, currentEval) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonOut = path.join(EVIDENCE_DIR, `perf-201-budget-${stamp}.json`);
  const mdOut = path.join(EVIDENCE_DIR, `perf-201-budget-${stamp}.md`);

  const payload = {
    date: new Date().toISOString(),
    baselinePath,
    currentPath,
    baseline: baselineEval,
    current: currentEval
  };
  fs.writeFileSync(jsonOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# PERF-201 P95 Budget Evaluation',
    '',
    `- Date: ${payload.date}`,
    `- Baseline artifact: \`${path.relative(ROOT, baselinePath)}\``,
    `- Current artifact: \`${path.relative(ROOT, currentPath)}\``,
    `- Baseline pass: ${baselineEval.pass}`,
    `- Current pass: ${currentEval.pass}`,
    '',
    '## Current Check Results',
    ''
  ];
  currentEval.checks.forEach((c) => {
    lines.push(`- ${c.endpoint}: pass=${c.pass}, p95=${c.p95}, errorRate=${formatPct(c.errorRate)}, budget(p95<=${c.budget.p95Ms}, error<=${formatPct(c.budget.maxErrorRate)})`);
  });
  fs.writeFileSync(mdOut, `${lines.join('\n')}\n`, 'utf8');

  return {
    jsonOut: path.relative(ROOT, jsonOut),
    mdOut: path.relative(ROOT, mdOut)
  };
}

function main() {
  const args = parseArgs();
  if (!args.current) {
    console.error('Usage: node scripts/evaluate-p95-budgets.js --current=<path> [--baseline=<path>]');
    process.exit(1);
  }

  const currentPath = path.resolve(ROOT, args.current);
  const baselinePath = args.baseline ? path.resolve(ROOT, args.baseline) : currentPath;

  const baselineRun = loadJson(baselinePath);
  const currentRun = loadJson(currentPath);
  const baselineEval = evaluateRun('baseline', baselineRun);
  const currentEval = evaluateRun('current', currentRun);
  const files = writeOutputs(baselinePath, currentPath, baselineEval, currentEval);

  console.log(JSON.stringify({
    ok: baselineEval.pass && currentEval.pass,
    baselinePass: baselineEval.pass,
    currentPass: currentEval.pass,
    files
  }, null, 2));

  if (!currentEval.pass) process.exit(1);
}

main();
