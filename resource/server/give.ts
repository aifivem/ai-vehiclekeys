import {
  notify,
  onClientCallback,
  online,
  playersNear,
} from "@aicore-fivem/lib/server";
import { Locale } from "common";
import { EVENTS, normalizePlate } from "common/keys";
import { keys } from "./keys";
import { netIdArg, plateOf, vehicleNear } from "./vehicles";

/** How close the other player must stand to take the keys. */
const GIVE_METRES = 3;

/** The closest other player with a loaded character within `metres`, or null. */
function nearestPlayer(source: number, metres: number): number | null {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const other of playersNear(source, metres)) {
    if (other === source || !online.character(other)) continue;
    const [ox = 0, oy = 0, oz = 0] = GetEntityCoords(
      GetPlayerPed(String(other)),
    );
    const distance = Math.hypot(ox - x, oy - y, oz - z);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

const refuse = (
  source: number,
  error: "KEYS_ERR_FAR" | "KEYS_ERR_NO_KEY" | "KEYS_ERR_NOBODY",
) => {
  notify(source, Locale(error), "error", 2500);
  return { ok: false, error };
};

/** The radial "give the keys" item: a copy of the key of the vehicle the giver sits in or stands at, to the nearest player. */
onClientCallback(
  EVENTS.giveNearest,
  { args: netIdArg, lock: true },
  (source, netId) => {
    const vehicle = vehicleNear(source, netId, 6);
    if (vehicle === null) return refuse(source, "KEYS_ERR_FAR");
    const plate = normalizePlate(plateOf(vehicle));
    if (!keys.has(source, plate)) return refuse(source, "KEYS_ERR_NO_KEY");
    const target = nearestPlayer(source, GIVE_METRES);
    if (target === null) return refuse(source, "KEYS_ERR_NOBODY");
    keys.give(target, plate);
    notify(source, Locale("KEYS_GAVE", plate), "success");
    notify(target, Locale("KEYS_RECEIVED", plate), "success");
    return { ok: true };
  },
);
