function isLoopback(hostname) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') ||
    host === '[::1]' || host === '0.0.0.0' || /^127\./.test(host);
}

function parseOrigin(value, name) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error(`Environment validation failed: ${name} must be an HTTP(S) origin`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`Environment validation failed: ${name} must be an HTTP(S) origin without a path, credentials, query or fragment`);
  }
  return url;
}

// Use trusted deployment configuration, never a client-supplied Host header,
// to construct OAuth callbacks and post-login redirects.
function configurePublicUrls(env = process.env) {
  const renderUrl = env.RENDER_EXTERNAL_URL ||
    (env.RENDER_EXTERNAL_HOSTNAME ? `https://${env.RENDER_EXTERNAL_HOSTNAME}` : '');
  const onRender = env.RENDER === 'true' || Boolean(renderUrl);
  if (onRender) env.NODE_ENV = 'production';
  const isProd = env.NODE_ENV === 'production';
  const external = renderUrl ? parseOrigin(renderUrl, 'RENDER_EXTERNAL_URL') : null;

  function resolve(value, name, fallback) {
    let url = value ? parseOrigin(value, name) : null;
    if ((!url || isLoopback(url.hostname)) && external) url = external;
    if (!url && fallback) url = parseOrigin(fallback, name);
    if (!url) throw new Error(`Environment validation failed: ${name} is required`);
    if (isProd && (url.protocol !== 'https:' || isLoopback(url.hostname))) {
      throw new Error(`Environment validation failed: ${name} must use a public HTTPS origin in production`);
    }
    return url.origin;
  }

  env.SERVER_URL = resolve(env.SERVER_URL, 'SERVER_URL',
    isProd ? null : `http://localhost:${env.PORT || 5000}`);
  env.CLIENT_URL = resolve(env.CLIENT_URL, 'CLIENT_URL', env.SERVER_URL);

  const origins = String(env.SOCKET_ALLOWED_ORIGINS || env.CLIENT_URL)
    .split(',').map((value) => value.trim()).filter(Boolean)
    .map((value) => resolve(value, 'SOCKET_ALLOWED_ORIGINS'));
  // The server renders the UI too, so its own public origin must be allowed.
  env.SOCKET_ALLOWED_ORIGINS = [...new Set([
    ...origins, env.SERVER_URL, env.CLIENT_URL,
  ])].join(',');
  return env;
}

module.exports = { configurePublicUrls };
