const TOKEN_KEY = "tg_terminal_jwt";
export const AUTH_CHANGED_EVENT = "tg-auth-changed";

function notifyAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChanged();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  notifyAuthChanged();
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
