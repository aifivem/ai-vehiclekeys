import { AdminWorld, cache, every, onCache } from "@aifivem/lib/client";
import { EVENTS, readSettings } from "common/keys";

/** GTA's "locked but can be damaged" (parked cars): the ped smashes a window to get in. */
const BREAK_IN_LOCK = 7;

const world = new AdminWorld(["settings"]);
const settings = world.view("settings", readSettings);

/**
 * No window smashing (panel `noWindowSmash`): while the player is on foot, a parked car he starts to enter with GTA's
 * break-in lock stops the entry at once and becomes plainly locked (2), so the next try only pulls the handle. The
 * owner of the car's entity locks it itself; anyone else asks the server.
 */
let handled = 0;
const job = every(
  100,
  () => {
    const vehicle = GetVehiclePedIsTryingToEnter(cache.ped);
    if (!vehicle || GetVehicleDoorLockStatus(vehicle) !== BREAK_IN_LOCK) return;
    ClearPedTasks(cache.ped);
    if (vehicle === handled) return;
    handled = vehicle;
    if (NetworkGetEntityOwner(vehicle) === PlayerId())
      SetVehicleDoorsLocked(vehicle, 2);
    else if (NetworkGetEntityIsNetworked(vehicle))
      emitNet(EVENTS.lockParked, NetworkGetNetworkIdFromEntity(vehicle));
  },
  { active: false, name: "parkedLocks" },
);

function follow(): void {
  job.set(settings.value.noWindowSmash && cache.vehicle === false);
}
onCache("vehicle", follow);
world.onChange("settings", follow);
follow();
