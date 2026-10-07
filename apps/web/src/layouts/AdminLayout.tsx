import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "./PublicLayout";
import { Button, Drawer } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useAuth } from "../controllers/AuthContext";

const adminLinks = [
  ["/admin", "Dashboard", "grid"], ["/admin/vehiculos", "Vehículos", "car"],
  ["/admin/marcas", "Marcas", "grid"], ["/admin/modelos", "Modelos", "grid"],
  ["/admin/categorias", "Categorías", "grid"], ["/admin/ubicaciones", "Ubicaciones", "pin"],
  ["/admin/proveedores", "Proveedores", "users"], ["/admin/agencias", "Agencias", "pin"],
  ["/admin/calificaciones", "Calificaciones", "grid"], ["/admin/clientes", "Clientes", "users"],
  ["/admin/reservas", "Reservas", "calendar"], ["/admin/pagos", "Pagos", "shield"],
] as const;

export function AdminLayout() {
  const [open, setOpen] = useState(false), { pathname } = useLocation();
  const { user, loading, logout } = useAuth();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  if (loading) return <p className="container section" role="status">Restaurando sesión…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;
  const nav = <><BrandLogo /><span className="sidebar-label">ESPACIO DE GESTIÓN</span><nav aria-label="Administración">{adminLinks.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === "/admin"}><Icon name={icon} />{label}</NavLink>)}</nav><div className="sidebar-bottom"><Link to="/" onClick={logout}><Icon name="logout" size={18} />Cerrar sesión</Link></div></>;
  const initials = `${user.firstName?.[0] ?? "A"}${user.lastName?.[0] ?? ""}`;
  return <div className="admin-layout"><aside className="admin-sidebar">{nav}</aside><Drawer title="Administración" open={open} onClose={() => setOpen(false)}><div className="admin-drawer-nav">{nav}</div></Drawer><div className="admin-main"><header className="admin-topbar"><div><Button className="mobile-menu" variant="ghost" onClick={() => setOpen(true)} aria-label="Abrir navegación administrativa"><Icon name="menu" /></Button><span>Tu operación, de un vistazo.</span></div><div><span className="avatar">{initials}</span><span className="admin-user">{`${user.firstName ?? "Admin"} ${user.lastName ?? ""}`}<small>{user.email ?? "Administradora"}</small></span></div></header><main id="contenido" className="admin-content"><Outlet /></main></div></div>;
}
