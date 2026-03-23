import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from './api.js';
import { STORAGE_KEYS, ROUTES } from './config.js';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:    null,
      token:   null,
      loading: false,

      // Gọi sau khi Google redirect về /auth/callback?token=xxx
      setTokenAndFetchUser: async (token) => {
        set({ token, loading: true });
        try {
          const data = await api.get('/auth/me');
          const user = data.data;
          set({ user, token, loading: false });
          // Sync với localStorage
          localStorage.setItem(STORAGE_KEYS.TOKEN, token);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        } catch {
          set({ user: null, token: null, loading: false });
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
      },

      // Kiểm tra session còn sống khi app khởi động
      initAuth: async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const userStr = localStorage.getItem(STORAGE_KEYS.USER);
        
        if (!token || !userStr) {
          set({ user: null, token: null, loading: false });
          return;
        }

        set({ token, user: JSON.parse(userStr), loading: false });
      },

      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        set({ user: null, token: null });
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
      },

      // Cập nhật user info (sau khi chỉnh sửa profile)
      updateUser: (updates) => {
        const current = get().user;
        const updated = { ...current, ...updates };
        set({ user: updated });
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      },
    }),
    {
      name:    'campus-auth',
      storage: createJSONStorage(() => localStorage), // Sử dụng localStorage thay vì sessionStorage
      partialize: (s) => ({ user: s.user, token: s.token }), // Persist cả token và user
    }
  )
);