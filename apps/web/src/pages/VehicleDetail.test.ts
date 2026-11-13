import { describe, expect, it, vi } from "vitest";
import { defaultBookingDates } from "./VehicleDetail";

describe("VehicleDetail booking dates", () => {
  it("uses a future Ecuador range instead of expired fixed dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T18:00:00.000Z"));

    expect(defaultBookingDates()).toEqual({
      today: "2026-11-13",
      start: "2026-11-14",
      end: "2026-11-17",
    });

    vi.useRealTimers();
  });
});
