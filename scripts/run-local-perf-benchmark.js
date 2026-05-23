const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'evidence');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function read(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function resolvePath(filePath, fallback = '') {
  const raw = read(filePath, fallback);
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
}

function runNodeScript(scriptPath, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, scriptPath), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
  });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function parseArgs() {
  const out = {
    baseline: read(process.env.BENCH_BASELINE_ARTIFACT),
    matrixOut: read(process.env.BENCH_ENDPOINT_MATRIX_OUTPUT, 'docs/perf-endpoint-matrix.local.json'),
    currentOut: '',
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--baseline=')) out.baseline = arg.slice('--baseline='.length);
    if (arg.startsWith('--matrix-out=')) out.matrixOut = arg.slice('--matrix-out='.length);
    if (arg.startsWith('--current-out=')) out.currentOut = arg.slice('--current-out='.length);
  });

  return out;
}

function main() {
  const cfg = parseArgs();
  const stamp = nowStamp();
  const matrixOut = resolvePath(cfg.matrixOut, 'docs/perf-endpoint-matrix.local.json');
  const currentOut = resolvePath(cfg.currentOut, `docs/evidence/bench-p95-local-${stamp}.json`);
  const baselinePath = resolvePath(cfg.baseline);
  const summaryOut = path.join(EVIDENCE_DIR, `bench-p95-local-summary-${stamp}.md`);

  const render = runNodeScript('scripts/render-perf-matrix.js', [], {
    BENCH_ENDPOINT_MATRIX_OUTPUT: path.relative(ROOT, matrixOut)
  });
  writeFile(summaryOut, '');
  if (render.status !== 0) {
    writeFile(summaryOut, [
      '# PERF-201 Local Benchmark Summary',
      '',
      `- Date: ${new Date().toISOString()}`,
      '- Step: matrix render',
      `- Exit code: ${render.status}`,
      '',
      '```text',
      (render.stderr || render.stdout || '').trim(),
      '```',
      ''
    ].join('\n'));
    process.stderr.write(render.stderr || render.stdout || 'Matrix render failed\n');
    process.exit(render.status || 1);
  }

  const bench = runNodeScript('scripts/benchmark-p95.js', [
    `--endpoint-matrix-file=${path.relative(ROOT, matrixOut)}`
  ]);
  writeFile(currentOut, bench.stdout || bench.stderr || '');
  if (bench.status !== 0) {
    writeFile(summaryOut, [
      '# PERF-201 Local Benchmark Summary',
      '',
      `- Date: ${new Date().toISOString()}`,
      `- Matrix artifact: \`${path.relative(ROOT, matrixOut)}\``,
      `- Benchmark artifact: \`${path.relative(ROOT, currentOut)}\``,
      `- Benchmark exit code: ${bench.status}`,
      '',
      '## Notes',
      '- App must already be running at `BENCH_BASE_URL`.',
      '- Cookies in `BENCH_BUYER_COOKIE` and `BENCH_ADMIN_COOKIE` must be valid for success-path benchmarking.',
      '',
      '```text',
      (bench.stderr || bench.stdout || '').trim(),
      '```',
      ''
    ].join('\n'));
    process.stderr.write(bench.stderr || bench.stdout || 'Benchmark failed\n');
    process.exit(bench.status || 1);
  }

  const evalArgs = [`--current=${path.relative(ROOT, currentOut)}`];
  if (baselinePath) evalArgs.push(`--baseline=${path.relative(ROOT, baselinePath)}`);
  const budget = runNodeScript('scripts/evaluate-p95-budgets.js', evalArgs);

  const summary = [
    '# PERF-201 Local Benchmark Summary',
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Matrix artifact: \`${path.relative(ROOT, matrixOut)}\``,
    `- Benchmark artifact: \`${path.relative(ROOT, currentOut)}\``,
    `- Baseline artifact: \`${baselinePath ? path.relative(ROOT, baselinePath) : path.relative(ROOT, currentOut)}\``,
    `- Benchmark exit code: ${bench.status}`,
    `- Budget exit code: ${budget.status}`,
    '',
    '## Run notes',
    '- App must already be running at `BENCH_BASE_URL`.',
    '- `BENCH_BUYER_COOKIE` and `BENCH_ADMIN_COOKIE` must be valid before this script is run.',
    '- If no baseline is provided, the current artifact is evaluated against itself for budget reporting only.',
    '',
    '## Budget output',
    '',
    '```json',
    (budget.stdout || budget.stderr || '').trim(),
    '```',
    ''
  ].join('\n');
  writeFile(summaryOut, summary);

  console.log(JSON.stringify({
    ok: bench.status === 0 && budget.status === 0,
    files: {
      matrix: path.relative(ROOT, matrixOut),
      benchmark: path.relative(ROOT, currentOut),
      baseline: baselinePath ? path.relative(ROOT, baselinePath) : path.relative(ROOT, currentOut),
      summary: path.relative(ROOT, summaryOut),
    }
  }, null, 2));

  if (budget.status !== 0) process.exit(budget.status || 1);
}

main();
