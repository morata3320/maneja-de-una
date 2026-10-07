import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../controllers/AuthContext";
export function AccountLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <p className="container section" role="status">Restaurando sesión…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;
  return (
    <div className="container section account-layout">
      <aside>
        <span className="eyebrow">TU ESPACIO</span>
        <h2>Mi cuenta</h2>
        <nav aria-label="Mi cuenta">
          <NavLink to="/mis-reservas">Mis reservas</NavLink>
          <NavLink to="/favoritos">Mis favoritos</NavLink>
          <NavLink to="/perfil">Mi perfil</NavLink>
        </nav>
        <p className="demo-note">Sesión segura con API V2</p>
      </aside>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
