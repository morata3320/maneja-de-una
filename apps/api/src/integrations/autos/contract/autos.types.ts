// Generado desde contracts/autos-openapi.yaml. No editar.
// Son tipos de transporte, no validadores HTTP ni modelos ORM.
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code:
    | 'VALIDATION_FAILED'
    | 'CAR_NO_LONGER_AVAILABLE'
    | 'PRICE_CHANGED'
    | 'DEPOT_CLOSED'
    | 'DRIVER_AGE_RESTRICTION'
    | 'BOOKING_NOT_CONFIRMED'
    | 'CANCELLATION_NOT_ALLOWED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'PAYMENT_REFERENCE_INVALID'
    | 'PAYMENT_NOT_AUTHORIZED';
  invalidParams?: Array<{
    name?: string;
    reason?: string;
    [key: string]: unknown;
  }>;
};
export type Booker = { country: string; [key: string]: unknown };
export type Driver = { age: number; [key: string]: unknown };
export type LocationPoint = {
  airport?: string;
  city_id?: number;
  coordinates?: {
    latitude?: number;
    longitude?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export type Route = {
  dropoff: {
    datetime: string;
    location: LocationPoint;
    [key: string]: unknown;
  };
  pickup: { datetime: string; location: LocationPoint; [key: string]: unknown };
  [key: string]: unknown;
};
export type CarSearchRequest = {
  booker: Booker;
  currency: string;
  driver: Driver;
  route: Route;
  filters?: {
    car_types?: Array<string>;
    transmission?: Array<string>;
    [key: string]: unknown;
  };
  maximum_results?: number;
  language?: string;
  page?: string;
  [key: string]: unknown;
};
export type CarSearchResponse = {
  request_id?: string;
  data?: Array<{
    vehicle_id?: string;
    price?: number;
    supplier_id?: number;
    [key: string]: unknown;
  }>;
  metadata?: {
    total_results?: number;
    next_page?: string | null;
    [key: string]: unknown;
  };
  search_token?: string;
  [key: string]: unknown;
};
export type DepotsRequest = {
  last_modified?: string;
  maximum_results?: number;
  languages?: Array<string>;
  page?: string;
  [key: string]: unknown;
};
export type DepotsResponse = {
  request_id?: string;
  data?: Array<{
    depot_id?: number;
    name?: string;
    location?: LocationPoint;
    [key: string]: unknown;
  }>;
  metadata?: { [key: string]: unknown };
  [key: string]: unknown;
};
export type DepotScoresRequest = {
  maximum_results?: number;
  page?: string;
  [key: string]: unknown;
};
export type DepotScoresResponse = {
  request_id?: string;
  data?: Array<{ depot_id?: number; score?: number; [key: string]: unknown }>;
  metadata?: { [key: string]: unknown };
  [key: string]: unknown;
};
export type CarDetailsRequest = {
  last_modified?: string;
  maximum_results?: number;
  page?: string;
  [key: string]: unknown;
};
export type CarDetailsResponse = {
  request_id?: string;
  data?: Array<{
    vehicle_id?: string;
    make?: string;
    model?: string;
    doors?: number;
    bag_capacity?: number;
    seats?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};
export type SuppliersRequest = {
  suppliers?: Array<number>;
  maximum_results?: number;
  page?: string;
  [key: string]: unknown;
};
export type SuppliersResponse = {
  request_id?: string;
  data?: Array<{ supplier_id?: number; name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};
export type CarConstantsRequest = {
  languages?: Array<string>;
  constants?: Array<
    | 'depot_services'
    | 'fuel_policies'
    | 'fuel_types'
    | 'general'
    | 'payment_timings'
    | 'transmission'
  >;
  [key: string]: unknown;
};
export type CarConstantsResponse = {
  request_id?: string;
  data?: { [key: string]: unknown };
  [key: string]: unknown;
};
export type OrderHoldRequest = {
  vehicle_id: string;
  search_token: string;
  driver?: Driver;
  [key: string]: unknown;
};
export type OrderHoldResponse = {
  hold_id?: string;
  expires_at?: string;
  status?: 'HELD' | 'FAILED';
  [key: string]: unknown;
};
export type OrderPreviewRequest = {
  vehicle_id: string;
  search_token: string;
  hold_id?: string;
  extras?: Array<string>;
  [key: string]: unknown;
};
export type OrderPreviewResponse = {
  request_id?: string;
  data?: {
    order_preview_id?: string;
    total_price?: number;
    currency?: string;
    breakdown?: { [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export type OrderCreateRequest = {
  order_preview_id: string;
  payment_reference: string;
  driver_details: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export type OrderDetail = {
  order_id?: string;
  locator?: string;
  status?: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  vehicle_details?: { [key: string]: unknown };
  route_details?: { [key: string]: unknown };
  total_price?: number;
  currency?: string;
  creation_date?: string;
  _links?: { [key: string]: string };
  [key: string]: unknown;
};
export type OrderModifyRequest = {
  extras_to_add?: Array<string>;
  extras_to_remove?: Array<string>;
  route?: Route;
  [key: string]: unknown;
};
export type WebhookSubscription = {
  id: string;
  url: string;
  events: Array<'CAR_ORDER_CONFIRMED' | 'CAR_ORDER_CANCELLED' | 'DEPOT_UPDATE'>;
  secret?: string;
  [key: string]: unknown;
};
export type WebhookPayload = {
  eventId: string;
  eventType: string;
  timestamp: string;
  resourceId: string;
  data?: { [key: string]: unknown };
  [key: string]: unknown;
};
