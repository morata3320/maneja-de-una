import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Checkbox, Input, Modal } from "../components/ui";
import { Icon } from "../components/ui/Icon";
export function Auth({ register = false }: { register?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  return (
    <div className="auth-layout">
      <div className="auth-visual">
        <span className="eyebrow">MENOS VUELTAS. MÁS VIDA.</span>
        <h2>
          Tu próximo
          <br />
          capítulo empieza
          <br />
          <em>en el camino.</em>
        </h2>
        <img
          src="/images/sedan.svg"
          alt="Ilustración de un sedán listo para un nuevo viaje"
        />
        <p>Un auto para cada versión de ti.</p>
      </div>
      <div className="auth-form-wrap">
        <Link className="text-link" to="/vehiculos">
          Explorar primero <Icon name="arrow" size={16} />
        </Link>
        <div className="auth-form">
          <span className="eyebrow">BIENVENIDO A MANEJA DE UNA</span>
          <h1>{register ? "Tu camino empieza aquí." : "Qué bueno verte."}</h1>
          <p>
            {register
              ? "Crea tu espacio para guardar tus próximos planes."
              : "Entra y retoma tus próximos planes."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (register && password !== confirm) {
                setError("Las contraseñas no coinciden.");
                return;
              }
              setError("");
              setModal(
                register
                  ? "Cuenta de demostración"
                  : "Inicio de sesión de demostración",
              );
            }}
          >
            {register && (
              <Input
                label="Nombre completo"
                name="name"
                autoComplete="name"
                placeholder="Tu nombre"
                required
              />
            )}
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              required
            />
            <Input
              label="Contraseña"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Al menos 8 caracteres"
              required
            />
            {register && (
              <Input
                label="Confirmar contraseña"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                required
              />
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="auth-options">
              {register ? (
                <Checkbox
                  label="Acepto los términos y la política de privacidad"
                  required
                />
              ) : (
                <>
                  <Checkbox label="Recordarme" />
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setModal("Recuperar contraseña")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </>
              )}
            </div>
            {register && (
              <button
                type="button"
                className="text-link"
                onClick={() => setModal("Términos y privacidad")}
              >
                Leer términos y privacidad
              </button>
            )}
            <Button type="submit" size="lg">
              {register ? "Crear cuenta" : "Iniciar sesión"}
              <Icon name="arrow" />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? "¿Ya tienes cuenta?" : "¿Es tu primera vez?"}{" "}
            <Link to={register ? "/login" : "/registro"}>
              {register ? "Iniciar sesión" : "Crear cuenta"}
            </Link>
          </p>
          <div className="auth-note">
            <Icon name="shield" size={16} />
            Vista previa · No se envían tus datos.
          </div>
        </div>
      </div>
      <Modal open={!!modal} title={modal} onClose={() => setModal("")}>
        <p>
          {modal === "Recuperar contraseña"
            ? "La recuperación de contraseña estará disponible cuando se active el acceso a tu cuenta."
            : "Estás explorando una demostración visual. No se ha enviado ni guardado tu información. Las cuentas, reservas y condiciones definitivas se habilitarán en una próxima fase."}
        </p>
        <Button onClick={() => setModal("")}>Entendido</Button>
      </Modal>
    </div>
  );
}
