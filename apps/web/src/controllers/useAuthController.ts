import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/apiClient";
import type { ApiUser } from "../models";
import { useAuth } from "./AuthContext";
export function useAuthController() {
  const navigate = useNavigate(),
    location = useLocation(),
    auth = useAuth(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function submit(register: boolean, data: Record<string, string>) {
    setLoading(true);
    setError("");
    try {
      if (register)
        await api<ApiUser>({ method: "POST", url: "/auth/register", data });
      const user = await auth.login(
        data.email,
        data.password,
        data.remember === "on",
      );
      const pending = (location.state as { from?: string } | null)?.from;
      navigate(user.role === "ADMIN" ? (pending ?? "/admin") : "/vehiculos", {
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible ingresar");
    } finally {
      setLoading(false);
    }
  }
  return { submit, loading, error };
}
