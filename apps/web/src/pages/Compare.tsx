import { Link } from "react-router-dom";
import { useExperience } from "../components/LocalExperience";
import { vehicles } from "../mocks/vehicles";
import {
  Button,
  EmptyState,
  PageHeader,
  PriceDisplay,
  Rating,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { VehicleArt } from "../components/vehicle/VehicleCard";
export function Compare() {
  const { comparison, toggleCompare } = useExperience();
  const selected = vehicles.filter((v) => comparison.includes(v.id));
  return (
    <div className="container section">
      <PageHeader
        eyebrow="ELIGE CON CONFIANZA"
        title="Encuentra tu mejor match"
        description="Hasta 3 autos, lado a lado. Lo que importa, de un vistazo."
        action={
          <Link className="btn btn-outline" to="/vehiculos">
            <Icon name="plus" />
            Agregar auto
          </Link>
        }
      />
      {!selected.length ? (
        <EmptyState
          icon="compare"
          title="Cada plan tiene su auto ideal."
          description="Selecciona hasta 3 autos del catálogo para comparar sus características."
        >
          <Link className="btn btn-primary" to="/vehiculos">
            Explorar autos <Icon name="arrow" />
          </Link>
          <Button
            variant="outline"
            onClick={() => toggleCompare("toyota-rav4")}
          >
            Empezar con Toyota RAV4
          </Button>
        </EmptyState>
      ) : (
        <div
          className="comparison-scroll"
          tabIndex={0}
          aria-label="Comparación de vehículos; desplaza horizontalmente en móvil"
        >
          <table className="comparison-table">
            <thead>
              <tr>
                <th>
                  <span className="eyebrow">LO QUE VA CONTIGO</span>
                  <h2>
                    Decidir,
                    <br />
                    más fácil.
                  </h2>
                  <p>{selected.length} de 3 autos</p>
                </th>
                {selected.map((v) => (
                  <th key={v.id}>
                    <Button
                      variant="ghost"
                      className="remove-compare"
                      aria-label={`Quitar ${v.model}`}
                      onClick={() => toggleCompare(v.id)}
                    >
                      <Icon name="close" size={18} />
                    </Button>
                    <VehicleArt vehicle={v} />
                    <h3>
                      {v.brand} {v.model}
                    </h3>
                    <PriceDisplay price={v.pricePerDay} />
                    <Link
                      className="btn btn-primary btn-sm"
                      to={`/vehiculos/${v.id}`}
                    >
                      Ver auto <Icon name="arrow" size={15} />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  "Categoría",
                  "Transmisión",
                  "Combustible",
                  "Pasajeros",
                  "Puertas",
                  "Ubicación",
                  "Valoración",
                ] as const
              ).map((label, i) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {selected.map((v) => (
                    <td key={v.id}>
                      {
                        [
                          v.category,
                          v.transmission,
                          v.fuel,
                          v.seats,
                          v.doors,
                          v.location,
                          <Rating value={v.rating} key="rating" />,
                        ][i]
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
