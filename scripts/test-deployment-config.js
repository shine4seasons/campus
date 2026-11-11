const assert = require('node:assert/strict');
const { test } = require('node:test');
const { configurePublicUrls } = require('../config/publicUrls');

const deployedOrigin = 'https://campus-ecpa.onrender.com';

test('Render repairs localhost OAuth, redirects and socket origins', () => {
  const env = {
    RENDER: 'true', RENDER_EXTERNAL_URL: deployedOrigin,
    NODE_ENV: 'development', SERVER_URL: 'http://localhost:5000',
    CLIENT_URL: 'http://127.0.0.1:5000',
    SOCKET_ALLOWED_ORIGINS: 'http://localhost:5000/,http://127.0.0.1:5000',
  };
  configurePublicUrls(env);
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.SERVER_URL, deployedOrigin);
  assert.equal(env.CLIENT_URL, deployedOrigin);
  assert.equal(env.SOCKET_ALLOWED_ORIGINS, deployedOrigin);
});

test('Render detects its hostname when URLs are omitted', () => {
  const env = { RENDER_EXTERNAL_HOSTNAME: 'campus-ecpa.onrender.com' };
  configurePublicUrls(env);
  assert.equal(env.SERVER_URL, deployedOrigin);
  assert.equal(env.CLIENT_URL, deployedOrigin);
});

test('Startup validation exposes normalized URLs to downstream modules', () => {
  const { validateEnv } = require('../config/env');
  const env = {
    RENDER: 'true', RENDER_EXTERNAL_URL: deployedOrigin,
    SERVER_URL: 'http://localhost:5000', CLIENT_URL: 'http://localhost:5000',
    MONGODB_URI: 'mongodb://localhost:27017/test-not-connected',
    JWT_SECRET: 'test-secret-not-for-real-use',
    GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test',
    CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test',
    SEPAY_API_KEY: 'test', SEPAY_WEBHOOK_SECRET: 'test', GROQ_API_KEY: 'test',
  };
  const config = validateEnv(env);
  assert.equal(config.SERVER_URL, deployedOrigin);
  assert.equal(env.SERVER_URL, config.SERVER_URL);
  assert.equal(env.CLIENT_URL, config.CLIENT_URL);
  assert.equal(env.SOCKET_ALLOWED_ORIGINS, config.SOCKET_ALLOWED_ORIGINS);
  assert.equal(env.NODE_ENV, 'production');
});

test('Local development keeps its configured port', () => {
  const env = { PORT: '5100' };
  configurePublicUrls(env);
  assert.equal(env.SERVER_URL, 'http://localhost:5100');
  assert.equal(env.CLIENT_URL, env.SERVER_URL);
});

test('Explicit custom domains survive, trailing slashes and duplicate origins do not', () => {
  const env = {
    NODE_ENV: 'production', RENDER_EXTERNAL_URL: deployedOrigin,
    SERVER_URL: 'https://market.example/', CLIENT_URL: 'https://market.example/',
    SOCKET_ALLOWED_ORIGINS: 'https://chat.example/,https://chat.example',
  };
  configurePublicUrls(env);
  assert.equal(env.SERVER_URL, 'https://market.example');
  assert.equal(env.CLIENT_URL, 'https://market.example');
  assert.equal(env.SOCKET_ALLOWED_ORIGINS, 'https://chat.example,https://market.example');
});

test('Production rejects local, insecure and malformed public origins', () => {
  for (const origin of [
    'http://localhost:5000', 'https://127.0.0.1', 'https://[::1]',
    'http://market.example', 'https://market.example/path',
    'https://name:password@market.example', 'https://market.example/?query=1',
    'https://market.example/#fragment', 'javascript:alert(1)',
  ]) {
    assert.throws(() => configurePublicUrls({ NODE_ENV: 'production', SERVER_URL: origin }),
      /Environment validation failed/);
  }
});

test('Google OAuth uses the public callback and returns failures to the real login page', async () => {
  const express = require('express');
  const http = require('http');
  const keys = ['RENDER', 'RENDER_EXTERNAL_URL', 'NODE_ENV', 'SERVER_URL', 'CLIENT_URL',
    'SOCKET_ALLOWED_ORIGINS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    RENDER: 'true', RENDER_EXTERNAL_URL: deployedOrigin, NODE_ENV: 'development',
    SERVER_URL: 'http://localhost:5000', CLIENT_URL: 'http://localhost:5000',
    SOCKET_ALLOWED_ORIGINS: 'http://localhost:5000',
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
    JWT_SECRET: 'test-secret-not-for-real-use',
  });
  configurePublicUrls();
  require('../config/passport');
  const app = express();
  app.use(require('passport').initialize());
  app.use('/api/auth', require('../routes/authRoutes'));
  const server = http.createServer(app);
  const socketServer = require('../utils/socketServer');
  socketServer.init(server);
  const repository = require('../repositories/authRepository');
  const originalFindUser = repository.findUserById;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const start = await fetch(`${base}/api/auth/google`, {
      redirect: 'manual', headers: { Host: 'untrusted.example' },
    });
    assert.equal(start.status, 302);
    const googleUrl = new URL(start.headers.get('location'));
    assert.equal(googleUrl.hostname, 'accounts.google.com');
    assert.equal(googleUrl.searchParams.get('redirect_uri'), `${deployedOrigin}/api/auth/google/callback`);

    const denied = await fetch(`${base}/api/auth/google/callback?error=access_denied`, { redirect: 'manual' });
    assert.equal(denied.status, 302);
    assert.equal(denied.headers.get('location'), `${deployedOrigin}/login?error=oauth_failed`);

    const bypass = await fetch(`${base}/api/auth/dev-login?userId=test`, { redirect: 'manual' });
    assert.equal(bypass.status, 404);

    const handshake = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: deployedOrigin },
    });
    assert.equal(handshake.status, 200);
    assert.equal(handshake.headers.get('access-control-allow-origin'), deployedOrigin);

    const auth = require('../controllers/auth');
    for (const profileComplete of [false, true]) {
      repository.findUserById = async () => ({ profileComplete });
      const cookies = [];
      let destination;
      await auth.googleCallback({ user: { _id: '111111111111111111111111' } }, {
        cookie: (name, value, options) => cookies.push({ name, options }),
        redirect: (url) => { destination = url; },
      });
      assert.equal(destination, `${deployedOrigin}/${profileComplete ? '' : 'login?step=setup'}`);
      assert.equal(cookies.length, 2);
      assert(cookies.every((cookie) => cookie.options.secure));
    }
  } finally {
    repository.findUserById = originalFindUser;
    await new Promise((resolve) => socketServer.getIO().close(resolve));
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
