const http = require('http');

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseHeadersJson(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const headers = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    });
    return headers;
  } catch {
    return {};
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    baseUrl: process.env.BENCH_BASE_URL || 'http://localhost:5000',
    endpoints: (process.env.BENCH_ENDPOINTS || '/api/products,/api/chat,/api/orders,/api/admin/reports')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    requests: readPositiveInt(process.env.BENCH_REQUESTS, 25),
    concurrency: readPositiveInt(process.env.BENCH_CONCURRENCY, 5),
    timeoutMs: readPositiveInt(process.env.BENCH_TIMEOUT_MS, 5000),
    warmup: readPositiveInt(process.env.BENCH_WARMUP_REQUESTS, 3),
    method: String(process.env.BENCH_METHOD || 'GET').toUpperCase(),
    headers: parseHeadersJson(process.env.BENCH_HEADERS_JSON),
  };
  if (process.env.BENCH_AUTH_BEARER) {
    out.headers.authorization = `Bearer ${process.env.BENCH_AUTH_BEARER}`;
  }
  if (process.env.BENCH_COOKIE) {
    out.headers.cookie = process.env.BENCH_COOKIE;
  }

  args.forEach((arg) => {
    if (arg.startsWith('--base=')) out.baseUrl = arg.slice('--base='.length);
    if (arg.startsWith('--requests=')) out.requests = readPositiveInt(arg.slice('--requests='.length), out.requests);
    if (arg.startsWith('--concurrency=')) out.concurrency = readPositiveInt(arg.slice('--concurrency='.length), out.concurrency);
    if (arg.startsWith('--timeout=')) out.timeoutMs = readPositiveInt(arg.slice('--timeout='.length), out.timeoutMs);
    if (arg.startsWith('--warmup=')) out.warmup = readPositiveInt(arg.slice('--warmup='.length), out.warmup);
    if (arg.startsWith('--method=')) out.method = String(arg.slice('--method='.length) || out.method).toUpperCase();
    if (arg.startsWith('--endpoints=')) {
      out.endpoints = arg
        .slice('--endpoints='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (arg.startsWith('--header=')) {
      const raw = arg.slice('--header='.length);
      const idx = raw.indexOf(':');
      if (idx > 0) {
        const name = raw.slice(0, idx).trim().toLowerCase();
        const value = raw.slice(idx + 1).trim();
        if (name && value) out.headers[name] = value;
      }
    }
    if (arg.startsWith('--cookie=')) {
      out.headers.cookie = arg.slice('--cookie='.length);
    }
  });

  return out;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function requestOnce(url, cfg) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(url, {
      method: cfg.method || 'GET',
      timeout: cfg.timeoutMs,
      headers: cfg.headers || {}
    }, (res) => {
      res.resume();
      res.on('end', () => {
        resolve({ ok: true, status: res.statusCode, ms: Date.now() - start });
      });
    });
    req.end();
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, ms: Date.now() - start, err: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, status: 0, ms: Date.now() - start, err: err.message });
    });
  });
}

async function runEndpoint(endpoint, cfg) {
  const url = `${cfg.baseUrl}${endpoint}`;
  const latencies = [];
  let errors = 0;
  let sent = 0;
  const statusCounts = {};

  for (let i = 0; i < cfg.warmup; i += 1) {
    await requestOnce(url, cfg);
  }

  async function worker() {
    while (sent < cfg.requests) {
      sent += 1;
      const result = await requestOnce(url, cfg);
      if (result.ok) {
        latencies.push(result.ms);
        const k = String(result.status || 0);
        statusCounts[k] = (statusCounts[k] || 0) + 1;
      }
      else errors += 1;
    }
  }

  const workers = Array.from({ length: Math.max(1, cfg.concurrency) }, () => worker());
  await Promise.all(workers);

  return {
    endpoint,
    samples: latencies.length,
    errors,
    statusCounts,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    reachable: latencies.length > 0,
  };
}

async function main() {
  const cfg = parseArgs();
  const results = [];

  for (const endpoint of cfg.endpoints) {
    const r = await runEndpoint(endpoint, cfg);
    results.push(r);
  }

  const ok = results.every((r) => r.reachable && r.samples > 0);
  console.log(JSON.stringify({
    date: new Date().toISOString(),
    baseUrl: cfg.baseUrl,
    method: cfg.method,
    warmupRequests: cfg.warmup,
    headerKeys: Object.keys(cfg.headers || {}),
    requestsPerEndpoint: cfg.requests,
    concurrency: cfg.concurrency,
    ok,
    results,
  }, null, 2));

  if (!ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
