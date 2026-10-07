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
