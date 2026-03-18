import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi } from './auth';

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
          const user = await authApi.getMe(token);
          set({ user, loading: false });
        } catch {
          set({ user: null, token: null, loading: false });
        }
      },

      // Kiểm tra session còn sống khi app khởi động
      initAuth: async () => {
        const { token } = get();
        if (!token) return;
        set({ loading: true });
        try {
          const user = await authApi.getMe(token);
          set({ user, loading: false });
        } catch {
          // Token hết hạn → thử refresh silent
          try {
            const { token: newToken } = await authApi.refresh();
            const user = await authApi.getMe(newToken);
            set({ user, token: newToken, loading: false });
          } catch {
            set({ user: null, token: null, loading: false });
          }
        }
      },

      logout: async () => {
        await authApi.logout().catch(() => {});
        set({ user: null, token: null });
      },
    }),
    {
      name:    'campus-auth',
      storage: createJSONStorage(() => sessionStorage), // tab-scoped
      partialize: (s) => ({ token: s.token }),            // chỉ persist token
    }
  )
);