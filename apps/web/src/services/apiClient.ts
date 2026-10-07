import axios, { AxiosError, type AxiosRequestConfig } from "axios";

const baseURL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v2"
).replace(/\/$/, "");
export const apiClient = axios.create({
  baseURL,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("mdu_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ message?: string | string[] }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mdu_access_token");
      localStorage.removeItem("mdu_user");
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
export function saveSession(token: string, user: unknown) {
  localStorage.setItem("mdu_access_token", token);
  localStorage.setItem("mdu_user", JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem("mdu_access_token");
  localStorage.removeItem("mdu_user");
}
