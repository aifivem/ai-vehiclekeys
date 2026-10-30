import {
  nearestPlayerTo,
  notify,
  onClientCallback,
  online,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/keys";
import { keys } from "./keys";
import { plateOf } from "./vehicles";

/** How close the other player must stand to take the keys. */
const GIVE_METRES = 3;

/** The giver's client sends no `callAction` (a radial item), so the server shows the refusal itself. */
const refuse = (
  source: number,
  error: "KEYS_ERR_FAR" | "KEYS_ERR_NO_KEY" | "KEYS_ERR_NOBODY",
) => {
  notify(source, Locale(error), "error", 2500);
  return fail(error);
};

/** The radial "give the keys" item: a copy of the key of the vehicle the giver sits in or stands at, to the nearest player. */
onClientCallback(
  EVENTS.giveNearest,
  { args: oneArg(readId), lock: true },
  (source, netId) => {
    const vehicle = vehicleNearPlayer(source, netId, { metres: 6 });
    if (!vehicle) return refuse(source, "KEYS_ERR_FAR");
    const plate = plateOf(vehicle);
    if (!keys.has(source, plate)) return refuse(source, "KEYS_ERR_NO_KEY");
    const target = nearestPlayerTo(
      source,
      GIVE_METRES,
      (other) => online.character(other) !== null,
    );
    if (target === null) return refuse(source, "KEYS_ERR_NOBODY");
    keys.give(target, plate);
    notify(source, Locale("KEYS_GAVE", plate), "success");
    notify(target, Locale("KEYS_RECEIVED", plate), "success");
    return { ok: true };
  },
);
