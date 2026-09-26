import {
  VehicleStatus,
  Transmission,
  FuelType,
} from '../vehicles/domain/vehicle.enums';
export interface Field {
  column: string;
  schema: Record<string, unknown>;
  required?: boolean;
}
const text = (column: string, required = true): Field => ({
  column,
  schema: { type: 'string', minLength: 1, maxLength: 500 },
  required,
});
const uuid = (column: string): Field => ({
  column,
  schema: { type: 'string', format: 'uuid' },
  required: true,
});
const integer = (column: string, minimum = 0): Field => ({
  column,
  schema: { type: 'integer', minimum },
  required: true,
});
const active: Field = { column: 'active', schema: { type: 'boolean' } };
export const resources: Record<
  string,
  { table: string; fields: Record<string, Field>; integerId?: boolean }
> = {
  brands: { table: 'brands', fields: { name: text('name'), active } },
  'vehicle-models': {
    table: 'vehicle_models',
    fields: { name: text('name'), brandId: uuid('brand_id'), active },
  },
  categories: {
    table: 'categories',
    fields: {
      name: text('name'),
      description: text('description', false),
      active,
    },
  },
  locations: {
    table: 'locations',
    fields: {
      name: text('name'),
      city: text('city'),
      province: text('province'),
      active,
    },
  },
  suppliers: {
    table: 'suppliers',
    integerId: true,
    fields: { name: text('name'), active },
  },
  depots: {
    table: 'depots',
    integerId: true,
    fields: {
      name: text('name'),
      supplierId: integer('supplier_id', 1),
      locationId: uuid('location_id'),
      airport: text('airport', false),
      cityId: { ...integer('city_id'), required: false },
      latitude: {
        column: 'latitude',
        schema: { type: 'number', minimum: -90, maximum: 90 },
      },
      longitude: {
        column: 'longitude',
        schema: { type: 'number', minimum: -180, maximum: 180 },
      },
      active,
    },
  },
  vehicles: {
    table: 'vehicles',
    fields: {
      brandId: uuid('brand_id'),
      modelId: uuid('model_id'),
      categoryId: uuid('category_id'),
      locationId: uuid('location_id'),
      supplierId: integer('supplier_id', 1),
      depotId: integer('depot_id', 1),
      year: integer('year', 1886),
      color: text('color'),
      licensePlate: text('license_plate'),
      transmission: {
        column: 'transmission',
        schema: { type: 'string', enum: Object.values(Transmission) },
        required: true,
      },
      fuelType: {
        column: 'fuel_type',
        schema: { type: 'string', enum: Object.values(FuelType) },
        required: true,
      },
      seats: integer('seats', 1),
      doors: integer('doors', 1),
      bagCapacity: { ...integer('bag_capacity'), required: false },
      pricePerDay: {
        column: 'price_per_day',
        schema: {
          type: 'number',
          exclusiveMinimum: 0,
          maximum: 9999999999.99,
          multipleOf: 0.01,
        },
        required: true,
      },
      mileage: { ...integer('mileage'), required: false },
      description: text('description', false),
      status: {
        column: 'status',
        schema: { type: 'string', enum: Object.values(VehicleStatus) },
        required: true,
      },
      active,
    },
  },
};
export const resourceSchema = (resource: string, partial = false) => ({
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    Object.entries(resources[resource].fields).map(([key, f]) => [
      key,
      f.schema,
    ]),
  ),
  required: partial
    ? []
    : Object.entries(resources[resource].fields)
        .filter(([, f]) => f.required)
        .map(([key]) => key),
});
