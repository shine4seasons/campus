const http = require('http');
const https = require('https');

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseHeaders(raw) {
  if (!raw) return { 'content-type': 'application/json' };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { 'content-type': 'application/json' };
    }
    return parsed;
  } catch {
    return { 'content-type': 'application/json' };
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    baseUrl: process.env.CONC_BASE_URL || 'http://localhost:5000',
    endpoint: process.env.CONC_ENDPOINT || '/api/orders',
    method: process.env.CONC_METHOD || 'POST',
    total: readPositiveInt(process.env.CONC_TOTAL, 20),
    concurrency: readPositiveInt(process.env.CONC_CONCURRENCY, 10),
    timeoutMs: readPositiveInt(process.env.CONC_TIMEOUT_MS, 5000),
    body: process.env.CONC_BODY || '{}',
    headers: parseHeaders(process.env.CONC_HEADERS),
    expectMin2xx: readNonNegativeNumber(process.env.CONC_EXPECT_MIN_2XX, 0),
    expectMax2xx: readNonNegativeNumber(process.env.CONC_EXPECT_MAX_2XX, 1),
    expectMinConflict: readNonNegativeNumber(process.env.CONC_EXPECT_MIN_CONFLICT, 0),
    expectMaxErrorRate: readNonNegativeNumber(process.env.CONC_EXPECT_MAX_ERROR_RATE, 0.2),
    allowStatuses: String(process.env.CONC_ALLOW_STATUSES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };

  args.forEach((arg) => {
    if (arg.startsWith('--base=')) cfg.baseUrl = arg.slice('--base='.length);
    if (arg.startsWith('--endpoint=')) cfg.endpoint = arg.slice('--endpoint='.length);
    if (arg.startsWith('--method=')) cfg.method = arg.slice('--method='.length).toUpperCase();
    if (arg.startsWith('--total=')) cfg.total = readPositiveInt(arg.slice('--total='.length), cfg.total);
    if (arg.startsWith('--concurrency=')) cfg.concurrency = readPositiveInt(arg.slice('--concurrency='.length), cfg.concurrency);
    if (arg.startsWith('--timeout=')) cfg.timeoutMs = readPositiveInt(arg.slice('--timeout='.length), cfg.timeoutMs);
    if (arg.startsWith('--body=')) cfg.body = arg.slice('--body='.length);
    if (arg.startsWith('--headers=')) cfg.headers = parseHeaders(arg.slice('--headers='.length));
    if (arg.startsWith('--expect-min-2xx=')) cfg.expectMin2xx = readNonNegativeNumber(arg.slice('--expect-min-2xx='.length), cfg.expectMin2xx);
    if (arg.startsWith('--expect-max-2xx=')) cfg.expectMax2xx = readNonNegativeNumber(arg.slice('--expect-max-2xx='.length), cfg.expectMax2xx);
    if (arg.startsWith('--expect-min-conflict=')) cfg.expectMinConflict = readNonNegativeNumber(arg.slice('--expect-min-conflict='.length), cfg.expectMinConflict);
    if (arg.startsWith('--expect-max-error-rate=')) cfg.expectMaxErrorRate = readNonNegativeNumber(arg.slice('--expect-max-error-rate='.length), cfg.expectMaxErrorRate);
    if (arg.startsWith('--allow-statuses=')) {
      cfg.allowStatuses = arg.slice('--allow-statuses='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  });

  return cfg;
}

function requestOnce(cfg) {
  const base = new URL(cfg.baseUrl);
  const isHttps = base.protocol === 'https:';
  const transport = isHttps ? https : http;
  const body = cfg.method === 'GET' ? '' : String(cfg.body || '');
  const headers = Object.assign({}, cfg.headers);
  if (body && !headers['content-length']) headers['content-length'] = Buffer.byteLength(body);

  return new Promise((resolve) => {
    const req = transport.request({
      hostname: base.hostname,
      port: base.port || (isHttps ? 443 : 80),
      path: cfg.endpoint,
      method: cfg.method,
      headers,
      timeout: cfg.timeoutMs,
    }, (res) => {
      res.resume();
      res.on('end', () => {
        resolve({ ok: true, status: res.statusCode || 0 });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, err: 'timeout' });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, err: err.message }));

    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const cfg = parseArgs();
  const statusCounts = {};
  let errors = 0;
  let sent = 0;

  async function worker() {
    while (sent < cfg.total) {
      sent += 1;
      const result = await requestOnce(cfg);
      if (!result.ok) {
        errors += 1;
        continue;
      }
      const k = String(result.status);
      statusCounts[k] = (statusCounts[k] || 0) + 1;
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, cfg.concurrency) }, () => worker()));

  const success2xx = Object.entries(statusCounts)
    .filter(([k]) => k.startsWith('2'))
    .reduce((acc, [, n]) => acc + n, 0);
  const conflicts = (statusCounts['409'] || 0) + (statusCounts['429'] || 0);
  const responded = Object.values(statusCounts).reduce((acc, n) => acc + n, 0);
  const errorRate = cfg.total > 0 ? errors / cfg.total : 1;

  const passMin2xx = success2xx >= cfg.expectMin2xx;
  const pass2xx = success2xx <= cfg.expectMax2xx;
  const passConflict = conflicts >= cfg.expectMinConflict;
  const passErrorRate = errorRate <= cfg.expectMaxErrorRate;
  const passAllowedStatuses = cfg.allowStatuses.length === 0 || Object.keys(statusCounts).every((k) => cfg.allowStatuses.includes(k));

  const report = {
    date: new Date().toISOString(),
    config: cfg,
    statusCounts,
    errors,
    responded,
    errorRate,
    success2xx,
    conflicts,
    pass: passMin2xx && pass2xx && passConflict && passErrorRate && passAllowedStatuses,
  };

  if (responded === 0 || errors >= cfg.total) {
    report.pass = false;
    report.reason = 'unreachable_target_or_all_requests_failed';
  } else if (!passAllowedStatuses) {
    report.reason = 'disallowed_status_observed';
  } else if (!passErrorRate) {
    report.reason = 'error_rate_budget_exceeded';
  } else if (!passMin2xx) {
    report.reason = 'too_few_2xx';
  } else if (!pass2xx) {
    report.reason = 'too_many_2xx';
  } else if (!passConflict) {
    report.reason = 'conflict_expectation_not_met';
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
