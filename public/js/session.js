export async function getCurrentUser() {
  const response = await fetch('/api/auth/me', {
    credentials: 'include'
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload?.data || null;
}

export function isAdmin(user) {
  return user?.role === 'admin';
}
