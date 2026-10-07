import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui";
import { api } from "../services/apiClient";
import type { Reservation } from "../models";
export function MyReservations() {
  const [rows, setRows] = useState<Reservation[]>([]),
    [error, setError] = useState("");
  const load = () =>
    api<{ data: Reservation[] }>({ url: "/reservations/my" })
      .then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  useEffect(() => {
    void load();
  }, []);
  async function cancel(id: string) {
    await api({ method: "POST", url: `/reservations/${id}/cancel` });
    void load();
  }
  return (
    <>
      <PageHeader
        title="Mis reservas"
        description="Tus próximos caminos, en un solo lugar."
      />
      <div className="reservation-list">
        {rows.map((r) => (
          <Card className="reservation-body" key={r.id}>
            <Badge
              tone={
                r.status === "CONFIRMED"
                  ? "success"
                  : r.status === "PENDING"
                    ? "warning"
                    : "danger"
              }
            >
              {r.status}
            </Badge>
            <h2>Reserva {r.id.slice(0, 8)}</h2>
            <p>
              {new Date(r.startsAt).toLocaleDateString()} →{" "}
              {new Date(r.endsAt).toLocaleDateString()}
            </p>
            <p>
              Total:{" "}
              <strong>
                ${Number(r.totalAmount).toFixed(2)} {r.currency}
              </strong>
            </p>
            {["PENDING", "CONFIRMED"].includes(r.status) && (
              <Button variant="outline" onClick={() => void cancel(r.id)}>
                Cancelar
              </Button>
            )}
          </Card>
        ))}
        {!rows.length && !error && (
          <EmptyState title="Todavía no hay reservas.">
            <Link className="btn btn-primary" to="/vehiculos">
              Explorar autos
            </Link>
          </EmptyState>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </>
  );
}
