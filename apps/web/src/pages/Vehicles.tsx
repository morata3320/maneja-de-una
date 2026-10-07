import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useVehiclesController } from "../controllers/useVehiclesController";
import { api } from "../services/apiClient";
import { VehicleCard } from "../components/vehicle/VehicleCard";
import { Button, Drawer, EmptyState, Input, PageHeader, Select } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { SearchBar } from "../components/search/SearchBar";

type Named = { id: string | number; name: string };
export function Vehicles() {
  const [params, setParams] = useSearchParams(), [drawer, setDrawer] = useState(false), [catalogs, setCatalogs] = useState<Record<string, Named[]>>({});
  const page = Number(params.get("page") ?? 1), limit = 9;
  const query = useMemo(() => { const next = new URLSearchParams(params); next.set("page", String(page)); next.set("limit", String(limit)); const aliases: Record<string, string> = { categoria: "category", lugar: "location" }; for (const [oldKey, newKey] of Object.entries(aliases)) { const value = next.get(oldKey); if (value) next.set(newKey, value); next.delete(oldKey); } return `?${next}`; }, [params, page]);
  const { vehicles, total, loading, error } = useVehiclesController(query);
  useEffect(() => { Promise.all(["brands", "categories", "locations", "suppliers"].map(async (resource) => [resource, (await api<{ data: Named[] }>({ url: `/${resource}?limit=100` })).data] as const)).then((entries) => setCatalogs(Object.fromEntries(entries))).catch(() => setCatalogs({})); }, []);
  function set(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== "page") next.set("page", "1"); setParams(next); }
  function clear() { setParams(new URLSearchParams()); }
  const filters = <><div className="filter-heading"><h2>Filtros</h2><button className="text-link" onClick={clear}>Limpiar</button></div>
    <Input label="Buscar" type="search" value={params.get("search") ?? ""} onChange={(e) => set("search", e.target.value)} />
    {[["brand", "Marca", "brands"], ["category", "Categoría", "categories"], ["location", "Ubicación", "locations"], ["supplier", "Proveedor", "suppliers"]].map(([key, label, resource]) => <Select key={key} label={label} value={params.get(key) ?? ""} onChange={(e) => set(key, e.target.value)}><option value="">Todos</option>{catalogs[resource]?.map((row) => <option key={row.id} value={row.name}>{row.name}</option>)}</Select>)}
    <Select label="Transmisión" value={params.get("transmission") ?? ""} onChange={(e) => set("transmission", e.target.value)}><option value="">Cualquiera</option><option value="AUTOMATIC">Automática</option><option value="MANUAL">Manual</option></Select>
    <Select label="Combustible" value={params.get("fuelType") ?? ""} onChange={(e) => set("fuelType", e.target.value)}><option value="">Cualquiera</option>{["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"].map((value) => <option key={value}>{value}</option>)}</Select>
    <Input label="Precio mínimo" type="number" min="0" value={params.get("minPrice") ?? ""} onChange={(e) => set("minPrice", e.target.value)} />
    <Input label="Precio máximo" type="number" min="0" value={params.get("maxPrice") ?? ""} onChange={(e) => set("maxPrice", e.target.value)} />
    <Button variant="outline" onClick={clear}>Limpiar filtros</Button></>;
  return <><div className="catalog-search"><div className="container"><SearchBar compact /></div></div><div className="container section"><PageHeader eyebrow="EL CAMINO ES TUYO" title="Autos disponibles" description={`${total} opciones reales del catálogo`} /><div className="catalog-layout"><aside className="filters desktop-filters">{filters}</aside><section><div className="results-toolbar"><span><strong>{total}</strong> autos para tu próximo plan</span><Button className="mobile-filter-btn" variant="outline" onClick={() => setDrawer(true)}><Icon name="filter" />Filtros</Button><Select label="Ordenar por" value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)}><option value="">Recientes</option><option value="price_asc">Precio menor</option><option value="price_desc">Precio mayor</option></Select></div>{loading ? <p role="status">Cargando vehículos…</p> : vehicles.length ? <div className="vehicle-grid catalog-grid">{vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div> : <EmptyState title="No encontramos autos con esos filtros." description="Prueba otros criterios." ><Button onClick={clear}>Limpiar filtros</Button></EmptyState>}{error && <p className="form-error" role="alert">{error}</p>}<div className="table-footer"><Button variant="ghost" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>Anterior</Button><span>Página {page}</span><Button variant="ghost" disabled={page * limit >= total} onClick={() => set("page", String(page + 1))}>Siguiente</Button></div></section></div></div><Drawer title="Encuentra tu auto" open={drawer} onClose={() => setDrawer(false)}><div className="filters">{filters}<Button onClick={() => setDrawer(false)}>Ver resultados</Button></div></Drawer></>;
}
