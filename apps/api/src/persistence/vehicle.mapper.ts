import type { Vehicle } from '../vehicles/domain/vehicle';
import {
  FuelType,
  Transmission,
  VehicleStatus,
} from '../vehicles/domain/vehicle.enums';
import type { VehicleRow } from './rows';
export function vehicleToDomain(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    brandId: row.brand_id,
    modelId: row.model_id,
    categoryId: row.category_id,
    locationId: row.location_id,
    year: row.year,
    color: row.color,
    licensePlate: row.license_plate,
    transmission: row.transmission as Transmission,
    fuelType: row.fuel_type as FuelType,
    seats: row.seats,
    doors: row.doors,
    pricePerDay: Number(row.price_per_day),
    mileage: row.mileage,
    description: row.description,
    status: row.status as VehicleStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export function vehicleDomainFields(
  vehicle: Vehicle,
): Pick<
  VehicleRow,
  | 'id'
  | 'brand_id'
  | 'model_id'
  | 'category_id'
  | 'location_id'
  | 'year'
  | 'color'
  | 'license_plate'
  | 'transmission'
  | 'fuel_type'
  | 'seats'
  | 'doors'
  | 'price_per_day'
  | 'mileage'
  | 'description'
  | 'status'
> {
  return {
    id: vehicle.id,
    brand_id: vehicle.brandId,
    model_id: vehicle.modelId,
    category_id: vehicle.categoryId,
    location_id: vehicle.locationId,
    year: vehicle.year,
    color: vehicle.color,
    license_plate: vehicle.licensePlate,
    transmission: vehicle.transmission,
    fuel_type: vehicle.fuelType,
    seats: vehicle.seats,
    doors: vehicle.doors,
    price_per_day: vehicle.pricePerDay.toFixed(2),
    mileage: vehicle.mileage,
    description: vehicle.description,
    status: vehicle.status,
  };
}
