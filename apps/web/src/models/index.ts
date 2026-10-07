export interface ApiPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
export interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  cedula?: string;
  phone?: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}
export interface ApiVehicle {
  id: string;
  brand: string;
  model: string;
  category: string;
  location: string;
  year: number;
  transmission: string;
  fuelType: string;
  seats: number;
  doors: number;
  bagCapacity: number;
  pricePerDay: number;
  description: string;
  status: string;
  pickupDepots?: PickupDepot[];
}
export interface PickupDepot {
  id: number;
  name: string;
  locationId: string;
  location: string;
  city: string;
  province: string;
}
export interface Reservation {
  id: string;
  vehicleId: string;
  startsAt: string;
  endsAt: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  createdAt: string;
  vehicle: { id: string; brand: string | null; model: string | null; name: string } | null;
  customer: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  payment: { paymentReference: string | null; status: string | null; amount: number | null; brand: string | null; last4: string | null } | null;
  pickupDepot: { id: number; name: string; locationId: string | null; location: string | null } | null;
  pickupLocation: string | null;
}
export interface Payment {
  paymentReference: string;
  reservationId: string;
  amount: number;
  currency: string;
  status: string;
  cardBrand: string;
  cardLast4: string;
  createdAt: string;
}
