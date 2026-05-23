const fs = require('fs');
const path = require('path');
const http = require('http');

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeHeaders(input) {
  const headers = {};
  Object.entries(input || {}).forEach(([k, v]) => {
    if (typeof v === 'string' && k) headers[String(k).toLowerCase()] = v;
  });
  return headers;
}

function parseHeadersJson(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return normalizeHeaders(parsed);
  } catch {
    return {};
  }
}

function parseEndpointMatrixJson(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const matrix = {};
    Object.entries(parsed).forEach(([endpoint, value]) => {
      if (!String(endpoint).startsWith('/')) return;
      if (!endpoint || !value || typeof value !== 'object' || Array.isArray(value)) return;
      matrix[endpoint] = {
        method: typeof value.method === 'string' ? value.method.toUpperCase() : undefined,
        headers: normalizeHeaders(value.headers || {}),
        body: typeof value.body === 'string' ? value.body : undefined,
        allowStatuses: Array.isArray(value.allowStatuses)
          ? value.allowStatuses.map((item) => String(item))
          : undefined,
        successStatuses: Array.isArray(value.successStatuses)
          ? value.successStatuses.map((item) => String(item))
          : undefined,
      };
    });
    return matrix;
  } catch {
    return {};
  }
}

function loadEndpointMatrixFromFile(filePath) {
  if (!filePath) return {};
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '');
  return parseEndpointMatrixJson(raw);
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
    endpointMatrix: {},
  };
  const endpointMatrixFromEnv = process.env.BENCH_ENDPOINT_MATRIX_FILE
    ? loadEndpointMatrixFromFile(process.env.BENCH_ENDPOINT_MATRIX_FILE)
    : parseEndpointMatrixJson(process.env.BENCH_ENDPOINT_MATRIX_JSON);
  out.endpointMatrix = endpointMatrixFromEnv;
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
    if (arg.startsWith('--endpoint-matrix-file=')) {
      out.endpointMatrix = loadEndpointMatrixFromFile(arg.slice('--endpoint-matrix-file='.length));
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
    const body = typeof cfg.body === 'string' ? cfg.body : '';
    const headers = Object.assign({}, cfg.headers || {});
    if (body && !headers['content-length']) headers['content-length'] = Buffer.byteLength(body);
    const req = http.request(url, {
      method: cfg.method || 'GET',
      timeout: cfg.timeoutMs,
      headers
    }, (res) => {
      res.resume();
      res.on('end', () => {
        resolve({ ok: true, status: res.statusCode, ms: Date.now() - start });
      });
    });
    if (body) req.write(body);
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

function buildEndpointConfig(endpoint, cfg) {
  const override = cfg.endpointMatrix[endpoint] || {};
  return {
    method: override.method || cfg.method,
    timeoutMs: cfg.timeoutMs,
    headers: Object.assign({}, cfg.headers, override.headers || {}),
    body: typeof override.body === 'string' ? override.body : '',
    allowStatuses: Array.isArray(override.allowStatuses) && override.allowStatuses.length > 0
      ? override.allowStatuses
      : null,
    successStatuses: Array.isArray(override.successStatuses) && override.successStatuses.length > 0
      ? override.successStatuses
      : null,
  };
}

async function runEndpoint(endpoint, cfg) {
  const url = `${cfg.baseUrl}${endpoint}`;
  const endpointCfg = buildEndpointConfig(endpoint, cfg);
  const latencies = [];
  const successLatencies = [];
  let errors = 0;
  let sent = 0;
  const statusCounts = {};

  for (let i = 0; i < cfg.warmup; i += 1) {
    await requestOnce(url, endpointCfg);
  }

  async function worker() {
    while (sent < cfg.requests) {
      sent += 1;
      const result = await requestOnce(url, endpointCfg);
      if (result.ok) {
        latencies.push(result.ms);
        const status = String(result.status || 0);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (!endpointCfg.successStatuses || endpointCfg.successStatuses.includes(status)) {
          successLatencies.push(result.ms);
        }
      } else {
        errors += 1;
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, cfg.concurrency) }, () => worker());
  await Promise.all(workers);

  const observedStatuses = Object.keys(statusCounts);
  const disallowedStatuses = endpointCfg.allowStatuses
    ? observedStatuses.filter((status) => !endpointCfg.allowStatuses.includes(status))
    : [];
  const authOnlyStatuses = observedStatuses.length > 0
    && observedStatuses.every((status) => status === '401' || status === '403');

  return {
    endpoint,
    method: endpointCfg.method,
    samples: latencies.length,
    successSamples: successLatencies.length,
    errors,
    statusCounts,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    successP50: percentile(successLatencies, 50),
    successP95: percentile(successLatencies, 95),
    successP99: percentile(successLatencies, 99),
    reachable: latencies.length > 0,
    meaningful: successLatencies.length > 0 && !authOnlyStatuses && disallowedStatuses.length === 0,
    authOnlyStatuses,
    disallowedStatuses,
    allowStatuses: endpointCfg.allowStatuses || undefined,
    successStatuses: endpointCfg.successStatuses || undefined,
  };
}

async function main() {
  const cfg = parseArgs();
  const results = [];

  for (const endpoint of cfg.endpoints) {
    const result = await runEndpoint(endpoint, cfg);
    results.push(result);
  }

  const ok = results.every((row) => row.reachable && row.samples > 0 && row.meaningful);
  console.log(JSON.stringify({
    date: new Date().toISOString(),
    baseUrl: cfg.baseUrl,
    method: cfg.method,
    warmupRequests: cfg.warmup,
    headerKeys: Object.keys(cfg.headers || {}),
    hasEndpointMatrix: Object.keys(cfg.endpointMatrix || {}).length > 0,
    requestsPerEndpoint: cfg.requests,
    concurrency: cfg.concurrency,
    ok,
    results,
  }, null, 2));

  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
