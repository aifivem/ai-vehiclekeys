import {
  cache,
  callAction,
  Keybind,
  nearestVehicle,
  notify,
  onCache,
  onServerEvent,
  progress,
} from "@aicore-fivem/lib/client";
import { readFinite, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/keys";
import { seatKey } from "./give";

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

/** Ped config flag: the ped does not start a vehicle's engine by accelerating. */
const NO_ENGINE_START = 429;

/**
 * Without a key the engine stays off: asked once when the player takes a driver seat, then held off (the ped cannot
 * start it by accelerating, and twice a second it is switched off) until a key arrives (hotwire) or the seat is left.
 */
class Engine {
  private blockTimer: ReturnType<typeof setInterval> | null = null;

  async onSeat(seat: number | false): Promise<void> {
    this.release();
    const vehicle = cache.vehicle;
    if (seat !== -1 || vehicle === false) return;
    const allowed = await seatKey.ask(vehicle);
    if (allowed || cache.vehicle !== vehicle) return;
    SetPedConfigFlag(cache.ped, NO_ENGINE_START, true);
    SetVehicleEngineOn(vehicle, false, true, true);
    this.blockTimer = setInterval(() => {
      if (cache.vehicle !== vehicle || cache.seat !== -1) return this.release();
      SetVehicleEngineOn(vehicle, false, true, true);
    }, 500);
  }

  /** M: the driver switches the engine off, or on again when nothing holds it off (no key). */
  toggle(): void {
    const vehicle = cache.vehicle;
    if (vehicle === false || cache.seat !== -1) return;
    if (this.blockTimer)
      return notify(Locale("KEYS_ERR_NO_KEY"), "error", 2500);
    const running = GetIsVehicleEngineRunning(vehicle);
    SetVehicleEngineOn(vehicle, !running, false, true);
  }

  release(): void {
    if (!this.blockTimer) return;
    clearInterval(this.blockTimer);
    this.blockTimer = null;
    SetPedConfigFlag(cache.ped, NO_ENGINE_START, false);
  }
}

const engine = new Engine();
onCache("seat", (seat) => void engine.onSeat(seat));
onServerEvent(EVENTS.granted, () => {
  seatKey.set(true);
  engine.release();
  if (cache.vehicle !== false)
    SetVehicleEngineOn(cache.vehicle, true, false, true);
});

onServerEvent(
  EVENTS.startPick,
  {
    args: ([kind, token, seconds]) => {
      const id = readId(token);
      const time = readFinite(seconds);
      return (kind === "unlock" || kind === "hotwire") &&
        id !== null &&
        time !== null
        ? [kind, id, time]
        : null;
    },
  },
  async (kind, token, seconds) => {
    const done = await progress({
      label: Locale(kind === "hotwire" ? "KEYS_HOTWIRING" : "KEYS_PICKING"),
      duration: seconds * 1000,
      anim:
        kind === "hotwire"
          ? { dict: "veh@std@ds@base", clip: "hotwire" }
          : { dict: "veh@break_in@0h@p_m_one@", clip: "low_force_entry_ds" },
      allowVehicle: kind === "hotwire",
    });
    if (done)
      void callAction(EVENTS.finishPick, [token], {
        fallback: "KEYS_ERR_FAR",
      });
  },
);

new Keybind({
  name: "vehiclekeys_engine",
  description: Locale("KEYBIND_ENGINE"),
  defaultKey: "M",
  hint: "vehicle",
  icon: "power-off",
  hintLabel: Locale("HINT_ENGINE"),
  onPressed: () => engine.toggle(),
});

new Keybind({
  name: "vehiclekeys_lock",
  description: Locale("KEYBIND_LOCK"),
  defaultKey: "U",
  hint: "always",
  icon: "lock",
  hintLabel: Locale("HINT_LOCK"),
  onPressed: () => void toggleLock(),
});
