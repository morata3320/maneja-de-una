import { useState } from "react";
import { Link } from "react-router-dom";
import { vehicles } from "../mocks/vehicles";
import { dashboardStats, reservations, users } from "../mocks/reservations";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { StatusBadge } from "./Reservations";
import { useExperience } from "../components/LocalExperience";
export function AdminDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="MIÉRCOLES, 30 DE SEPTIEMBRE"
        title="Todo listo para seguir moviéndote."
        description="Este es el resumen de tu operación. Datos de ejemplo."
        action={
          <Link className="btn btn-primary" to="/admin/vehiculos">
            <Icon name="car" />
            Ver vehículos
          </Link>
        }
      />
      <div className="kpi-grid">
        {dashboardStats.map((s) => (
          <Card key={s.label} className="kpi">
            <div>
              <span>{s.label}</span>
              <Icon name={s.icon} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </Card>
        ))}
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Reservas recientes</h2>
              <p>Los próximos planes ya están en marcha.</p>
            </div>
            <Link className="text-link" to="/admin/reservas">
              Ver todas <Icon name="arrow" size={16} />
            </Link>
          </div>
          <ReservationTable rows={reservations.slice(0, 3)} />
        </Card>
        <Card className="fleet-panel">
          <h2>Estado de flota</h2>
          <p>Una vista rápida de tus vehículos.</p>
          <div className="fleet-donut">
            <span>
              <strong>16</strong>vehículos
            </span>
          </div>
          <div className="fleet-legend">
            <span>
              <i />
              Disponibles <strong>14</strong>
            </span>
            <span>
              <i />
              Mantenimiento <strong>1</strong>
            </span>
            <span>
              <i />
              Inactivos <strong>1</strong>
            </span>
          </div>
        </Card>
      </div>
      <div className="admin-callout">
        <Icon name="shield" size={28} />
        <div>
          <h3>Todo en un mismo lugar</h3>
          <p>Gestiona tus autos, revisa reservas y conoce a tus clientes.</p>
        </div>
        <Link className="text-link" to="/admin/usuarios">
          Ver usuarios <Icon name="arrow" />
        </Link>
      </div>
    </>
  );
}
function ReservationTable({
  rows,
  onDetails,
}: {
  rows: typeof reservations;
  onDetails?: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Reserva / Cliente</th>
            <th>Vehículo</th>
            <th>Fechas</th>
            <th>Total</th>
            <th>Estado</th>
            {onDetails && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.id}</strong>
                <small>{r.customer}</small>
              </td>
              <td>{vehicles.find((v) => v.id === r.vehicleId)?.model}</td>
              <td>
                <span>{r.start}</span>
                <small>{r.end}</small>
              </td>
              <td>
                <strong>${r.total}</strong>
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              {onDetails && (
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDetails(r.id)}
                  >
                    Ver detalles
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="No hay reservas con esos filtros." />}
    </div>
  );
}
export function AdminVehicles() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [modal, setModal] = useState("");
  const { notify } = useExperience();
  const rows = vehicles.filter(
    (v) =>
      `${v.brand} ${v.model}`.toLowerCase().includes(search.toLowerCase()) &&
      (!category || v.category === category),
  );
  return (
    <>
      <PageHeader
        title="Vehículos"
        description="Cada auto, listo para su próximo recorrido."
        action={
          <Button onClick={() => setModal("Nuevo vehículo")}>
            <Icon name="plus" />
            Nuevo vehículo
          </Button>
        }
      />
      <Card>
        <div className="admin-toolbar">
          <Input
            label="Buscar vehículo"
            placeholder="Marca o modelo…"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas</option>
            {["SUV", "Sedán", "Pickup", "Hatchback"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <span>{rows.length} vehículos</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "Auto",
                  "Marca",
                  "Categoría",
                  "Ubicación",
                  "Precio / día",
                  "Estado",
                  "Acciones",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="table-car">
                      <img
                        src={v.image}
                        alt=""
                        style={{ background: v.color }}
                      />
                      <span>
                        <strong>{v.model}</strong>
                        <small>{v.year}</small>
                      </span>
                    </div>
                  </td>
                  <td>{v.brand}</td>
                  <td>{v.category}</td>
                  <td>{v.location}</td>
                  <td>
                    <strong>${v.pricePerDay}</strong>
                  </td>
                  <td>
                    <StatusBadge status="Activo" />
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${v.model}`}
                        onClick={() => setModal(`Editar ${v.brand} ${v.model}`)}
                      >
                        <Icon name="edit" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setModal(`Desactivar ${v.brand} ${v.model}`)
                        }
                      >
                        Desactivar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="No encontramos ese vehículo." />}
        </div>
        <div className="table-footer">
          Mostrando {rows.length} de {vehicles.length} vehículos · Datos de
          demostración
        </div>
      </Card>
      <Modal open={!!modal} onClose={() => setModal("")} title={modal}>
        {modal.startsWith("Desactivar") ? (
          <>
            <p>
              Esta acción es sólo una vista previa. No se modificará el
              vehículo.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setModal("");
                notify("Vista previa completada. El vehículo sigue activo.");
              }}
            >
              Confirmar vista previa
            </Button>
          </>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              setModal("");
              notify("Formulario revisado. No se guardaron cambios reales.");
            }}
          >
            <Input
              label="Marca y modelo"
              placeholder="Ej. Toyota RAV4"
              required
            />
            <Input
              label="Precio por día"
              type="number"
              min="1"
              placeholder="68"
              required
            />
            <Select label="Ubicación">
              <option>Quito</option>
              <option>Guayaquil</option>
              <option>Cuenca</option>
            </Select>
            <p className="demo-note">
              Formulario visual. No se crea ni edita inventario.
            </p>
            <Button type="submit">Revisar vehículo</Button>
          </form>
        )}
      </Modal>
    </>
  );
}
export function AdminReservations() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const current = reservations.find((r) => r.id === selected);
  const rows = reservations.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.id} ${r.customer}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Reservas"
        description="Una visión clara de cada viaje."
      />
      <Card>
        <div className="admin-toolbar">
          <Input
            label="Buscar reserva"
            type="search"
            placeholder="ID o cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {["Confirmada", "Pendiente", "Completada", "Cancelada"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <ReservationTable rows={rows} onDetails={setSelected} />
      </Card>
      <Modal
        open={!!current}
        title={`Reserva ${selected}`}
        onClose={() => setSelected("")}
      >
        {current && (
          <>
            <StatusBadge status={current.status} />
            <h3>{current.customer}</h3>
            <p>
              {current.start} → {current.end}
            </p>
            <p>{current.pickup}</p>
            <p>Total: ${current.total}</p>
            <p className="demo-note">
              Información de ejemplo. No se realizan cambios reales.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState("");
  const current = users.find((u) => u.id === selected);
  const rows = users.filter(
    (u) =>
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()) &&
      (!role || u.role === role),
  );
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Las personas detrás de cada recorrido."
      />
      <Card>
        <div className="admin-toolbar">
          <Input
            label="Buscar usuario"
            type="search"
            placeholder="Nombre o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Rol"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Todos</option>
            <option>Cliente</option>
            <option>Administrador</option>
          </Select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "Nombre",
                  "Correo",
                  "Rol",
                  "Estado",
                  "Fecha de registro",
                  "Acciones",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-name">
                      <span className="avatar">
                        {u.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <strong>{u.name}</strong>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Badge
                      tone={u.role === "Administrador" ? "blue" : "neutral"}
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td>
                    <StatusBadge status={u.active ? "Activo" : "Inactivo"} />
                  </td>
                  <td>{u.date}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelected(u.id)}
                    >
                      Ver perfil
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="No encontramos usuarios." />}
        </div>
      </Card>
      <Modal
        open={!!current}
        title="Perfil de usuario"
        onClose={() => setSelected("")}
      >
        {current && (
          <>
            <h3>{current.name}</h3>
            <p>{current.email}</p>
            <Badge tone="blue">{current.role}</Badge>
            <p>Registro: {current.date}</p>
            <p className="demo-note">Perfil de demostración.</p>
          </>
        )}
      </Modal>
    </>
  );
}
export function AdminSettings() {
  const { notify } = useExperience();
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Tu espacio de trabajo, a tu manera."
      />
      <Card className="settings-card">
        <h2>Información de la plataforma</h2>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            notify(
              "Preferencias revisadas. Esta demostración no guarda configuración.",
            );
          }}
        >
          <Input label="Nombre comercial" defaultValue="Maneja de Una" />
          <Select label="Moneda">
            <option>USD — Dólar estadounidense</option>
          </Select>
          <Select label="Idioma">
            <option>Español</option>
          </Select>
          <p className="demo-note">
            Configuración de muestra. No afecta al sistema real.
          </p>
          <Button type="submit">Revisar preferencias</Button>
        </form>
      </Card>
    </>
  );
}
