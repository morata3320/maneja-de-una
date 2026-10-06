import { Link } from "react-router-dom";
import type { Vehicle } from "../../types/vehicle";
import { useExperience } from "../LocalExperience";
import { Badge, Button, Checkbox, PriceDisplay, Rating } from "../ui";
import { Icon } from "../ui/Icon";
export function VehicleArt({
  vehicle,
  className = "",
}: {
  vehicle: Vehicle;
  className?: string;
}) {
  return (
    <div
      className={`vehicle-art ${className}`}
      style={{ backgroundColor: vehicle.color }}
    >
      <img
        src={vehicle.image}
        alt={`Ilustración de referencia ${vehicle.category}: ${vehicle.brand} ${vehicle.model}`}
        loading="lazy"
      />
      <span className="art-caption">Ilustración de referencia</span>
    </div>
  );
}
export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const { favorites, comparison, toggleFavorite, toggleCompare } =
    useExperience();
  const saved = favorites.includes(vehicle.id);
  return (
    <article className="vehicle-card">
      <div className="vehicle-cover">
        <Link
          to={`/vehiculos/${vehicle.id}`}
          aria-label={`Ver ${vehicle.brand} ${vehicle.model}`}
        >
          <VehicleArt vehicle={vehicle} />
        </Link>
        <Badge>{vehicle.category}</Badge>
        <Button
          variant="ghost"
          className={`favorite-btn ${saved ? "active" : ""}`}
          aria-label={`${saved ? "Quitar" : "Agregar"} ${vehicle.brand} ${vehicle.model} ${saved ? "de" : "a"} favoritos`}
          aria-pressed={saved}
          onClick={() => toggleFavorite(vehicle.id)}
        >
          <Icon name="heart" />
        </Button>
      </div>
      <div className="vehicle-card-body">
        <div className="vehicle-title">
          <h3>
            <Link to={`/vehiculos/${vehicle.id}`}>
              {vehicle.brand} {vehicle.model}
            </Link>
          </h3>
          <span>{vehicle.year}</span>
        </div>
        <div className="card-location">
          <Icon name="pin" size={14} />
          {vehicle.location}
          <Rating value={vehicle.rating} />
        </div>
        <div className="vehicle-specs">
          <span>
            <Icon name="gear" size={16} />
            {vehicle.transmission}
          </span>
          <span>
            <Icon name="fuel" size={16} />
            {vehicle.fuel}
          </span>
          <span>
            <Icon name="users" size={16} />
            {vehicle.seats}
          </span>
        </div>
        <div className="card-price">
          <PriceDisplay price={vehicle.pricePerDay} />
          <Link
            className="btn btn-outline btn-sm"
            to={`/vehiculos/${vehicle.id}`}
          >
            Ver auto <Icon name="arrow" size={16} />
          </Link>
        </div>
        <Checkbox
          label="Comparar"
          checked={comparison.includes(vehicle.id)}
          onChange={() => toggleCompare(vehicle.id)}
        />
      </div>
    </article>
  );
}
