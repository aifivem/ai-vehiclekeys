import { normalizePlate } from "common/keys";

/** A vehicle's plate as keys compare it (trimmed, upper case). */
export const plateOf = (vehicle: number): string =>
  normalizePlate(GetVehicleNumberPlateText(vehicle));
