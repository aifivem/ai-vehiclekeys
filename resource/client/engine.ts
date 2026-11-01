import {
  cache,
  every,
  type Job,
  Keybind,
  notify,
  onCache,
  onServerEvent,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS } from "common/keys";
import { seatKey } from "./give";

/** Ped config flag: the ped does not start a vehicle's engine by accelerating. */
const NO_ENGINE_START = 429;

/**
 * Without a key the engine stays off: asked once when the player takes a driver seat, then held off (the ped cannot
 * start it by accelerating, and twice a second it is switched off) until a key arrives (hotwire) or the seat is left.
 */
class Engine {
  private blockTimer: Job | null = null;

  async onSeat(seat: number | false): Promise<void> {
    this.release();
    const vehicle = cache.vehicle;
    if (seat !== -1 || vehicle === false) return;
    const allowed = await seatKey.ask(vehicle);
    if (allowed || cache.vehicle !== vehicle) return;
    SetPedConfigFlag(cache.ped, NO_ENGINE_START, true);
    SetVehicleEngineOn(vehicle, false, true, true);
    this.blockTimer = every(
      500,
      () => {
        if (cache.vehicle !== vehicle || cache.seat !== -1)
          return this.release();
        SetVehicleEngineOn(vehicle, false, true, true);
      },
      { name: "engineBlock" },
    );
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
    this.blockTimer.stop();
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

new Keybind({
  name: "vehiclekeys_engine",
  description: Locale("KEYBIND_ENGINE"),
  defaultKey: "M",
  hint: "vehicle",
  icon: "power-off",
  hintLabel: Locale("HINT_ENGINE"),
  onPressed: () => engine.toggle(),
});
