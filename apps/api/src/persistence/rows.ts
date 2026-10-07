import type {
  CarSearchRequest,
  Route,
  OrderDetail,
  OrderCreateRequest,
  WebhookSubscription,
} from '../integrations/autos/contract/autos.types';
export interface VehicleRow {
  id: string;
  brand_id: string;
  model_id: string;
  category_id: string;
  location_id: string;
  supplier_id: number;
  depot_id: number;
  year: number;
  color: string;
  license_plate: string;
  transmission: string;
  fuel_type: string;
  seats: number;
  doors: number;
  bag_capacity: number;
  price_per_day: string;
  mileage: number;
  description: string;
  status: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  cedula: string | null;
  phone: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
export interface SearchRow {
  id: string;
  affiliate: string;
  context: CarSearchRequest;
  results: string[];
  created_at: Date;
  expires_at: Date;
}
export interface HoldRow {
  id: string;
  vehicle_id: string;
  owner_id: string;
  search_id: string;
  starts_at: Date;
  ends_at: Date;
  price_per_day: string;
  currency: string;
  expires_at: Date;
  consumed: boolean;
}
export interface PreviewRow {
  id: string;
  vehicle_id: string;
  owner_id: string;
  hold_id: string | null;
  route: Route;
  price_per_day: string;
  total_amount: string;
  currency: string;
  extras: string[];
  expires_at: Date;
  consumed: boolean;
}
export interface OrderRow {
  id: string;
  vehicle_id: string;
  owner_id: string;
  preview_id: string;
  locator: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  route: Route;
  starts_at: Date;
  ends_at: Date;
  price_per_day: string;
  total_amount: string;
  currency: string;
  extras: string[];
  vehicle_details: NonNullable<OrderDetail['vehicle_details']>;
  driver_details: OrderCreateRequest['driver_details'];
  payment_reference: string;
  created_at: Date;
  updated_at: Date;
}
export interface SubscriptionRow {
  id: string;
  owner_id: string;
  url: string;
  events: WebhookSubscription['events'];
  encrypted_secret: string | null;
  active: boolean;
  created_at: Date;
}
export interface DepotRow {
  id: number;
  supplier_id: number;
  location_id: string;
  name: string;
  airport: string | null;
  city_id: number | null;
  latitude: string | null;
  longitude: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
