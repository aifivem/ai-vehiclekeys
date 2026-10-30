import { asArgs } from "@aicore-fivem/lib/shared";

export const plateOf = (vehicle: number): string =>
  GetVehicleNumberPlateText(vehicle);

/** `args` parser of callbacks that take one network id. */
export const netIdArg = ([netId]: unknown[]) =>
  asArgs(
    typeof netId === "number" && Number.isInteger(netId) && netId > 0
      ? netId
      : null,
  );

/** A networked vehicle within `metres` of the player, or null. */
export function vehicleNear(
  source: number,
  netId: number,
  metres: number,
): number | null {
  const vehicle = NetworkGetEntityFromNetworkId(netId);
  if (!vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2)
    return null;
  const [px = 0, py = 0, pz = 0] = GetEntityCoords(
    GetPlayerPed(String(source)),
  );
  const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(vehicle);
  return Math.hypot(px - vx, py - vy, pz - vz) <= metres ? vehicle : null;
}
