import {
  cache,
  callAction,
  Keybind,
  nearestVehicle,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS } from "common/keys";

/** L: lock or unlock the nearest vehicle the player has a key to (the server decides and locks). */
async function toggleLock(): Promise<void> {
  const vehicle = nearestVehicle(10);
  if (!vehicle) return;
  const result = await callAction(
    EVENTS.toggleLock,
    [NetworkGetNetworkIdFromEntity(vehicle)],
    { fallback: "KEYS_ERR_FAR" },
  );
  if (!result) return;
  if (cache.vehicle === false) {
    // Key fob feedback: lights flash, a short horn.
    SetVehicleLights(vehicle, 2);
    StartVehicleHorn(vehicle, 80, GetHashKey("HELDDOWN"), false);
    setTimeout(() => SetVehicleLights(vehicle, 0), 400);
  }
}

new Keybind({
  name: "vehiclekeys_lock",
  description: Locale("KEYBIND_LOCK"),
  defaultKey: "U",
  hint: "always",
  icon: "lock",
  hintLabel: Locale("HINT_LOCK"),
  onPressed: () => void toggleLock(),
});
