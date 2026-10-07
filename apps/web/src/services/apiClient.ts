import axios, { AxiosError, type AxiosRequestConfig } from "axios";

const baseURL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v2"
).replace(/\/$/, "");
const TOKEN_KEY = "mdu_access_token";
const USER_KEY = "mdu_user";
export const SESSION_EVENT = "mdu-session-change";
const stores = () => [localStorage, sessionStorage];
export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}
function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export const apiClient = axios.create({
  baseURL,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ message?: string | string[] }>) => {
    if (error.response?.status === 401) {
      clearSession();
    }
    const raw = error.response?.data?.message;
    const message = Array.isArray(raw)
      ? raw.join(". ")
      : raw || "No fue posible completar la solicitud.";
    return Promise.reject(new Error(message));
  },
);
export async function api<T>(config: AxiosRequestConfig) {
  return (await apiClient.request<T>(config)).data;
}
export function saveSession(token: string, user: unknown, remember: boolean) {
  for (const store of stores()) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(USER_KEY);
  }
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  notifySessionChange();
}
export function clearSession() {
  for (const store of stores()) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(USER_KEY);
  }
  notifySessionChange();
}
export function sessionIsPersistent() {
  return localStorage.getItem(TOKEN_KEY) !== null;
}
