import { int, record } from "@aicore-fivem/lib/shared";

/** ai-vehiclekeys' contracts. No natives. */

export const EVENTS = {
  /** Callback: (netId) -> boolean, whether the player holds a key to the vehicle (asked on taking the driver seat). */
  check: "ai-vehiclekeys:check",
  /** Server -> owner: (netId) a key to this vehicle was given while sitting in it: the engine may start. */
  granted: "ai-vehiclekeys:client:granted",
  /** Server -> owner: (kind: "unlock" | "hotwire", token, seconds) play the lockpick progress, then call `finishPick`. */
  startPick: "ai-vehiclekeys:client:startPick",
  /** Callback: (netId) -> { ok, locked? } toggle the lock of a vehicle the player has a key to. */
  toggleLock: "ai-vehiclekeys:toggleLock",
  /** Callback: (token) -> { ok } the lockpick progress finished. */
  finishPick: "ai-vehiclekeys:finishPick",
} as const;

export interface Settings {
  /** Metres from the vehicle for the lock key. */
  lockDistance: number;
  /** Percent chance a lockpick opens a locked door. */
  unlockChance: number;
  unlockSeconds: number;
  /** Percent chance a lockpick starts the engine from the driver seat (the player gets a key). */
  hotwireChance: number;
  hotwireSeconds: number;
  /** Percent chance the lockpick breaks on a failed try. */
  breakChance: number;
}

export function readSettings(raw: unknown): Settings {
  const s = record(raw);
  return {
    lockDistance: int(s.lockDistance, 6, 2, 30),
    unlockChance: int(s.unlockChance, 60, 0, 100),
    unlockSeconds: int(s.unlockSeconds, 5, 1, 60),
    hotwireChance: int(s.hotwireChance, 35, 0, 100),
    hotwireSeconds: int(s.hotwireSeconds, 10, 1, 120),
    breakChance: int(s.breakChance, 25, 0, 100),
  };
}

export const normalizePlate = (plate: string): string =>
  plate.trim().toUpperCase();
