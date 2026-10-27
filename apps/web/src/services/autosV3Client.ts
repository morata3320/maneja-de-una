import axios from "axios";

const baseURL = (
  import.meta.env.VITE_AUTOS_V3_URL || "http://localhost:3000/api/v3/autos"
).replace(/\/$/, "");

export interface AutosV3Vehicle {
  vehicle_id: string;
  brand: string;
  model: string;
  category: string;
  daily_price: number;
  currency: string;
  transmission: string;
  seats: number;
  status?: string;
}

interface CatalogResponse {
  total: number;
  data: AutosV3Vehicle[];
}

const publicAutosV3Client = axios.create({ baseURL, timeout: 12000 });

// Solo endpoints públicos: las credenciales de Booking nunca se exponen en Vite.
export async function getAutosV3Catalog(): Promise<AutosV3Vehicle[]> {
  return (await publicAutosV3Client.get<CatalogResponse>("/")).data.data;
}

export async function searchAutosV3(
  request: Record<string, unknown>,
): Promise<AutosV3Vehicle[]> {
  const response = await publicAutosV3Client.post<{ data: AutosV3Vehicle[] }>(
    "/search",
    request,
  );
  return response.data.data;
}
