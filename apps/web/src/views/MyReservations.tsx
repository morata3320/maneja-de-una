import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui";
import { api } from "../services/apiClient";
import type { Reservation } from "../models";
import {
  getVehicleImage,
  getVehiclePlaceholder,
} from "../controllers/useVehiclesController";
export function MyReservations() {
  const [rows, setRows] = useState<Reservation[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError("");
    return api<{ data: Reservation[] }>({ url: "/reservations/my" })
      .then((r) => setRows(r.data))
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "No fue posible cargar las reservas",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
  }, []);
  async function cancel(id: string) {
    setError("");
    try {
      await api({ method: "POST", url: `/reservations/${id}/cancel` });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cancelar la reserva",
      );
    }
  }
  return (
    <>
      <PageHeader
        title="Mis reservas"
        description="Tus próximos caminos, en un solo lugar."
      />
      <div className="reservation-list">
        {loading && <p role="status">Cargando reservas…</p>}
        {rows.map((r) => (
          <Card className="reservation-body" key={r.id}>
            {r.vehicle?.brand && r.vehicle.model && (
              <img
                className="reservation-vehicle-image"
                src={getVehicleImage(r.vehicle.brand, r.vehicle.model)}
                alt={`${r.vehicle.brand} ${r.vehicle.model}`}
                loading="lazy"
                onError={(event) => {
                  const fallback = getVehiclePlaceholder("Sedan");
                  if (event.currentTarget.src.endsWith(fallback)) return;
                  event.currentTarget.src = fallback;
                }}
              />
            )}
            <Badge
              tone={
                ["CONFIRMED", "COMPLETED"].includes(r.status)
                  ? "success"
                  : r.status === "PENDING"
                    ? "warning"
                    : "danger"
              }
            >
              {(
                {
                  PENDING: "Pendiente",
                  CONFIRMED: "Confirmada",
                  CANCELLED: "Cancelada",
                  COMPLETED: "Completada",
                } as Record<string, string>
              )[r.status] ?? r.status}
            </Badge>
            <h2>{r.vehicle?.name || `Reserva ${r.id.slice(0, 8)}`}</h2>
            <p>
              {new Date(r.startsAt).toLocaleDateString()} →{" "}
              {new Date(r.endsAt).toLocaleDateString()}
            </p>
            <p>
              Lugar de recogida:{" "}
              <strong>{r.pickupLocation || "No registrado"}</strong>
            </p>
            <p>
              Total:{" "}
              <strong>
                ${Number(r.totalAmount).toFixed(2)} {r.currency}
              </strong>
            </p>
            <p>
              Pago: <strong>{r.payment?.status || "Pendiente"}</strong>
              {r.payment?.paymentReference && (
                <> · {r.payment.paymentReference}</>
              )}
            </p>
            {["PENDING", "CONFIRMED"].includes(r.status) && (
              <Button variant="outline" onClick={() => void cancel(r.id)}>
                Cancelar
              </Button>
            )}
          </Card>
        ))}
        {!loading && !rows.length && !error && (
          <EmptyState title="Todavía no hay reservas.">
            <Link className="btn btn-primary" to="/vehiculos">
              Explorar autos
            </Link>
          </EmptyState>
        )}
        {error && (
          <div className="error-state" role="alert">
            <p className="form-error">{error}</p>
            <Button onClick={() => void load()}>Reintentar</Button>
          </div>
        )}
      </div>
    </>
  );
}
