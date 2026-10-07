import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Checkbox, Input, Modal } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useAuthController } from "../controllers/useAuthController";

export function Auth({ register = false }: { register?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const auth = useAuthController();
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
        <img src="/images/sedan.svg" alt="Sedán listo para un nuevo viaje" />
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
              ? "Crea tu cuenta para reservar."
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
              void auth.submit(
                register,
                Object.fromEntries(new FormData(e.currentTarget)) as Record<
                  string,
                  string
                >,
              );
            }}
          >
            {register && (
              <>
                <Input
                  label="Nombres"
                  name="firstName"
                  autoComplete="given-name"
                  minLength={2}
                  maxLength={50}
                  required
                />
                <Input
                  label="Apellidos"
                  name="lastName"
                  autoComplete="family-name"
                  minLength={2}
                  maxLength={50}
                  required
                />
                <Input
                  label="Cédula"
                  name="cedula"
                  inputMode="numeric"
                  pattern="\d{10}"
                  required
                />
                <Input
                  label="Teléfono"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  pattern="\+?\d{7,15}"
                  required
                />
              </>
            )}
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
            <Input
              label="Contraseña"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {register && (
              <Input
                label="Confirmar contraseña"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            )}
            {(error || auth.error) && (
              <p role="alert" aria-live="assertive" className="form-error">
                {error || auth.error}
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
            <Button type="submit" size="lg" disabled={auth.loading}>
              {auth.loading
                ? "Procesando…"
                : register
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
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
            Conexión segura con API V2.
          </div>
        </div>
      </div>
      <Modal open={!!modal} title={modal} onClose={() => setModal("")}>
        <p>Contacta al administrador para recuperar tu acceso.</p>
        <Button onClick={() => setModal("")}>Entendido</Button>
      </Modal>
    </div>
  );
}
