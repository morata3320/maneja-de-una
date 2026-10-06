import { NavLink, Outlet } from "react-router-dom";
export function AccountLayout() {
  return (
    <div className="container section account-layout">
      <aside>
        <span className="eyebrow">TU ESPACIO</span>
        <h2>Mi cuenta</h2>
        <nav aria-label="Mi cuenta">
          <NavLink to="/mis-reservas">Mis reservas</NavLink>
          <NavLink to="/favoritos">Mis favoritos</NavLink>
        </nav>
        <p className="demo-note">Vista de demostración</p>
      </aside>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
