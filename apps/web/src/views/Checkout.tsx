import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "../components/ui";
import { api } from "../services/apiClient";
import type { ApiVehicle } from "../models";
type ReservationResponse = {
  id: string;
  totalAmount: number;
  currency: string;
  status: string;
};
export function Checkout() {
  const { vehicleId } = useParams(),
    [params] = useSearchParams(),
    [vehicle, setVehicle] = useState<ApiVehicle | null>(null),
    [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reservation, setReservation] = useState<ReservationResponse | null>(null),
    [confirmation, setConfirmation] = useState<{
      paymentReference: string;
      amount: number;
      currency: string;
      status: string;
      card: { brand: string; last4: string };
    } | null>(null);
  const [startDate, setStart] = useState(params.get("start") || ""),
    [endDate, setEnd] = useState(params.get("end") || ""),
    [firstName, setFirst] = useState(""),
    [lastName, setLast] = useState(""),
    [cedula, setCedula] = useState(""),
    [phone, setPhone] = useState(""),
    [cardholderName, setHolder] = useState(""),
    [cardNumber, setNumber] = useState(""),
    [expiryMonth, setMonth] = useState(""),
    [expiryYear, setYear] = useState(""),
    [cvv, setCvv] = useState("");
  const [pickupDepotId, setPickupDepotId] = useState(params.get("depot") || "");
  useEffect(() => {
    api<ApiVehicle>({ url: `/vehicles/${vehicleId}` })
      .then((value) => {
        setVehicle(value);
        setPickupDepotId((current) => {
          const depots = value.pickupDepots ?? [];
          return depots.some((depot) => String(depot.id) === current)
            ? current
            : depots.length
              ? String(depots[0].id)
              : "";
        });
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Vehiculo no encontrado"),
      );
  }, [vehicleId]);
  const days = useMemo(
    () =>
      Math.max(
        0,
        Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86400000),
      ),
    [startDate, endDate],
  );
  const estimated = days * (vehicle?.pricePerDay || 0);
  async function reserve() {
    if (!days || !pickupDepotId) {
      setError("La devolucion debe ser posterior a la recogida.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<ReservationResponse>({
        method: "POST",
        url: "/reservations",
        data: {
          vehicleId,
          startDate,
          endDate,
          pickupDepotId: Number(pickupDepotId),
          driver: { firstName, lastName, cedula, phone },
        },
      });
      setReservation(r);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la reserva");
    } finally {
      setBusy(false);
    }
  }
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ paymentReference: string; amount: number; currency: string; status: string; card: { brand: string; last4: string } }>({
        method: "POST",
        url: "/payments/simulate",
        data: {
          reservationId: reservation.id,
          cardholderName,
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryMonth: Number(expiryMonth),
          expiryYear: Number(expiryYear),
          cvv,
        },
      });
      setConfirmation(result);
      setNumber("");
      setCvv("");
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pago rechazado");
    } finally {
      setBusy(false);
    }
  }
  if (error && !vehicle)
    return (
      <EmptyState title={error}>
        <Link className="btn btn-primary" to="/vehiculos">
          Volver al catalogo
        </Link>
      </EmptyState>
    );
  return (
    <div className="container section checkout">
      <PageHeader
        eyebrow="CHECKOUT SEGURO"
        title="Completa tu reserva"
        description={`Paso ${step} de 4`}
      />
      {vehicle && (
        <Card className="settings-card">
          <Badge tone="blue">
            {vehicle.brand} {vehicle.model}
          </Badge>
          <p>
            {(vehicle.pickupDepots?.find(
              (depot) => String(depot.id) === pickupDepotId,
            )?.location ?? vehicle.location)} · ${vehicle.pricePerDay}/día
          </p>
          {step === 1 && (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (days) setStep(2);
              }}
            >
              <Input
                label="Recogida"
                type="date"
                value={startDate}
                onChange={(e) => setStart(e.target.value)}
                required
              />
              <Select
                label="Lugar de recogida"
                value={pickupDepotId}
                onChange={(event) => setPickupDepotId(event.target.value)}
                required
              >
                <option value="">Selecciona una agencia</option>
                {vehicle.pickupDepots?.map((depot) => (
                  <option value={depot.id} key={depot.id}>
                    {depot.location || depot.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Devolucion"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
              <div className="price-summary total">
                <strong>{days} dias</strong>
                <strong>${estimated.toFixed(2)}</strong>
              </div>
              <Button type="submit" disabled={!days || !pickupDepotId}>
                Continuar
              </Button>
            </form>
          )}
          {step === 2 && (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void reserve();
              }}
            >
              <Input
                label="Nombres"
                value={firstName}
                onChange={(e) => setFirst(e.target.value)}
                minLength={2}
                required
              />
              <Input
                label="Apellidos"
                value={lastName}
                onChange={(e) => setLast(e.target.value)}
                minLength={2}
                required
              />
              <Input
                label="Cédula"
                inputMode="numeric"
                pattern="\d{10}"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                required
              />
              <Input
                label="Teléfono"
                type="tel"
                pattern="\+?\d{7,15}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Creando..." : "Crear reserva"}
              </Button>
            </form>
          )}
          {step === 3 && (
            <form className="stack" onSubmit={pay} autoComplete="off">
              <p>
                El backend confirmó el total:{" "}
                <strong>
                  ${Number(reservation?.totalAmount).toFixed(2)}{" "}
                  {reservation?.currency}
                </strong>
              </p>
              <Input
                label="Nombre en la tarjeta"
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(e) => setHolder(e.target.value)}
                required
              />
              <Input
                label="Número de tarjeta"
                autoComplete="cc-number"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) =>
                  setNumber(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 19)
                      .replace(/(.{4})/g, "$1 ")
                      .trim(),
                  )
                }
                required
              />
              <div className="inline-actions">
                <Input
                  label="Mes"
                  autoComplete="cc-exp-month"
                  inputMode="numeric"
                  value={expiryMonth}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                />
                <Input
                  label="Año"
                  autoComplete="cc-exp-year"
                  inputMode="numeric"
                  value={expiryYear}
                  onChange={(e) => setYear(e.target.value)}
                  required
                />
                <Input
                  label="CVV"
                  autoComplete="cc-csc"
                  type="password"
                  inputMode="numeric"
                  value={cvv}
                  onChange={(e) =>
                    setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  required
                />
              </div>
              <p className="demo-note">
                Pago de demostración. No se realiza ningún cargo bancario real.
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? "Procesando..." : "Confirmar pago simulado"}
              </Button>
            </form>
          )}
          {step === 4 && confirmation && (
            <div className="stack" role="status" aria-live="polite">
              <Badge tone="success">{confirmation.status}</Badge>
              <h2>Tu viaje esta listo.</h2>
              <p>
                Referencia: <strong>{confirmation.paymentReference}</strong>
              </p>
              <p>
                Total: <strong>${confirmation.amount.toFixed(2)} {confirmation.currency}</strong>
              </p>
              <p>Tarjeta: <strong>{confirmation.card.brand} •••• {confirmation.card.last4}</strong></p>
              <Link className="btn btn-primary" to="/mis-reservas">
                Ver mis reservas
              </Link>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
