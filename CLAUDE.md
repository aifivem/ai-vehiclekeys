# ai-vehiclekeys

Vehicle keys, locking (L), lockpicking (doors) and hotwiring (driver seat), and the engine block without a key. Stands in for `qbx_vehiclekeys`. Depends on ai-core (characters, jobs, gangs), ai-vehicles (ownership) and ai-inventory (the `lockpick` item, optional). Research and decisions: `docs/research/vehicles.md`.

## Decisions

- Ownership keys are never stored: an owned vehicle's character owner and its job / gang members always have its key (`server/keys.ts` asks ai-vehicles). Other keys (scripts' `GiveKeys`, hotwiring) live for the session.
- Clients do not mirror keys: on taking a driver seat the client asks once (`ai-vehiclekeys:check`); without a key the engine is held off twice a second until a key arrives (`client:granted`) or the player leaves the seat.
- Locks are set by the server (`SetVehicleDoorsLocked`) after the key and distance check; the key fob flash and horn are local.
- Lockpicking is two steps like item use: the server picks the vehicle and sends the progress, the client calls `finishPick`, the server refuses a finish earlier than 80 % of the time and rolls the panel chances.

## Contracts

- Events: `resource/common/keys.ts`. Exports (own and `qbx_vehiclekeys`): `HasKeys(source, vehicle | plate)`, `GiveKeys`, `RemoveKeys`, `SetLockState(vehicle, state)`, `IsPlayerNearVehicle`.
- Registers the `lockpick` usable item with ai-inventory (again when ai-inventory restarts).

## Entry points

- Keys: `resource/server/keys.ts`; lock, check, lockpick and exports `server/index.ts`.
- Client: lock key, engine block, lockpick progress `resource/client/index.ts`.
