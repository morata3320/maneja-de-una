import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { vehicles } from "../mocks/vehicles";
import { VehicleArt, VehicleCard } from "../components/vehicle/VehicleCard";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  PriceDisplay,
  Rating,
  SectionHeader,
  Select,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useExperience } from "../components/LocalExperience";
import { pickupLocations } from "../mocks/locations";
export function VehicleDetail() {
  const { id } = useParams();
  const vehicle = vehicles.find((v) => v.id === id);
  const [angle, setAngle] = useState(0);
  const [start, setStart] = useState("2026-10-12");
  const [end, setEnd] = useState("2026-10-15");
  const [open, setOpen] = useState(false);
  const { favorites, comparison, toggleFavorite, toggleCompare } =
    useExperience();
  if (!vehicle)
    return (
      <EmptyState
        title="Ese auto no está en el catálogo."
        description="Encuentra otra opción para tu próximo viaje."
      >
        <Link className="btn btn-primary" to="/vehiculos">
          Explorar autos
        </Link>
      </EmptyState>
    );
  const days = Math.ceil((Date.parse(end) - Date.parse(start)) / 86400000);
  const valid = Number.isFinite(days) && days > 0;
  const specs = [
    ["gear", "Transmisión", vehicle.transmission],
    ["fuel", "Combustible", vehicle.fuel],
    ["users", "Pasajeros", vehicle.seats],
    ["car", "Puertas", vehicle.doors],
    ["bag", "Maletero", `${vehicle.bags} maletas`],
    ["calendar", "Año", vehicle.year],
  ];
  return (
    <div className="container section detail-page">
      <nav className="breadcrumb" aria-label="Ubicación">
        <Link to="/">Inicio</Link>
        <Icon name="chevron" size={13} />
        <Link to="/vehiculos">Autos</Link>
        <Icon name="chevron" size={13} />
        <span>
          {vehicle.brand} {vehicle.model}
        </span>
      </nav>
      <div className="detail-heading">
        <div>
          <Badge tone="blue">
            {vehicle.category} · {vehicle.year}
          </Badge>
          <h1>
            {vehicle.brand} {vehicle.model}
          </h1>
          <div className="inline-meta">
            <Rating value={vehicle.rating} reviews={vehicle.reviews} />
            <span>
              <Icon name="pin" size={16} />
              {vehicle.location}, Ecuador
            </span>
          </div>
        </div>
        <div className="inline-actions">
          <Button
            variant="outline"
            aria-pressed={favorites.includes(id!)}
            onClick={() => toggleFavorite(id!)}
          >
            <Icon name="heart" />
            {favorites.includes(id!) ? "Guardado" : "Guardar"}
          </Button>
          <Button
            variant="outline"
            aria-pressed={comparison.includes(id!)}
            onClick={() => toggleCompare(id!)}
          >
            <Icon name="compare" />
            {comparison.includes(id!) ? "Comparando" : "Comparar"}
          </Button>
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <div className={`detail-gallery angle-${angle}`}>
            <VehicleArt vehicle={vehicle} />
            <span className="gallery-label">
              {
                ["Vista lateral", "Detalle de carrocería", "Vista ampliada"][
                  angle
                ]
              }
            </span>
          </div>
          <div className="gallery-thumbs">
            {["Vista lateral", "Carrocería", "Acercamiento"].map((name, i) => (
              <button
                className={angle === i ? "selected" : ""}
                aria-pressed={angle === i}
                onClick={() => setAngle(i)}
                key={name}
              >
                <img src={vehicle.image} alt={name} />
                <span>{name}</span>
              </button>
            ))}
          </div>
          <section className="detail-section">
            <SectionHeader title="Todo lo que necesitas saber" />
            <div className="spec-grid">
              {specs.map(([icon, label, value]) => (
                <div key={label}>
                  <Icon name={String(icon)} size={24} />
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>Sobre este auto</h2>
            <p>{vehicle.description}</p>
            <h3>Comodidad que va contigo</h3>
            <div className="included">
              {[
                "Aire acondicionado",
                "Conexión Bluetooth",
                "Entrada USB",
                "Cámara de reversa",
              ].map((text) => (
                <span key={text}>
                  <Icon name="check" size={17} />
                  {text}
                </span>
              ))}
            </div>
            <p className="demo-note">
              Equipamiento e ilustraciones de referencia. Se confirmarán al
              conectar el catálogo real.
            </p>
          </section>
        </div>
        <aside>
          <form
            className="booking-card card"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) setOpen(true);
            }}
          >
            <span className="eyebrow">TU PRÓXIMO VIAJE</span>
            <PriceDisplay price={vehicle.pricePerDay} />
            <p>Un buen plan empieza con un buen auto.</p>
            <Select label="Lugar de recogida">
              {pickupLocations
                .filter((l) => l.includes(vehicle.location))
                .map((l) => (
                  <option key={l}>{l}</option>
                ))}
            </Select>
            <Input
              label="Recogida"
              type="date"
              value={start}
              required
              onChange={(e) => setStart(e.target.value)}
            />
            <Input
              label="Devolución"
              type="date"
              min={start}
              value={end}
              required
              onChange={(e) => setEnd(e.target.value)}
            />
            <div className="price-summary">
              <span>
                ${vehicle.pricePerDay} × {valid ? days : "—"} días
              </span>
              <span>{valid ? `$${vehicle.pricePerDay * days}` : "—"}</span>
            </div>
            <div className="price-summary total">
              <strong>Total estimado</strong>
              <strong>{valid ? `$${vehicle.pricePerDay * days}` : "—"}</strong>
            </div>
            {!valid && (
              <p className="form-error">
                La devolución debe ser posterior a la recogida.
              </p>
            )}
            <Button size="lg" type="submit" disabled={!valid}>
              Reservar ahora <Icon name="arrow" />
            </Button>
            <small>
              <Icon name="shield" size={14} />
              Sin cobros en esta demostración
            </small>
          </form>
        </aside>
      </div>
      <section className="section">
        <SectionHeader
          title="También te puede interesar"
          description="Más opciones para encontrar tu próximo compañero."
        />
        <div className="vehicle-grid">
          {vehicles
            .filter((v) => v.id !== vehicle.id)
            .slice(0, 3)
            .map((v) => (
              <VehicleCard vehicle={v} key={v.id} />
            ))}
        </div>
      </section>
      <Modal
        title="Tu viaje toma forma"
        open={open}
        onClose={() => setOpen(false)}
      >
        <Badge tone="blue">Vista previa</Badge>
        <h3>
          {vehicle.brand} {vehicle.model}
        </h3>
        <p>
          {start} → {end} · {days} días
        </p>
        <p className="modal-total">
          Total estimado: <strong>${days * vehicle.pricePerDay}</strong>
        </p>
        <p>
          Esta es una demostración visual. No se ha creado una reserva ni
          realizado un cobro.
        </p>
        <Button onClick={() => setOpen(false)}>Seguir explorando</Button>
      </Modal>
    </div>
  );
}
