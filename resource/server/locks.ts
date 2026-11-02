import {
  notify,
  onClientCallback,
  onClientEvent,
  plateOf,
  vehicleNearPlayer,
} from "@aifivem/lib/server";
import { fail, oneArg, readId } from "@aifivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/keys";
import { settings } from "./content";
import { keys } from "./keys";

onClientCallback(EVENTS.check, { args: oneArg(readId) }, (source, netId) => {
  const vehicle = vehicleNearPlayer(source, netId, { metres: 6 });
  return vehicle !== 0 && keys.has(source, plateOf(vehicle));
});

onClientCallback(
  EVENTS.toggleLock,
  { args: oneArg(readId), lock: true },
  (source, netId) => {
    const vehicle = vehicleNearPlayer(source, netId, {
      metres: settings.value.lockDistance,
    });
    if (!vehicle) return fail("KEYS_ERR_FAR");
    if (!keys.has(source, plateOf(vehicle))) return fail("KEYS_ERR_NO_KEY");
    const locked = GetVehicleDoorLockStatus(vehicle) >= 2;
    SetVehicleDoorsLocked(vehicle, locked ? 1 : 2);
    notify(
      source,
      Locale(locked ? "KEYS_UNLOCKED" : "KEYS_LOCKED"),
      "success",
      2000,
    );
    return { ok: true, locked: !locked };
  },
);

/** GTA's "locked but can be damaged" (parked cars): the ped smashes a window to get in. */
const BREAK_IN_LOCK = 7;

onClientEvent(
  EVENTS.lockParked,
  { args: oneArg(readId), rate: { count: 2, windowMs: 1000 } },
  (source, netId) => {
    if (!settings.value.noWindowSmash) return;
    const vehicle = vehicleNearPlayer(source, netId, { metres: 10 });
    if (vehicle && GetVehicleDoorLockStatus(vehicle) === BREAK_IN_LOCK)
      SetVehicleDoorsLocked(vehicle, 2);
  },
);
