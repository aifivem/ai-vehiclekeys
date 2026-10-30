import {
  AdminPanel,
  inventory,
  notify,
  onClientCallback,
  provideExport,
  registerExport,
} from "@aicore-fivem/lib/server"
import { asArgs } from "@aicore-fivem/lib/shared"
import { Locale } from "common"
import { EVENTS, readSettings } from "common/keys"
import { keys } from "./keys"
import { keysSchema } from "./schema"

const panel = new AdminPanel(keysSchema)
/** Panel settings, parsed again after every change. */
const content = { settings: readSettings(panel.get("settings")) }
panel.onChange(
  "settings",
  () => (content.settings = readSettings(panel.get("settings")))
)

const plateOf = (vehicle: number): string => GetVehicleNumberPlateText(vehicle)
const netIdArg = ([netId]: unknown[]) =>
  asArgs(
    typeof netId === "number" && Number.isInteger(netId) && netId > 0
      ? netId
      : null
  )

/** A networked vehicle within `metres` of the player, or null. */
function vehicleNear(
  source: number,
  netId: number,
  metres: number
): number | null {
  const vehicle = NetworkGetEntityFromNetworkId(netId)
  if (!vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2)
    return null
  const [px = 0, py = 0, pz = 0] = GetEntityCoords(GetPlayerPed(String(source)))
  const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(vehicle)
  return Math.hypot(px - vx, py - vy, pz - vz) <= metres ? vehicle : null
}

onClientCallback(EVENTS.check, { args: netIdArg }, (source, netId) => {
  const vehicle = vehicleNear(source, netId, 6)
  return vehicle !== null && keys.has(source, plateOf(vehicle))
})

onClientCallback(
  EVENTS.toggleLock,
  { args: netIdArg, lock: true },
  (source, netId) => {
    const vehicle = vehicleNear(source, netId, content.settings.lockDistance)
    if (vehicle === null) return { ok: false, error: "KEYS_ERR_FAR" }
    if (!keys.has(source, plateOf(vehicle)))
      return { ok: false, error: "KEYS_ERR_NO_KEY" }
    const locked = GetVehicleDoorLockStatus(vehicle) >= 2
    SetVehicleDoorsLocked(vehicle, locked ? 1 : 2)
    notify(
      source,
      Locale(locked ? "KEYS_UNLOCKED" : "KEYS_LOCKED"),
      "success",
      2000
    )
    return { ok: true, locked: !locked }
  }
)

/** Lockpick tries waiting for their progress bar: checked against the time they need. */
const picks = new Map<
  number,
  {
    token: number
    kind: "unlock" | "hotwire"
    vehicle: number
    startedAt: number
    seconds: number
  }
>()
let nextToken = 0

/** The lockpick item: from the driver seat it hotwires, next to a locked vehicle it opens the door. */
function useLockpick(source: number): boolean {
  const ped = GetPlayerPed(String(source))
  const seat = GetVehiclePedIsIn(ped, false)
  const s = content.settings
  let kind: "unlock" | "hotwire"
  let vehicle: number
  if (seat && GetPedInVehicleSeat(seat, -1) === ped) {
    if (keys.has(source, plateOf(seat))) return false
    kind = "hotwire"
    vehicle = seat
  } else {
    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped)
    const near = (GetAllVehicles() as number[]).find((v) => {
      const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(v)
      return (
        Math.hypot(vx - x, vy - y, vz - z) <= 3 &&
        GetVehicleDoorLockStatus(v) >= 2
      )
    })
    if (!near) return false
    kind = "unlock"
    vehicle = near
  }
  const token = ++nextToken
  const seconds = kind === "hotwire" ? s.hotwireSeconds : s.unlockSeconds
  picks.set(source, { token, kind, vehicle, startedAt: Date.now(), seconds })
  emitNet(EVENTS.startPick, source, kind, token, seconds)
  // The lockpick is spent only when it breaks (finishPick).
  return false
}

onClientCallback(
  EVENTS.finishPick,
  {
    args: ([token]) => asArgs(typeof token === "number" ? token : null),
    lock: true,
  },
  (source, token) => {
    const pick = picks.get(source)
    if (!pick || pick.token !== token)
      return { ok: false, error: "KEYS_ERR_FAR" }
    picks.delete(source)
    if (
      Date.now() - pick.startedAt < pick.seconds * 800 ||
      !DoesEntityExist(pick.vehicle)
    )
      return { ok: false, error: "KEYS_ERR_FAR" }
    const s = content.settings
    const success =
      Math.random() * 100 <
      (pick.kind === "hotwire" ? s.hotwireChance : s.unlockChance)
    if (success) {
      if (pick.kind === "hotwire") keys.give(source, plateOf(pick.vehicle))
      else SetVehicleDoorsLocked(pick.vehicle, 1)
      notify(
        source,
        Locale(pick.kind === "hotwire" ? "KEYS_HOTWIRED" : "KEYS_PICKED"),
        "success"
      )
      return { ok: true }
    }
    if (Math.random() * 100 < s.breakChance) {
      inventory.removeItem(source, "lockpick", 1)
      notify(source, Locale("KEYS_BROKE"), "error")
    } else notify(source, Locale("KEYS_FAILED"), "warning")
    return { ok: true }
  }
)

inventory.registerUsableItem("lockpick", (source: number) =>
  useLockpick(source)
)
on("playerDropped", () => picks.delete(Number(globalThis.source)))

/** Own exports and qbx_vehiclekeys (`provide qbx_vehiclekeys`): vehicles by entity or plate. */
const plateFrom = (vehicle: unknown): string | null =>
  typeof vehicle === "string"
    ? vehicle
    : typeof vehicle === "number" && DoesEntityExist(vehicle)
      ? plateOf(vehicle)
      : null
const api: Record<string, (...args: unknown[]) => unknown> = {
  HasKeys: (source, vehicle) => {
    const plate = plateFrom(vehicle)
    return (
      typeof source === "number" && plate !== null && keys.has(source, plate)
    )
  },
  GiveKeys: (source, vehicle) => {
    const plate = plateFrom(vehicle)
    if (typeof source === "number" && plate) keys.give(source, plate)
  },
  RemoveKeys: (source, vehicle) => {
    const plate = plateFrom(vehicle)
    if (typeof source === "number" && plate) keys.remove(source, plate)
  },
  SetLockState: (vehicle, state) => {
    if (typeof vehicle === "number" && DoesEntityExist(vehicle))
      SetVehicleDoorsLocked(
        vehicle,
        state === "lock" || state === true || state === 2 ? 2 : 1
      )
  },
  IsPlayerNearVehicle: (source, vehicle) =>
    typeof source === "number" &&
    typeof vehicle === "number" &&
    vehicleNear(source, NetworkGetNetworkIdFromEntity(vehicle), 5) !== null,
}
for (const [name, fn] of Object.entries(api)) {
  registerExport(name, fn)
  provideExport("qbx_vehiclekeys", name, fn)
}
