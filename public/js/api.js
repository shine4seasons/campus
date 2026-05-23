import { ROUTES } from './config.js';

/**
 * Wrapper fetch dùng cho client-side JS trong EJS templates.
 * Token KHÔNG còn trong localStorage — httpOnly cookie t? d?ng du?c g?i.
 */
function getCsrfToken() {
  return document.cookie
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('csrf='))
    ?.slice('csrf='.length);
}

export async function apiFetch(endpoint, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const csrfToken = getCsrfToken();

  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating && csrfToken ? { 'x-csrf-token': decodeURIComponent(csrfToken) } : {}),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`/api${endpoint}`, config);

  if (response.status === 401) {
    window.location.href = ROUTES.LOGIN;
    return;
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  get: (url) => apiFetch(url),
  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: (url, body) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => apiFetch(url, { method: 'DELETE' }),
};

export function apiUpload(url, formData) {
  const csrfToken = getCsrfToken();

  return fetch(`/api${url}`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'x-csrf-token': decodeURIComponent(csrfToken) } : {},
    body: formData,
  }).then((r) => r.json());
}
