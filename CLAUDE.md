# ai-vehiclekeys

Vehicle keys, locking (L), lockpicking (doors) and hotwiring (driver seat), and the engine block without a key. Stands in for `qbx_vehiclekeys`. Depends on ai-core (characters, jobs, gangs), ai-vehicles (ownership) and the active inventory through ai-core's inventory layer (lib `inventory`) (the `lockpick` item).

## Decisions

- Ownership keys are never stored: an owned vehicle's character owner and its job / gang members always have its key (`server/keys.ts` asks ai-vehicles for the owner; the player's character, jobs and gangs come from lib `online`, no ai-core export per check). Session keys live in a `PlayerMap` filled by lib `onCharacter` (also after a restart). Other keys (`GiveKeys` from ai-core's key layer, hotwiring) live for the session.
- Clients do not mirror keys: on entering a vehicle (any seat) the client asks once (`ai-vehiclekeys:check`, `client/give.ts` `SeatKey`, answer shared with the engine block); in the driver seat without a key the engine is held off twice a second until a key arrives (`client:granted`) or the player leaves the seat.
- Handing over keys: the radial vehicle category's "Hand over the keys" item (lib `radial`, `parent: RADIAL_VEHICLE`) shows while the player sits in a vehicle they hold the key of. The server (`server/give.ts`) checks the vehicle is within 6 m, the giver holds its key and picks the closest other player with a character within 3 m (lib `nearestPlayerTo`), gives that player a session key (the giver keeps theirs) and notifies both. It uses the key store itself, not lib `vehicleKeys`: this resource is the key system.
- Locks are set by the server (`SetVehicleDoorsLocked`) after the key and distance check; the key fob flash and horn are local.
- Lockpicking is two steps like item use: the server picks the nearest locked vehicle within 3 m (lib `nearestVehicleTo` with a lock filter) and sends the progress (lib `PendingActions`), the client calls `finishPick`, the server refuses a wrong token, a finish earlier than 80 % of the time or a player more than 4 m from the vehicle, then rolls the panel chances.
- While a driver has no key, the ped's config flag 429 (cannot start engines) is on: ai-radialmenu's engine item reads it and refuses to start the engine.
- Plates compare normalized (`normalizePlate`: trimmed, upper case) everywhere (`server/vehicles.ts` `plateOf`).

## Contracts

- Events: `resource/common/keys.ts`. Exports (own and `qbx_vehiclekeys`): `HasKeys(source, vehicle | plate)`, `GiveKeys`, `RemoveKeys`, `SetLockState(vehicle, state)`, `IsPlayerNearVehicle`. ai-* scripts never call these directly: they use lib `vehicleKeys`, and ai-core's key layer calls them while ai-vehiclekeys is the active key system (`docs/compat/vehicle-keys.md`).
- Registers the `lockpick` usable item once with ai-core's inventory layer, which hands it to whichever inventory runs (also after it restarts).

## Entry points

- Keys: `resource/server/keys.ts`; lock, check, lockpick and exports `server/index.ts`; handing over `server/give.ts`.
- Client: lock key, engine block, lockpick progress `resource/client/index.ts`; key answer per vehicle and the radial item `client/give.ts`.
