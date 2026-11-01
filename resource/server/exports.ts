import {
  plateOf,
  provideExport,
  registerExport,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import { keys } from "./keys";

/** Own exports and qbx_vehiclekeys (`provide qbx_vehiclekeys`): vehicles by entity or plate. */
const plateFrom = (vehicle: unknown): string | null =>
  typeof vehicle === "string"
    ? vehicle
    : typeof vehicle === "number" && DoesEntityExist(vehicle)
      ? plateOf(vehicle)
      : null;
const api: Record<string, (...args: unknown[]) => unknown> = {
  HasKeys: (source, vehicle) => {
    const plate = plateFrom(vehicle);
    return (
      typeof source === "number" && plate !== null && keys.has(source, plate)
    );
  },
  GiveKeys: (source, vehicle) => {
    const plate = plateFrom(vehicle);
    if (typeof source === "number" && plate) keys.give(source, plate);
  },
  RemoveKeys: (source, vehicle) => {
    const plate = plateFrom(vehicle);
    if (typeof source === "number" && plate) keys.remove(source, plate);
  },
  SetLockState: (vehicle, state) => {
    if (typeof vehicle === "number" && DoesEntityExist(vehicle))
      SetVehicleDoorsLocked(
        vehicle,
        state === "lock" || state === true || state === 2 ? 2 : 1,
      );
  },
  IsPlayerNearVehicle: (source, vehicle) =>
    typeof source === "number" &&
    typeof vehicle === "number" &&
    vehicleNearPlayer(source, NetworkGetNetworkIdFromEntity(vehicle)) !== 0,
};
for (const [name, fn] of Object.entries(api)) {
  registerExport(name, fn);
  provideExport("qbx_vehiclekeys", name, fn);
}
