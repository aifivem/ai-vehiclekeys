import {
  AdminPanel,
  inventory,
  isNear,
  entityCoords,
  nearestVehicleTo,
  notify,
  onClientCallback,
  PendingActions,
  provideExport,
  registerExport,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings } from "common/keys";
import "./give";
import { keys } from "./keys";
import { keysSchema } from "./schema";
import { plateOf } from "./vehicles";

const panel = new AdminPanel(keysSchema);
/** Panel settings, kept current by the panel. */
const settings = panel.view("settings", readSettings);

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

/** Lockpick tries waiting for their progress bar: a finish before 80 % of the time is refused. */
const picks = new PendingActions<{
  kind: "unlock" | "hotwire";
  vehicle: number;
}>();
/** How far a player may move from the vehicle while picking. */
const PICK_REACH = 4;

/** The lockpick item: from the driver seat it hotwires, next to a locked vehicle it opens the door. */
function useLockpick(source: number): boolean {
  const ped = GetPlayerPed(String(source));
  const seat = GetVehiclePedIsIn(ped, false);
  const s = settings.value;
  let kind: "unlock" | "hotwire";
  let vehicle: number;
  if (seat && GetPedInVehicleSeat(seat, -1) === ped) {
    if (keys.has(source, plateOf(seat))) return false;
    kind = "hotwire";
    vehicle = seat;
  } else {
    // The nearest locked vehicle within 3 m (not merely the first one found).
    const near = nearestVehicleTo(
      source,
      3,
      (v) => GetVehicleDoorLockStatus(v) >= 2,
    );
    if (!near) return false;
    kind = "unlock";
    vehicle = near;
  }
  const seconds = kind === "hotwire" ? s.hotwireSeconds : s.unlockSeconds;
  const token = picks.start(source, { kind, vehicle }, seconds * 1000);
  emitNet(EVENTS.startPick, source, kind, token, seconds);
  // The lockpick is spent only when it breaks (finishPick).
  return false;
}

onClientCallback(
  EVENTS.finishPick,
  {
    args: oneArg(readId),
    lock: true,
  },
  (source, token) => {
    const pick = picks.take(source, token);
    // Still at the vehicle when the progress ends (in its driver seat for a hotwire).
    if (
      !pick ||
      !DoesEntityExist(pick.vehicle) ||
      !isNear(source, entityCoords(pick.vehicle), PICK_REACH)
    )
      return fail("KEYS_ERR_FAR");
    const s = settings.value;
    const success =
      Math.random() * 100 <
      (pick.kind === "hotwire" ? s.hotwireChance : s.unlockChance);
    if (success) {
      if (pick.kind === "hotwire") keys.give(source, plateOf(pick.vehicle));
      else SetVehicleDoorsLocked(pick.vehicle, 1);
      notify(
        source,
        Locale(pick.kind === "hotwire" ? "KEYS_HOTWIRED" : "KEYS_PICKED"),
        "success",
      );
      return { ok: true };
    }
    if (Math.random() * 100 < s.breakChance) {
      inventory.removeItem(source, "lockpick", 1);
      notify(source, Locale("KEYS_BROKE"), "error");
    } else notify(source, Locale("KEYS_FAILED"), "warning");
    return { ok: true };
  },
);

inventory.registerUsableItem("lockpick", (source: number) =>
  useLockpick(source),
);

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
