import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button, Drawer, Modal } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useExperience } from "../components/LocalExperience";
export function BrandLogo() {
  return (
    <Link className="brand" to="/" aria-label="Maneja de Una, inicio">
      <span className="brand-mark">
        m<span>.</span>
      </span>
      <span>
        maneja<span className="brand-bottom">de una.</span>
      </span>
    </Link>
  );
}
export function PublicLayout() {
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState("");
  const { pathname, hash } = useLocation();
  const { comparison } = useExperience();
  useEffect(() => {
    setMenu(false);
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  const links = (
    <>
      <NavLink to="/vehiculos">Explorar autos</NavLink>
      <Link to="/#como-funciona">Cómo funciona</Link>
      <NavLink to="/comparar">Comparar</NavLink>
    </>
  );
  return (
    <>
      <header className="site-header">
        <div className="container nav-content">
          <BrandLogo />
          <nav className="desktop-nav" aria-label="Navegación principal">
            {links}
          </nav>
          <div className="nav-actions">
            <Link
              className="nav-favorite"
              to="/favoritos"
              aria-label="Mis favoritos"
            >
              <Icon name="heart" />
            </Link>
            <Link className="login-link" to="/login">
              Iniciar sesión
            </Link>
            <Link className="btn btn-primary btn-sm nav-cta" to="/vehiculos">
              Alquila un auto <Icon name="arrow" size={16} />
            </Link>
            <Button
              className="mobile-menu"
              variant="ghost"
              onClick={() => setMenu(true)}
              aria-label="Abrir menú"
            >
              <Icon name="menu" />
            </Button>
          </div>
        </div>
      </header>
      <Drawer
        open={menu}
        onClose={() => setMenu(false)}
        title="Tu próximo destino"
      >
        <nav className="drawer-nav">
          {links}
          <Link to="/favoritos">Mis favoritos</Link>
          <Link to="/login">Iniciar sesión</Link>
          <Link to="/mis-reservas">Mis reservas</Link>
        </nav>
      </Drawer>
      <main id="contenido">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <BrandLogo />
            <p>
              Elige tu auto.
              <br />
              El resto del camino es tuyo.
            </p>
            <span className="footer-country">Hecho para moverte.</span>
          </div>
          <div>
            <h3>Explorar</h3>
            <Link to="/vehiculos">Todos los autos</Link>
            <Link to="/comparar">Comparar autos</Link>
            <Link to="/favoritos">Favoritos</Link>
          </div>
          <div>
            <h3>Tu viaje</h3>
            <Link to="/#como-funciona">Cómo funciona</Link>
            <Link to="/mis-reservas">Mis reservas</Link>
            <button onClick={() => setInfo("Ayuda")}>Centro de ayuda</button>
          </div>
          <div>
            <h3>Maneja de Una</h3>
            <button onClick={() => setInfo("Nosotros")}>Sobre nosotros</button>
            <button onClick={() => setInfo("Privacidad")}>Privacidad</button>
            <button onClick={() => setInfo("Términos")}>
              Términos y condiciones
            </button>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Maneja de Una</span>
          <span>Tu camino empieza aquí.</span>
          <Link to="/admin">Administración</Link>
        </div>
      </footer>
      <Modal open={!!info} onClose={() => setInfo("")} title={info}>
        <p>
          {info === "Nosotros"
            ? "Maneja de Una es una propuesta para encontrar, comparar y elegir tu próximo auto de alquiler de forma sencilla."
            : "Esta sección está en preparación. La experiencia actual es una demostración visual; no se realizan reservas, pagos ni envíos de información."}
        </p>
        <Button onClick={() => setInfo("")}>Entendido</Button>
      </Modal>
      {comparison.length > 0 && pathname !== "/comparar" && (
        <div className="compare-bar">
          <span>
            <Icon name="compare" />
            {comparison.length} de 3 autos para comparar
          </span>
          <Link className="btn btn-primary btn-sm" to="/comparar">
            Comparar <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}
    </>
  );
}
