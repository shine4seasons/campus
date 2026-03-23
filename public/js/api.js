import { ROUTES } from './config.js';

/**
 * Wrapper fetch dùng cho client-side JS trong EJS templates.
 * Token KHÔNG còn trong localStorage — httpOnly cookie tự động được gửi.
 */
export async function apiFetch(endpoint, options = {}) {
  const config = {
    credentials: 'include',   // gửi cookie tự động
    headers: {
      'Content-Type': 'application/json',
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
  get:    (url)        => apiFetch(url),
  post:   (url, body)  => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  (url, body)  => apiFetch(url, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (url)        => apiFetch(url, { method: 'DELETE' }),
};

export function apiUpload(url, formData) {
  return fetch(`/api${url}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  }).then(r => r.json());
}
