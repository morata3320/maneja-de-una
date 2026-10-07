export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  category: "SUV" | "Sedán" | "Compact" | "Pickup" | "Hatchback";
  transmission: "Automática" | "Manual";
  fuel: "Gasolina" | "Híbrido" | "Diésel";
  seats: number;
  doors: number;
  bags: number;
  pricePerDay: number;
  location: string;
  rating: number;
  reviews: number;
  image: string;
  color: string;
  featured: boolean;
  description: string;
  status: string;
  pickupDepots: import("../models").PickupDepot[];
}
