import { auth } from './auth.js';
import { ROUTES } from './config.js';

export const router = {

  requireAuth(roles = []) {
    if (!auth.isAuthenticated()) {
      sessionStorage.setItem('redirect_after_login', window.location.href);
      window.location.href = ROUTES.LOGIN;
      return false;
    }
    if (roles.length > 0 && !roles.includes(auth.getUser()?.role)) {
      window.location.href = '/pages/403.html';
      return false;
    }
    return true;
  },

  redirectIfAuth() {
    if (auth.isAuthenticated()) {
      const redirectTo = sessionStorage.getItem('redirect_after_login');
      sessionStorage.removeItem('redirect_after_login');
      window.location.href = redirectTo || ROUTES.HOME;
    }
  },
};
