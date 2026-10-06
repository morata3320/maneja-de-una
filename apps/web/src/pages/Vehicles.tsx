import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { vehicles, categories } from "../mocks/vehicles";
import { locations } from "../mocks/locations";
import { VehicleCard } from "../components/vehicle/VehicleCard";
import {
  Button,
  Checkbox,
  Drawer,
  EmptyState,
  PageHeader,
  Select,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { SearchBar } from "../components/search/SearchBar";
export function Vehicles() {
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [price, setPrice] = useState(100);
  const [brand, setBrand] = useState("");
  const [transmission, setTransmission] = useState("");
  const [fuel, setFuel] = useState("");
  const [seats, setSeats] = useState("");
  const [rating, setRating] = useState("");
  const [sort, setSort] = useState("recommended");
  const category = params.get("categoria") ?? "";
  const place = params.get("lugar") ?? "";
  function param(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }
  function clear() {
    setPrice(100);
    setBrand("");
    setTransmission("");
    setFuel("");
    setSeats("");
    setRating("");
    const next = new URLSearchParams(params);
    next.delete("categoria");
    next.delete("lugar");
    setParams(next);
  }
  const results = vehicles
    .filter(
      (v) =>
        v.pricePerDay <= price &&
        (!category || v.category === category) &&
        (!place || v.location === place) &&
        (!brand || v.brand === brand) &&
        (!transmission || v.transmission === transmission) &&
        (!fuel || v.fuel === fuel) &&
        (!seats || v.seats >= Number(seats)) &&
        (!rating || v.rating >= Number(rating)),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.pricePerDay - b.pricePerDay
        : sort === "high"
          ? b.pricePerDay - a.pricePerDay
          : Number(b.featured) - Number(a.featured),
    );
  const filters = (
    <>
      <div className="filter-heading">
        <h2>Filtros</h2>
        <button className="text-link" onClick={clear}>
          Limpiar
        </button>
      </div>
      <fieldset>
        <legend>Precio por día</legend>
        <div className="range-label">
          <span>$25</span>
          <strong>Hasta ${price}</strong>
        </div>
        <input
          aria-label="Precio máximo por día"
          type="range"
          min="25"
          max="100"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </fieldset>
      <fieldset>
        <legend>Categoría</legend>
        {categories.map((c) => (
          <Checkbox
            key={c.name}
            label={c.name}
            checked={category === c.name}
            onChange={() =>
              param("categoria", category === c.name ? "" : c.name)
            }
          />
        ))}
      </fieldset>
      <Select
        label="Marca"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      >
        <option value="">Todas las marcas</option>
        {[...new Set(vehicles.map((v) => v.brand))].map((b) => (
          <option key={b}>{b}</option>
        ))}
      </Select>
      <Select
        label="Transmisión"
        value={transmission}
        onChange={(e) => setTransmission(e.target.value)}
      >
        <option value="">Cualquiera</option>
        <option>Automática</option>
        <option>Manual</option>
      </Select>
      <Select
        label="Combustible"
        value={fuel}
        onChange={(e) => setFuel(e.target.value)}
      >
        <option value="">Cualquiera</option>
        <option>Gasolina</option>
        <option>Híbrido</option>
        <option>Diésel</option>
      </Select>
      <Select
        label="Pasajeros"
        value={seats}
        onChange={(e) => setSeats(e.target.value)}
      >
        <option value="">Cualquiera</option>
        <option value="5">5 o más</option>
        <option value="7">7 o más</option>
      </Select>
      <Select
        label="Ubicación"
        value={place}
        onChange={(e) => param("lugar", e.target.value)}
      >
        <option value="">Todas las ciudades</option>
        {locations.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </Select>
      <Select
        label="Valoración"
        value={rating}
        onChange={(e) => setRating(e.target.value)}
      >
        <option value="">Todas</option>
        <option value="4.8">4.8 o más</option>
        <option value="4.9">4.9 o más</option>
      </Select>
      <Button variant="outline" onClick={clear}>
        Limpiar filtros
      </Button>
    </>
  );
  return (
    <>
      <div className="catalog-search">
        <div className="container">
          <SearchBar compact />
        </div>
      </div>
      <div className="container section">
        <PageHeader
          eyebrow="EL CAMINO ES TUYO"
          title="Autos disponibles"
          description={`${place || "Quito, Guayaquil y Cuenca"} · ${params.get("recogida") ?? "Elige tus fechas"}${params.get("devolucion") ? ` → ${params.get("devolucion")}` : ""}`}
        />
        <div className="catalog-layout">
          <aside className="filters desktop-filters">{filters}</aside>
          <section>
            <div className="results-toolbar">
              <span>
                <strong>{results.length}</strong> autos para tu próximo plan
              </span>
              <Button
                className="mobile-filter-btn"
                variant="outline"
                onClick={() => setDrawer(true)}
              >
                <Icon name="filter" />
                Filtros
              </Button>
              <Select
                label="Ordenar por"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recommended">Recomendados</option>
                <option value="low">Precio menor</option>
                <option value="high">Precio mayor</option>
              </Select>
            </div>
            {results.length ? (
              <div className="vehicle-grid catalog-grid">
                {results.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No encontramos autos con esos filtros."
                description="Prueba otra ciudad o amplía el precio para encontrar más opciones."
              >
                <Button onClick={clear}>Limpiar filtros</Button>
              </EmptyState>
            )}
            <p className="demo-note">
              Catálogo de demostración · Precios y disponibilidad de ejemplo.
            </p>
          </section>
        </div>
      </div>
      <Drawer
        title="Encuentra tu auto"
        open={drawer}
        onClose={() => setDrawer(false)}
      >
        <div className="filters">
          {filters}
          <Button onClick={() => setDrawer(false)}>
            Ver {results.length} autos
          </Button>
        </div>
      </Drawer>
    </>
  );
}
