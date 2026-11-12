import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
} from "../components/ui";
import { api } from "../services/apiClient";
import type { Reservation } from "../models";
import {
  getVehicleImage,
  getVehiclePlaceholder,
} from "../controllers/useVehiclesController";

type CancellationResult = {
  order_id: string;
  pnr: string;
  status: "CANCELLED";
  refund: {
    refund_id: string;
    amount: number;
    currency: string;
    percentage: number;
    status: string;
  };
  inventory_restoration: {
    status: string;
    new_state: string;
    message: string;
  };
};

type CancellationRequest = {
  reservation: Reservation;
  idempotencyKey: string;
  correlationId: string;
  submitting: boolean;
  error: string;
};

const autosV3Base = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v2"
)
  .replace(/\/$/, "")
  .replace(/\/api\/v2$/, "/api/v3");
const cancellationWindowMs = 24 * 60 * 60 * 1000;

export function cancellationEligibility(
  reservation: Pick<Reservation, "status" | "startsAt" | "deliveredAt">,
  now = Date.now(),
) {
  if (reservation.deliveredAt || reservation.status === "COMPLETED")
    return "IN_PROGRESS" as const;
  if (reservation.status !== "CONFIRMED") return "UNAVAILABLE" as const;
  const pickup = new Date(reservation.startsAt).getTime();
  if (!Number.isFinite(pickup) || pickup - now < cancellationWindowMs)
    return "DEADLINE_EXPIRED" as const;
  return "ALLOWED" as const;
}

export function MyReservations() {
  const [rows, setRows] = useState<Reservation[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [cancellation, setCancellation] =
      useState<CancellationRequest | null>(null),
    [cancellationResult, setCancellationResult] =
      useState<CancellationResult | null>(null);
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

  function openCancellation(reservation: Reservation) {
    setCancellation({
      reservation,
      idempotencyKey: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      submitting: false,
      error: "",
    });
  }

  async function confirmCancellation() {
    if (!cancellation || cancellation.submitting) return;
    setCancellation((current) =>
      current ? { ...current, submitting: true, error: "" } : current,
    );
    try {
      const result = await api<CancellationResult>({
        method: "POST",
        url: `${autosV3Base}/autos/orders/${cancellation.reservation.id}/cancel`,
        headers: {
          "Idempotency-Key": cancellation.idempotencyKey,
          "X-Correlation-Id": cancellation.correlationId,
        },
        data: { reason: "Cancelación solicitada por el cliente" },
      });
      setCancellationResult(result);
      setCancellation(null);
      await load();
    } catch (reason) {
      setCancellation((current) =>
        current
          ? {
              ...current,
              submitting: false,
              error:
                reason instanceof Error
                  ? reason.message
                  : "No fue posible cancelar la reserva",
            }
          : current,
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
        {rows.map((r) => {
          const eligibility = cancellationEligibility(r);
          return (
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
              {eligibility === "ALLOWED" && (
                <Button variant="outline" onClick={() => openCancellation(r)}>
                  Cancelar renta
                </Button>
              )}
              {eligibility === "DEADLINE_EXPIRED" && (
                <p className="reservation-policy" role="status">
                  Cancelación no disponible (menos de 24h antes del retiro del
                  vehículo). La política de cancelación gratuita aplica hasta
                  24h antes.
                </p>
              )}
              {eligibility === "IN_PROGRESS" && (
                <p className="reservation-policy" role="status">
                  Vehículo entregado / Alquiler en curso (No cancelable)
                </p>
              )}
            </Card>
          );
        })}
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
      <Modal
        open={Boolean(cancellation)}
        title="Confirmar cancelación de renta"
        onClose={() => {
          if (!cancellation?.submitting) setCancellation(null);
        }}
      >
        {cancellation && (
          <div className="cancellation-modal">
            <p>
              Se anulará la reserva{" "}
              <strong>{cancellation.reservation.id}</strong>.
            </p>
            <p>
              El vehículo volverá a estar disponible para los períodos
              elegibles y se procesará el reembolso simulado del 100%.
            </p>
            {cancellation.error && (
              <p className="form-error" role="alert">
                {cancellation.error}
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="ghost"
                disabled={cancellation.submitting}
                onClick={() => setCancellation(null)}
              >
                Volver
              </Button>
              <Button
                disabled={cancellation.submitting}
                onClick={() => void confirmCancellation()}
              >
                {cancellation.submitting
                  ? "Procesando…"
                  : "Confirmar cancelación"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(cancellationResult)}
        title="¡Cancelación y Reembolso Exitosos!"
        onClose={() => setCancellationResult(null)}
      >
        {cancellationResult && (
          <div className="cancellation-summary">
            <p>
              Código de reembolso:{" "}
              <strong>{cancellationResult.refund.refund_id}</strong>
            </p>
            <p>
              Monto reembolsado:{" "}
              <strong>
                ${Number(cancellationResult.refund.amount).toFixed(2)}{" "}
                {cancellationResult.refund.currency}
              </strong>
            </p>
            <p>
              Porcentaje:{" "}
              <strong>{cancellationResult.refund.percentage}%</strong>
            </p>
            <p>
              Estado: <strong>{cancellationResult.refund.status}</strong>
            </p>
            <p>
              Inventario:{" "}
              <strong>{cancellationResult.inventory_restoration.status}</strong>
              {` · ${cancellationResult.inventory_restoration.new_state}`}
            </p>
            <Button onClick={() => setCancellationResult(null)}>Cerrar</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
