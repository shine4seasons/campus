import { API_URL, STORAGE_KEYS, ROUTES } from './config.js';
import { api } from './api.js';

export const auth = {

  getToken()  { return localStorage.getItem(STORAGE_KEYS.TOKEN); },

  getUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },

  isAuthenticated() { return !!this.getToken() && !!this.getUser(); },
  isAdmin() { return this.getUser()?.role === 'admin'; },
  // Không còn phân biệt seller/buyer — mọi user đều có thể mua và bán

  setToken(token) { localStorage.setItem(STORAGE_KEYS.TOKEN, token); },
  setUser(user)   { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)); },

  async loginWithToken(token) {
    this.setToken(token);
    const data = await api.get('/auth/me');
    this.setUser(data.data);
    return data.data;
  },

  loginWithGoogle() {
    window.location.href = `${API_URL}/auth/google`;
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    window.location.href = ROUTES.LOGIN;
  },

  async refreshUser() {
    try {
      const data = await api.get('/auth/me');
      this.setUser(data.data);
      return data.data;
    } catch { return null; }
  },
};