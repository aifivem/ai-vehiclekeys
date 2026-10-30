import {
  onCharacter,
  online,
  PlayerMap,
  resourceExport,
} from "@aicore-fivem/lib/server";
import { EVENTS, normalizePlate } from "common/keys";

const vehiclesApi = resourceExport("ai-vehicles");

/**
 * Who may drive and lock what. Owned vehicles: their character owner, or members of their job / gang (owner from
 * ai-vehicles, always current; the player's character, jobs and gangs from lib `online`). Other keys (given by
 * scripts, hotwired) live for the character's session. Clients ask when they take a driver seat; nothing is pushed.
 */
class Keys {
  private readonly extra = new PlayerMap<Set<string>>();

  load(source: number): void {
    this.extra.set(source, new Set());
  }

  drop(source: number): void {
    this.extra.delete(source);
  }

  /** Whether the player holds a key to the plate (given, hotwired, or the owned vehicle's owner / fleet member). */
  has(source: number, plate: string): boolean {
    const p = normalizePlate(plate);
    if (this.extra.get(source)?.has(p)) return true;
    const vehicle = vehiclesApi.GetVehicle(p);
    if (!vehicle) return false;
    const { type, id } = vehicle.owner;
    if (type === "character")
      return String(online.character(source)?.id ?? "") === id;
    if (type === "job") return online.jobs(source).includes(id);
    return online.gangs(source).includes(id);
  }

  give(source: number, plate: string): void {
    const set = this.extra.get(source);
    const p = normalizePlate(plate);
    if (!set || set.has(p)) return;
    set.add(p);
    // Sitting in that vehicle right now (hotwired, or a script handed the key): the engine may start.
    const vehicle = GetVehiclePedIsIn(GetPlayerPed(String(source)), false);
    if (vehicle && normalizePlate(GetVehicleNumberPlateText(vehicle)) === p)
      emitNet(EVENTS.granted, source, NetworkGetNetworkIdFromEntity(vehicle));
  }

  remove(source: number, plate: string): void {
    const p = normalizePlate(plate);
    this.extra.get(source)?.delete(p);
  }
}

export const keys = new Keys();

// Also the players already in the game after a restart of this resource.
onCharacter({
  loaded: (source) => keys.load(source),
  unloaded: (source) => keys.drop(source),
});
