import { int, record } from "@aicore-fivem/lib/shared";

/** ai-vehiclekeys' contracts. No natives. */

export const EVENTS = {
  /** Callback: (netId) -> boolean, whether the player holds a key to the vehicle (asked on taking the driver seat). */
  check: "ai-vehiclekeys:check",
  /** Server -> owner: (netId) a key to this vehicle was given while sitting in it: the engine may start. */
  granted: "ai-vehiclekeys:client:granted",
  /** Server -> client callback: (game: "skillCheck" | "lockpick", difficulty) -> "opened" | "broken" | "cancelled", the lockpick's minigame. */
  minigame: "ai-vehiclekeys:minigame",
  /** Callback: (netId) -> { ok, locked? } toggle the lock of a vehicle the player has a key to. */
  toggleLock: "ai-vehiclekeys:toggleLock",
  /** Callback: (netId) -> { ok } give a copy of this vehicle's key to the nearest player (both get a notification). */
  giveNearest: "ai-vehiclekeys:giveNearest",
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
  /** Played before the progress bar; a lockpick broken in it is spent. */
  minigame: "off" | "skillCheck" | "lockpick";
  minigameDifficulty: "easy" | "medium" | "hard";
}

const MINIGAMES = ["off", "skillCheck", "lockpick"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const oneOf = <T extends string>(
  list: readonly T[],
  v: unknown,
  fallback: T,
): T => list.find((x) => x === v) ?? fallback;

export function readSettings(raw: unknown): Settings {
  const s = record(raw);
  return {
    lockDistance: int(s.lockDistance, 6, 2, 30),
    unlockChance: int(s.unlockChance, 60, 0, 100),
    unlockSeconds: int(s.unlockSeconds, 5, 1, 60),
    hotwireChance: int(s.hotwireChance, 35, 0, 100),
    hotwireSeconds: int(s.hotwireSeconds, 10, 1, 120),
    breakChance: int(s.breakChance, 25, 0, 100),
    minigame: oneOf(MINIGAMES, s.minigame, "lockpick"),
    minigameDifficulty: oneOf(DIFFICULTIES, s.minigameDifficulty, "medium"),
  };
}

export const normalizePlate = (plate: string): string =>
  plate.trim().toUpperCase();
