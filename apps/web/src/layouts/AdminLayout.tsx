import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "./PublicLayout";
import { Button, Drawer } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useExperience } from "../components/LocalExperience";
const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: "grid" },
  { to: "/admin/vehiculos", label: "Vehículos", icon: "car" },
  { to: "/admin/reservas", label: "Reservas", icon: "calendar" },
  { to: "/admin/usuarios", label: "Usuarios", icon: "users" },
  { to: "/admin/configuracion", label: "Configuración", icon: "settings" },
];
export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { notify } = useExperience();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);
  const nav = (
    <>
      <BrandLogo />
      <span className="sidebar-label">ESPACIO DE GESTIÓN</span>
      <nav aria-label="Administración">
        {adminLinks.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/admin"}>
            <Icon name={l.icon} />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <BadgeDemo />
        <Link to="/">
          <Icon name="logout" size={18} />
          Volver al sitio
        </Link>
      </div>
    </>
  );
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">{nav}</aside>
      <Drawer title="Administración" open={open} onClose={() => setOpen(false)}>
        <div className="admin-drawer-nav">{nav}</div>
      </Drawer>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <Button
              className="mobile-menu"
              variant="ghost"
              onClick={() => setOpen(true)}
              aria-label="Abrir navegación administrativa"
            >
              <Icon name="menu" />
            </Button>
            <span>Tu operación, de un vistazo.</span>
          </div>
          <div>
            <Button
              variant="ghost"
              aria-label="Notificaciones"
              onClick={() =>
                notify("No tienes notificaciones nuevas en esta demostración.")
              }
            >
              <Icon name="bell" />
            </Button>
            <span className="avatar">VR</span>
            <span className="admin-user">
              Valentina Ríos<small>Administradora</small>
            </span>
          </div>
        </header>
        <main id="contenido" className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
function BadgeDemo() {
  return (
    <div className="demo-banner">
      <span className="tag-dot" />
      <span>
        Entorno visual<small>Datos de demostración</small>
      </span>
    </div>
  );
}
