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

function runNodeScript(scriptPath, args = [], extraEnv = {}) {
  const full = path.join(ROOT, scriptPath);
  return spawnSync(process.execPath, [full, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
  });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const stamp = nowStamp();
  const seedOut = path.join(EVIDENCE_DIR, `runtime-seed-${stamp}.json`);
  const benchOut = path.join(EVIDENCE_DIR, `bench-p95-${stamp}.json`);
  const concOut = path.join(EVIDENCE_DIR, `concurrency-runtime-${stamp}.json`);
  const verifyOut = path.join(EVIDENCE_DIR, `concurrency-invariants-${stamp}.json`);
  const summaryOut = path.join(EVIDENCE_DIR, `runtime-summary-${stamp}.md`);
  const shouldSeed = String(process.env.EVIDENCE_SEED_RUNTIME || '').toLowerCase() === 'true';
  const seed = shouldSeed ? runNodeScript('scripts/seed-runtime-fixtures.js') : null;
  let seededEnv = {};

  if (seed) {
    writeFile(seedOut, seed.stdout || seed.stderr || '');
    try {
      const parsedSeed = JSON.parse(seed.stdout || '{}');
      if (parsedSeed && parsedSeed.ok && parsedSeed.env) {
        seededEnv = Object.fromEntries(
          Object.entries(parsedSeed.env).map(([key, value]) => [key, String(value)])
        );
        seededEnv.BENCH_COOKIE = seededEnv.BENCH_BUYER_COOKIE || '';
      }
    } catch (err) {
      seededEnv = {};
    }
  }

  const benchArgs = process.env.EVIDENCE_BENCH_ARGS
    ? process.env.EVIDENCE_BENCH_ARGS.split(' ').filter(Boolean)
    : ['--base=http://localhost:5000', '--endpoints=/api/products,/api/chat,/api/orders', '--requests=30', '--concurrency=8', '--timeout=5000'];

  const concArgs = process.env.EVIDENCE_CONC_ARGS
    ? process.env.EVIDENCE_CONC_ARGS.split(' ').filter(Boolean)
    : ['--base=http://localhost:5000', '--endpoint=/api/orders', '--method=POST', '--total=20', '--concurrency=10', '--expect-min-2xx=0', '--expect-max-2xx=1', '--expect-min-conflict=0', '--expect-max-error-rate=0.2'];

  const seededVerifyArgs = seededEnv.CONC_VERIFY_PRODUCT_ID
    ? [`--scenario=order-create`, `--product-id=${seededEnv.CONC_VERIFY_PRODUCT_ID}`, '--max-open-orders=1']
    : [];
  const verifyArgs = process.env.EVIDENCE_VERIFY_ARGS
    ? process.env.EVIDENCE_VERIFY_ARGS.split(' ').filter(Boolean)
    : seededVerifyArgs;

  const bench = runNodeScript('scripts/benchmark-p95.js', benchArgs, seededEnv);
  const conc = runNodeScript('scripts/test-concurrency-runtime.js', concArgs, seededEnv);
  const verify = verifyArgs.length > 0
    ? runNodeScript('scripts/verify-concurrency-invariants.js', verifyArgs, seededEnv)
    : null;

  writeFile(benchOut, bench.stdout || bench.stderr || '');
  writeFile(concOut, conc.stdout || conc.stderr || '');
  if (verify) writeFile(verifyOut, verify.stdout || verify.stderr || '');

  const summary = [
    '# Runtime Evidence Summary',
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Runtime seed exit code: ${seed ? seed.status : 'skipped'}`,
    `- Benchmark exit code: ${bench.status}`,
    `- Concurrency exit code: ${conc.status}`,
    `- Invariant verifier exit code: ${verify ? verify.status : 'skipped'}`,
    `- Runtime seed artifact: \`${seed ? path.relative(ROOT, seedOut) : 'skipped'}\``,
    `- Benchmark artifact: \`${path.relative(ROOT, benchOut)}\``,
    `- Concurrency artifact: \`${path.relative(ROOT, concOut)}\``,
    `- Invariant artifact: \`${verify ? path.relative(ROOT, verifyOut) : 'skipped'}\``,
    '',
    '## Notes',
    '- If benchmark has many `errors` and no samples, ensure app server is running and reachable.',
    '- Set `EVIDENCE_SEED_RUNTIME=true` to create benchmark users/products/orders and pass generated cookies/ids to child scripts.',
    '- For authenticated hot-path benchmarking, prefer `BENCH_ENDPOINT_MATRIX_FILE=docs/perf-endpoint-matrix.example.json` and replace placeholder cookie/token values.',
    '- For meaningful DB-001 validation, pass seeded body/headers via `EVIDENCE_CONC_ARGS`.',
    '- To persist post-run business invariants, pass `EVIDENCE_VERIFY_ARGS` with one of: `--scenario=order-create`, `--scenario=payment-paid`, `--scenario=payout-refund`.',
    '',
  ].join('\n');
  writeFile(summaryOut, summary);

  console.log(JSON.stringify({
    ok: (!seed || seed.status === 0) && bench.status === 0 && conc.status === 0 && (!verify || verify.status === 0),
    seedExitCode: seed ? seed.status : null,
    benchExitCode: bench.status,
    concExitCode: conc.status,
    verifyExitCode: verify ? verify.status : null,
    files: {
      benchmark: path.relative(ROOT, benchOut),
      concurrency: path.relative(ROOT, concOut),
      invariants: verify ? path.relative(ROOT, verifyOut) : null,
      seed: seed ? path.relative(ROOT, seedOut) : null,
      summary: path.relative(ROOT, summaryOut),
    },
  }, null, 2));

  if ((seed && seed.status !== 0) || bench.status !== 0 || conc.status !== 0 || (verify && verify.status !== 0)) process.exit(1);
}

main();
