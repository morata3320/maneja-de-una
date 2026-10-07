import { Card, PageHeader } from "../components/ui";
import { useAuth } from "../controllers/AuthContext";
export function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return <><PageHeader title="Mi perfil" description="Datos de tu cuenta." /><Card className="settings-card"><p><strong>Nombre:</strong> {user.firstName} {user.lastName}</p><p><strong>Correo:</strong> {user.email}</p><p><strong>Cédula:</strong> {user.cedula ?? "—"}</p><p><strong>Teléfono:</strong> {user.phone ?? "—"}</p><p><strong>Estado:</strong> {user.status}</p></Card></>;
}
