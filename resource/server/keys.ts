import { resourceExport } from "@aicore-fivem/lib/server"
import { CORE, type CharacterInfo } from "@aicore-fivem/shared"
import { EVENTS, normalizePlate } from "common/keys"

const core = resourceExport("ai-core")
const vehiclesApi = resourceExport("ai-vehicles")

/**
 * Who may drive and lock what. Owned vehicles: their character owner, or members of their job / gang (from
 * ai-vehicles, always current). Other keys (given by scripts, hotwired) live for the character's session. Clients
 * ask when they take a driver seat; nothing is pushed.
 */
class Keys {
  private readonly extra = new Map<number, Set<string>>()

  load(source: number): void {
    this.extra.set(source, new Set())
  }

  drop(source: number): void {
    this.extra.delete(source)
  }

  /** Whether the player holds a key to the plate (given, hotwired, or the owned vehicle's owner / fleet member). */
  has(source: number, plate: string): boolean {
    const p = normalizePlate(plate)
    if (this.extra.get(source)?.has(p)) return true
    const vehicle = vehiclesApi.GetVehicle(p)
    if (!vehicle) return false
    const { type, id } = vehicle.owner
    if (type === "character")
      return String(core.GetCharacter(source)?.id ?? "") === id
    if (type === "job")
      return (core.GetJobs(source) ?? []).some((m) => m.job === id)
    return (core.GetGangs(source) ?? []).some((m) => m.gang === id)
  }

  give(source: number, plate: string): void {
    const set = this.extra.get(source)
    const p = normalizePlate(plate)
    if (!set || set.has(p)) return
    set.add(p)
    // Sitting in that vehicle right now (hotwired, or a script handed the key): the engine may start.
    const vehicle = GetVehiclePedIsIn(GetPlayerPed(String(source)), false)
    if (vehicle && normalizePlate(GetVehicleNumberPlateText(vehicle)) === p)
      emitNet(EVENTS.granted, source, NetworkGetNetworkIdFromEntity(vehicle))
  }

  remove(source: number, plate: string): void {
    const p = normalizePlate(plate)
    this.extra.get(source)?.delete(p)
  }
}

export const keys = new Keys()

on(CORE.playerLoadedEvent, (source: number, _character: CharacterInfo) =>
  keys.load(source)
)
on(CORE.playerUnloadedEvent, (source: number) => keys.drop(source))
on("playerDropped", () => keys.drop(Number(globalThis.source)))
for (const source of core.GetLoadedSources()) keys.load(source)
