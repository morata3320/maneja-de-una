import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession } from "../services/apiClient";
import type { ApiUser } from "../models";
export function useAuthController() {
  const navigate = useNavigate(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function submit(register: boolean, data: Record<string, string>) {
    setLoading(true);
    setError("");
    try {
      if (register)
        await api<ApiUser>({ method: "POST", url: "/auth/register", data });
      const session = await api<{ accessToken: string; user: ApiUser }>({
        method: "POST",
        url: "/auth/login",
        data: { email: data.email, password: data.password },
      });
      saveSession(session.accessToken, session.user);
      navigate(session.user.role === "ADMIN" ? "/admin" : "/vehiculos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible ingresar");
    } finally {
      setLoading(false);
    }
  }
  return { submit, loading, error };
}
