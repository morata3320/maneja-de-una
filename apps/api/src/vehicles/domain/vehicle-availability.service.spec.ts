import { VehicleAvailabilityService } from './vehicle-availability.service';
import { VehicleStatus } from './vehicle.enums';
describe('VehicleAvailabilityService', () => {
  const service = new VehicleAvailabilityService();
  it.each(Object.values(VehicleStatus))('evalúa estado %s', (status) => {
    expect(service.canEvaluateReservation({ status })).toBe(
      status === VehicleStatus.AVAILABLE,
    );
  });
});
