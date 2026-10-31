import { optionalExport } from "@aicore-fivem/lib/server";
import { normalizePlate } from "@aicore-fivem/lib/shared";
import { VEHICLES_EVENTS, type VehicleOwner } from "@aicore-fivem/shared";

const toOwner = (v: unknown): [string, VehicleOwner] | null => {
  if (!Array.isArray(v)) return null;
  const [plate, type, id]: unknown[] = v;
  if (typeof plate !== "string" || typeof id !== "string") return null;
  if (
    type !== "character" &&
    type !== "job" &&
    type !== "gang" &&
    type !== "resource"
  )
    return null;
  return [normalizePlate(plate), { type, id }];
};

/**
 * Plate -> owner of every owned vehicle ai-vehicles holds in memory: its snapshot once at start, then its
 * `ai-vehicles:owners` batches. Key checks read this map, never ai-vehicles' exports.
 */
class Owners {
  private readonly byPlate = new Map<string, VehicleOwner>();

  constructor() {
    on(VEHICLES_EVENTS.owners, (puts: unknown, removes: unknown) =>
      this.apply(puts, removes),
    );
    this.apply(optionalExport("ai-vehicles")?.GetPlateOwners() ?? [], []);
  }

  get(plate: string): VehicleOwner | undefined {
    return this.byPlate.get(plate);
  }

  private apply(puts: unknown, removes: unknown): void {
    if (Array.isArray(removes))
      for (const plate of removes)
        if (typeof plate === "string")
          this.byPlate.delete(normalizePlate(plate));
    if (!Array.isArray(puts)) return;
    for (const item of puts) {
      const entry = toOwner(item);
      if (entry) this.byPlate.set(entry[0], entry[1]);
    }
  }
}

export const owners = new Owners();
