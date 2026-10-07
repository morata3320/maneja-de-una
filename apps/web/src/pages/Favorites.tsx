import { Link } from "react-router-dom";
import { useExperience } from "../components/LocalExperience";
import { useVehiclesController } from "../controllers/useVehiclesController";
import { VehicleCard } from "../components/vehicle/VehicleCard";
import { EmptyState, PageHeader } from "../components/ui";
export function Favorites() {
  const { favorites } = useExperience();
  const { vehicles } = useVehiclesController("?limit=100");
  const items = vehicles.filter((v) => favorites.includes(v.id));
  return (
    <div className="container section">
      <PageHeader
        eyebrow="LOS QUE VAN CONTIGO"
        title="Mis favoritos"
        description={`${items.length} autos guardados para ese próximo plan.`}
      />
      {items.length ? (
        <div className="vehicle-grid">
          {items.map((v) => (
            <VehicleCard vehicle={v} key={v.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="heart"
          title="Aún no guardaste ningún auto."
          description="Toca el corazón de los autos que te gustan y encuéntralos aquí."
        >
          <Link className="btn btn-primary" to="/vehiculos">
            Explorar autos
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
