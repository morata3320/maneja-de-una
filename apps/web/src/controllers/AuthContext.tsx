import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ApiUser } from "../models";
import { api, clearSession, getStoredToken, saveSession, SESSION_EVENT, sessionIsPersistent } from "../services/apiClient";

type AuthState = {
  user: ApiUser | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<ApiUser>;
  logout: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  async function restore() {
    const token = getStoredToken();
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const current = await api<ApiUser>({ url: "/auth/me" });
      saveSession(token, current, sessionIsPersistent());
      setUser(current);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }
  useEffect(() => { void restore(); }, []);
  useEffect(() => {
    const sync = () => { if (!getStoredToken()) setUser(null); };
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);
  async function login(email: string, password: string, remember: boolean) {
    const session = await api<{ accessToken: string; user: ApiUser }>({ method: "POST", url: "/auth/login", data: { email, password } });
    saveSession(session.accessToken, session.user, remember);
    try {
      const current = await api<ApiUser>({ url: "/auth/me" });
      saveSession(session.accessToken, current, remember);
      setUser(current);
      return current;
    } catch (error) { clearSession(); throw error; }
  }
  function logout() { clearSession(); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Falta AuthProvider");
  return value;
}
