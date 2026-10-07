import { useEffect, useState } from "react";
import { api } from "../services/apiClient";
import type { ApiPage, ApiVehicle } from "../models";
import type { Vehicle } from "../types/vehicle";
const art: Record<string, string> = {
  SUV: "/images/suv.svg",
  Sedan: "/images/sedan.svg",
  Compact: "/images/compact.svg",
  Pickup: "/images/pickup.svg",
};
export const mapVehicle = (v: ApiVehicle): Vehicle => ({
  id: v.id,
  brand: v.brand,
  model: v.model,
  year: v.year,
  category: (v.category === "Sedan"
    ? "Sedán"
    : v.category) as Vehicle["category"],
  transmission: v.transmission === "AUTOMATIC" ? "Autom\u00e1tica" : "Manual",
  fuel:
    v.fuelType === "HYBRID"
      ? "H\u00edbrido"
      : v.fuelType === "DIESEL"
        ? "Di\u00e9sel"
        : "Gasolina",
  seats: v.seats,
  doors: v.doors,
  bags: v.bagCapacity,
  pricePerDay: v.pricePerDay,
  location: v.location,
  rating: 4.8,
  reviews: 0,
  image: art[v.category] || "/images/sedan.svg",
  color: "#e9efec",
  featured: v.status === "AVAILABLE",
  description: v.description,
  pickupDepots: v.pickupDepots ?? [],
});
export function useVehiclesController(query = "") {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<ApiPage<ApiVehicle>>({
      url: `/vehicles${query}`,
      signal: controller.signal,
    })
      .then((r) => { setVehicles(r.data.map(mapVehicle)); setTotal(r.total); })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);
  return { vehicles, total, loading, error };
}
export function useVehicleController(id?: string) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { if (!id) { setLoading(false); return; } const controller = new AbortController(); api<ApiVehicle>({ url: `/vehicles/${id}`, signal: controller.signal }).then((value) => setVehicle(mapVehicle(value))).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Vehículo no encontrado"); }).finally(() => setLoading(false)); return () => controller.abort(); }, [id]);
  return { vehicle, loading, error };
}
