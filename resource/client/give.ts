import {
  cache,
  onCache,
  radial,
  triggerServerCallback,
} from "@aicore-fivem/lib/client";
import { RADIAL_VEHICLE } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS } from "common/keys";

/**
 * Whether the player holds the key of the vehicle they sit in (any seat): asked once per vehicle entry (the engine
 * block reads the same answer), set by `granted`. The radial item shows from it.
 */
class SeatKey {
  held = false;
  private vehicle = 0;
  private answer: Promise<boolean> = Promise.resolve(false);

  ask(vehicle: number): Promise<boolean> {
    if (vehicle === this.vehicle) return this.answer;
    this.vehicle = vehicle;
    this.held = false;
    this.answer = triggerServerCallback(EVENTS.check, [
      NetworkGetNetworkIdFromEntity(vehicle),
    ])
      .then((v) => v === true)
      .catch(() => false)
      .then((held) => {
        if (this.vehicle === vehicle) this.set(held);
        return held;
      });
    return this.answer;
  }

  set(held: boolean): void {
    this.held = held;
    this.answer = Promise.resolve(held);
    radial.refresh();
  }

  leave(): void {
    this.vehicle = 0;
    this.held = false;
    this.answer = Promise.resolve(false);
  }
}

export const seatKey = new SeatKey();
onCache("vehicle", (vehicle) =>
  vehicle === false ? seatKey.leave() : void seatKey.ask(vehicle),
);

// The server checks the key and the distance, and notifies both players.
radial.add({
  id: "givekeys",
  parent: RADIAL_VEHICLE,
  label: Locale("RADIAL_GIVE_KEYS"),
  icon: "hand-holding",
  canShow: () => cache.vehicle !== false && seatKey.held,
  onPressed: () => {
    if (cache.vehicle === false) return;
    void triggerServerCallback(EVENTS.giveNearest, [
      NetworkGetNetworkIdFromEntity(cache.vehicle),
    ]).catch(() => null);
  },
});
