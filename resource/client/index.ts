import { cache, Keybind, loadLocaleTexts, notify, onCache, onServerEvent, progress, triggerServerCallback } from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS } from "common/keys";

const texts = loadLocaleTexts();
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const errorOf = (v: unknown): string | null => (isObj(v) && v.ok === false && typeof v.error === "string" ? v.error : null);

/** The closest networked vehicle within `metres` (the one the player sits in first). */
function nearestVehicle(metres: number): number | null {
  if (cache.vehicle !== false) return cache.vehicle;
  const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
  let best: number | null = null;
  let bestDistance = metres;
  for (const vehicle of GetGamePool("CVehicle") as number[]) {
    const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(vehicle, false);
    const distance = Math.hypot(vx - x, vy - y, vz - z);
    if (distance < bestDistance && NetworkGetEntityIsNetworked(vehicle)) [best, bestDistance] = [vehicle, distance];
  }
  return best;
}

/** L: lock or unlock the nearest vehicle the player has a key to (the server decides and locks). */
async function toggleLock(): Promise<void> {
  const vehicle = nearestVehicle(10);
  if (!vehicle) return;
  const result: unknown = await triggerServerCallback(EVENTS.toggleLock, [NetworkGetNetworkIdFromEntity(vehicle)]).catch(() => null);
  const error = errorOf(result);
  if (error) return notify(texts[error] ?? error, "error", 2500);
  if (cache.vehicle === false) {
    // Key fob feedback: lights flash, a short horn.
    SetVehicleLights(vehicle, 2);
    StartVehicleHorn(vehicle, 80, GetHashKey("HELDDOWN"), false);
    setTimeout(() => SetVehicleLights(vehicle, 0), 400);
  }
}

/**
 * Without a key the engine stays off: asked once when the player takes a driver seat, then held off twice a second
 * until a key arrives (hotwire) or the player leaves the seat.
 */
class Engine {
  private blockTimer: ReturnType<typeof setInterval> | null = null;

  async onSeat(seat: number | false): Promise<void> {
    this.release();
    const vehicle = cache.vehicle;
    if (seat !== -1 || vehicle === false) return;
    const allowed: unknown = await triggerServerCallback(EVENTS.check, [NetworkGetNetworkIdFromEntity(vehicle)]).catch(() => false);
    if (allowed === true || cache.vehicle !== vehicle) return;
    SetVehicleEngineOn(vehicle, false, true, true);
    this.blockTimer = setInterval(() => {
      if (cache.vehicle !== vehicle || cache.seat !== -1) return this.release();
      SetVehicleEngineOn(vehicle, false, true, true);
    }, 500);
  }

  release(): void {
    if (this.blockTimer) clearInterval(this.blockTimer);
    this.blockTimer = null;
  }
}

const engine = new Engine();
onCache("seat", (seat) => void engine.onSeat(seat));
onServerEvent(EVENTS.granted, () => {
  engine.release();
  if (cache.vehicle !== false) SetVehicleEngineOn(cache.vehicle, true, false, true);
});

onServerEvent(
  EVENTS.startPick,
  {
    args: ([kind, token, seconds]) =>
      (kind === "unlock" || kind === "hotwire") && typeof token === "number" && typeof seconds === "number" ? [kind, token, seconds] : null,
  },
  async (kind, token, seconds) => {
    const done = await progress({
      label: Locale(kind === "hotwire" ? "KEYS_HOTWIRING" : "KEYS_PICKING"),
      duration: seconds * 1000,
      anim: kind === "hotwire" ? { dict: "veh@std@ds@base", clip: "hotwire" } : { dict: "veh@break_in@0h@p_m_one@", clip: "low_force_entry_ds" },
      allowVehicle: kind === "hotwire",
    });
    if (done) void triggerServerCallback(EVENTS.finishPick, [token]).catch(() => null);
  },
);

new Keybind({ name: "vehiclekeys_lock", description: Locale("KEYBIND_LOCK"), defaultKey: "L", onPressed: () => void toggleLock() });
