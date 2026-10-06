import { useState } from "react";
import { Link } from "react-router-dom";
import { reservations } from "../mocks/reservations";
import { vehicles } from "../mocks/vehicles";
import { Badge, Button, EmptyState, Modal, PageHeader } from "../components/ui";
import { Icon } from "../components/ui/Icon";
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={
        status === "Confirmada" || status === "Activo"
          ? "success"
          : status === "Pendiente"
            ? "warning"
            : status === "Cancelada" || status === "Inactivo"
              ? "danger"
              : "neutral"
      }
    >
      {status}
    </Badge>
  );
}
export function Reservations() {
  const [tab, setTab] = useState("Próximas");
  const [selected, setSelected] = useState("");
  const items = reservations.filter((r) =>
    tab === "Próximas"
      ? ["Confirmada", "Pendiente"].includes(r.status)
      : r.status === (tab === "Completadas" ? "Completada" : "Cancelada"),
  );
  const current = reservations.find((r) => r.id === selected);
  return (
    <>
      <PageHeader
        title="Mis reservas"
        description="Tus próximos caminos, en un solo lugar."
      />
      <div className="tabs" role="tablist" aria-label="Estado de reservas">
        {["Próximas", "Completadas", "Canceladas"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="reservation-list">
        {items.map((r) => {
          const v = vehicles.find((v) => v.id === r.vehicleId)!;
          return (
            <article className="reservation-card card" key={r.id}>
              <div
                className="reservation-image"
                style={{ background: v.color }}
              >
                <img src={v.image} alt={`${v.brand} ${v.model}`} />
              </div>
              <div className="reservation-body">
                <div className="reservation-top">
                  <span className="eyebrow">{r.id}</span>
                  <StatusBadge status={r.status} />
                </div>
                <h2>
                  {v.brand} {v.model}
                </h2>
                <p>
                  <Icon name="calendar" size={16} />
                  {r.start} → {r.end}
                </p>
                <p>
                  <Icon name="pin" size={16} />
                  {r.pickup}
                </p>
                <div className="reservation-bottom">
                  <span>
                    Total <strong>${r.total}</strong>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(r.id)}
                  >
                    Ver detalles <Icon name="arrow" size={16} />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
        {!items.length && (
          <EmptyState icon="calendar" title="Todavía no hay viajes por aquí.">
            <Link to="/vehiculos" className="btn btn-primary">
              Explorar autos
            </Link>
          </EmptyState>
        )}
      </div>
      <Modal
        open={!!current}
        title={`Reserva ${current?.id ?? ""}`}
        onClose={() => setSelected("")}
      >
        {current && (
          <>
            <StatusBadge status={current.status} />
            <h3>{vehicles.find((v) => v.id === current.vehicleId)?.model}</h3>
            <p>
              {current.start} → {current.end}
            </p>
            <p>{current.pickup}</p>
            <p>
              Total: <strong>${current.total}</strong>
            </p>
            <p className="demo-note">
              Reserva de ejemplo. Los cambios y cancelaciones se habilitarán con
              el servicio de reservas.
            </p>
            <Button onClick={() => setSelected("")}>Cerrar detalles</Button>
          </>
        )}
      </Modal>
    </>
  );
}
