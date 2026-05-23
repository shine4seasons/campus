const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'evidence');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function runNodeScript(scriptPath, args = []) {
  const full = path.join(ROOT, scriptPath);
  return spawnSync(process.execPath, [full, ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const stamp = nowStamp();
  const benchOut = path.join(EVIDENCE_DIR, `bench-p95-${stamp}.json`);
  const concOut = path.join(EVIDENCE_DIR, `concurrency-runtime-${stamp}.json`);
  const summaryOut = path.join(EVIDENCE_DIR, `runtime-summary-${stamp}.md`);

  const benchArgs = process.env.EVIDENCE_BENCH_ARGS
    ? process.env.EVIDENCE_BENCH_ARGS.split(' ').filter(Boolean)
    : ['--base=http://localhost:5000', '--endpoints=/api/products,/api/chat,/api/orders', '--requests=30', '--concurrency=8', '--timeout=5000'];

  const concArgs = process.env.EVIDENCE_CONC_ARGS
    ? process.env.EVIDENCE_CONC_ARGS.split(' ').filter(Boolean)
    : ['--base=http://localhost:5000', '--endpoint=/api/orders', '--method=POST', '--total=20', '--concurrency=10', '--expect-min-2xx=0', '--expect-max-2xx=1', '--expect-min-conflict=0', '--expect-max-error-rate=0.2'];

  const bench = runNodeScript('scripts/benchmark-p95.js', benchArgs);
  const conc = runNodeScript('scripts/test-concurrency-runtime.js', concArgs);

  writeFile(benchOut, bench.stdout || bench.stderr || '');
  writeFile(concOut, conc.stdout || conc.stderr || '');

  const summary = [
    '# Runtime Evidence Summary',
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Benchmark exit code: ${bench.status}`,
    `- Concurrency exit code: ${conc.status}`,
    `- Benchmark artifact: \`${path.relative(ROOT, benchOut)}\``,
    `- Concurrency artifact: \`${path.relative(ROOT, concOut)}\``,
    '',
    '## Notes',
    '- If benchmark has many `errors` and no samples, ensure app server is running and reachable.',
    '- For meaningful DB-001 validation, pass seeded body/headers via `EVIDENCE_CONC_ARGS`.',
    '',
  ].join('\n');
  writeFile(summaryOut, summary);

  console.log(JSON.stringify({
    ok: bench.status === 0 && conc.status === 0,
    benchExitCode: bench.status,
    concExitCode: conc.status,
    files: {
      benchmark: path.relative(ROOT, benchOut),
      concurrency: path.relative(ROOT, concOut),
      summary: path.relative(ROOT, summaryOut),
    },
  }, null, 2));

  if (bench.status !== 0 || conc.status !== 0) process.exit(1);
}

main();
