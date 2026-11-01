import {
  entityCoords,
  inventory,
  isNear,
  minigameFor,
  nearestVehicleTo,
  notify,
  plateOf,
  progressFor,
  SourceLock,
  vehicleOf,
} from "@aicore-fivem/lib/server";
import { rollChance } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { settings } from "./content";
import { keys } from "./keys";

/** One lockpick try per player at a time. */
const picking = new SourceLock();
/** How far a player may move from the vehicle while picking. */
const PICK_REACH = 4;

/**
 * A lockpick try: the minigame (a pick broken there is spent), then the server-timed progress bar, then the server's
 * chance roll with the player still at the vehicle.
 */
async function pick(
  source: number,
  kind: "unlock" | "hotwire",
  vehicle: number,
): Promise<void> {
  const s = settings.value;
  const game =
    s.minigame === "off"
      ? "won"
      : await minigameFor(source, {
          game: s.minigame,
          difficulty: s.minigameDifficulty,
        });
  if (game === "broken") {
    inventory.removeItem(source, "lockpick", 1);
    return notify(source, Locale("KEYS_BROKE"), "error");
  }
  if (game !== "won") return;
  const seconds = kind === "hotwire" ? s.hotwireSeconds : s.unlockSeconds;
  const done = await progressFor(source, {
    label: Locale(kind === "hotwire" ? "KEYS_HOTWIRING" : "KEYS_PICKING"),
    duration: seconds * 1000,
    anim:
      kind === "hotwire"
        ? { dict: "veh@std@ds@base", clip: "hotwire" }
        : { dict: "veh@break_in@0h@p_m_one@", clip: "low_force_entry_ds" },
    allowVehicle: kind === "hotwire",
    canCancel: true,
  });
  // Still at the vehicle when the progress ends (in its driver seat for a hotwire).
  if (
    !done ||
    !DoesEntityExist(vehicle) ||
    !isNear(source, entityCoords(vehicle), PICK_REACH)
  )
    return;
  const success = rollChance(
    kind === "hotwire" ? s.hotwireChance : s.unlockChance,
  );
  if (success) {
    if (kind === "hotwire") keys.give(source, plateOf(vehicle));
    else SetVehicleDoorsLocked(vehicle, 1);
    return notify(
      source,
      Locale(kind === "hotwire" ? "KEYS_HOTWIRED" : "KEYS_PICKED"),
      "success",
    );
  }
  if (rollChance(s.breakChance)) {
    inventory.removeItem(source, "lockpick", 1);
    notify(source, Locale("KEYS_BROKE"), "error");
  } else notify(source, Locale("KEYS_FAILED"), "warning");
}

/** The lockpick item: from the driver seat it hotwires, next to a locked vehicle it opens the door. */
function useLockpick(source: number): boolean {
  const seat = vehicleOf(source, { driver: true });
  let kind: "unlock" | "hotwire";
  let vehicle: number;
  if (seat) {
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
  void picking.run(source, undefined, () => pick(source, kind, vehicle));
  // The lockpick is spent only when it breaks.
  return false;
}

inventory.registerUsableItem("lockpick", (source: number) =>
  useLockpick(source),
);
