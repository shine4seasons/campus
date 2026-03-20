import { API_URL, STORAGE_KEYS, ROUTES } from './config.js';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(endpoint, options);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
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
  put:    (url, body)  => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (url, body)  => apiFetch(url, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (url)        => apiFetch(url, { method: 'DELETE' }),
};

export function apiUpload(url, formData) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  return fetch(`${API_URL}${url}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  }).then(r => r.json());
}

async function tryRefresh() {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST', credentials: 'include',
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    return true;
  } catch { return false; }
}
