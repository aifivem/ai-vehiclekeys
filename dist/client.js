/*aicore-client-errors*/(function(){var n=GetCurrentResourceName(),s={},c=0;var r=function(t){t=String(t).replace(/\^\d/g,"");var k=t.slice(0,300);if(s[k]||c>=20)return;s[k]=1;c++;try{TriggerServerEvent("ai-core:clientError",n,t.slice(0,4000))}catch(e){}};globalThis.__aicoreReportError=r;var l=console.log;console.log=function(){var a=arguments[0];if(typeof a==="string"&&a.indexOf("SCRIPT ERROR")!==-1)r(a);return l.apply(console,arguments)}})();
try{
(function() {

// ../../../packages/lib/src/fivem/callbackNames.ts
/**
	* Callback wire format, the same on both sides:
	*   request  `aicore:cb:<name>`              (callerResource, id, ...args)
	*   response `aicore:cbr:<callerResource>`   (id, ok, result)
	* The response goes only to the resource that asked, so two resources never see each other's replies.
	*/
	const requestEvent = (name) => `aicore:cb:${name}`;
	const responseEvent = (resource) => `aicore:cbr:${resource}`;
	/** Default time a caller waits for an answer before the promise rejects. */
	const DEFAULT_CALLBACK_TIMEOUT = 3e4;

// ../../../packages/lib/src/shared/wait.ts
/**
	* Resolves with the first value `check` returns that is not undefined, checking once per tick.
	* Rejects after `timeoutMs` (default 10 s); pass `false` to wait forever.
	* Return `cond || undefined` from `check` to wait for a truthy condition.
	*/
	function waitFor(check, timeoutMs = 1e4) {
		return new Promise((resolve, reject) => {
			const started = Date.now();
			const poll = () => {
				const value = check();
				if (value !== void 0) return resolve(value);
				if (timeoutMs !== false && Date.now() - started > timeoutMs) return reject(/* @__PURE__ */ new Error(`waitFor timed out after ${timeoutMs} ms`));
				setTimeout(poll, 0);
			};
			poll();
		});
	}

// ../../../packages/lib/src/shared/index.ts
	function isRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	/** Fills `{0}`, `{1}`... with the arguments by position (a translation may reorder or repeat them). */
	function formatText(template, args) {
		return template.replace(/\{(\d+)\}/g, (match, index) => {
			const value = args[Number(index)];
			return value === void 0 ? match : String(value);
		});
	}
	/** Console output prefixed with the resource name, so server logs show where a line came from. */
	function createLogger(resource) {
		const prefix = `[${resource}]`;
		return {
			info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
			warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
			error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
		};
	}

// ../../../packages/lib/src/client/netEvent.ts
	const log$2 = createLogger(GetCurrentResourceName());
	/**
	* Whether the net event being handled came from the server (read it before the first `await`). On a client only
	* events from the server carry a source (65535 in the docs); a local emit by any resource carries none.
	*/
	const fromServer = () => Boolean(globalThis.source);
	function onServerEvent(name, first, second) {
		const [handler, parse] = typeof first === "function" ? [first, null] : [second, first.args];
		onNet(name, (...raw) => {
			if (!fromServer() || !handler) return;
			const args = parse ? parse(raw) : [];
			if (!args) return log$2.warn(`event ${name} from the server had invalid arguments`);
			Promise.resolve().then(() => handler(...args)).catch((error) => log$2.error(`event ${name} failed`, error));
		});
	}

// ../../../packages/lib/src/client/callback.ts
	const resource$1 = GetCurrentResourceName();
	const log$1 = createLogger(resource$1);
	const pending = /* @__PURE__ */ new Map();
	let nextId = 0;
	onNet(responseEvent(resource$1), (id, ok, result) => {
		if (!fromServer()) return;
		const entry = typeof id === "number" ? pending.get(id) : void 0;
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		if (ok === true) entry.resolve(result);
		else entry.reject(/* @__PURE__ */ new Error("server callback failed"));
	});
	/**
	* Asks the server (`onClientCallback(name, ...)` there) and resolves with its answer. The answer is unknown:
	* parse it. Rejects when the server reports an error or does not answer within `timeoutMs`.
	*/
	function triggerServerCallback(name, args = [], timeoutMs = DEFAULT_CALLBACK_TIMEOUT) {
		const id = ++nextId;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(/* @__PURE__ */ new Error(`server callback ${name} timed out`));
			}, timeoutMs);
			pending.set(id, {
				resolve,
				reject,
				timer
			});
			emitNet(requestEvent(name), resource$1, id, ...args);
		});
	}

// ../../../packages/shared/src/core.ts
/** Names owned by ai-core that other resources, the bridges and the build step use. */
	const CORE = {
		resource: "ai-core",
		/** Client -> server: (resource: string, text: string). Sent by the reporter every client bundle carries. */
		clientErrorEvent: "ai-core:clientError",
		/** (src, character: CharacterInfo) after a character is loaded and spawned. */
		playerLoadedEvent: "ai-core:playerLoaded",
		/** (src, charId, reason: UnloadReason) before a character's state is dropped. */
		playerUnloadedEvent: "ai-core:playerUnloaded",
		/** (src, account: string, balance: number, delta: number, reason: string) */
		moneyChangedEvent: "ai-core:moneyChanged",
		/** (src, jobs: JobMembership[]) */
		jobsChangedEvent: "ai-core:jobsChanged",
		/** (src, job: string | null) */
		dutyChangedEvent: "ai-core:dutyChanged",
		/** (src, gangs: GangMembership[]) */
		gangsChangedEvent: "ai-core:gangsChanged",
		/** (src, gang: string | null) */
		activeGangChangedEvent: "ai-core:activeGangChanged",
		/** (src, charIds: number[]) each time a player's character screen loads; an appearance resource answers with portraits. */
		characterScreenEvent: "ai-core:characterScreen",
		/** (resource: string | null) the inventory behind ai-core's inventory layer changed (the bridge drops its item cache). */
		inventoryChangedEvent: "ai-core:inventoryChanged",
		/** (src, name: string, status: Record<string, number> | null) a player used an item; status = the needs it gives, from inventories that define them. */
		itemUsedEvent: "ai-core:itemUsed",
		/** (src, killer: number | null, weaponHash: number) a player with a loaded character died; fired from FXServer's `onPedDeath` (needs `PED_DEATH_STATE_KEY`). */
		playerDiedEvent: "ai-core:playerDied",
		clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
		clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
		/** (charId: number, url: string) a portrait image of a character on the character screen (e.g. `https://nui-img/<txd>/<txd>`). */
		clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
		/** (charId: number) ai-appearance holds this character's look: ai-core dresses its scene ped with `ApplyCharacterAppearance`. */
		clientCharacterLookEvent: "ai-core:client:characterLook",
		/** (resource: string, id: string) the interaction key was pressed while that resource's prompt was on top. */
		clientPromptPressedEvent: "ai-core:client:promptPressed",
		/** (key: keyof PlayerCache, value) a cached value of the local player changed (one watcher in ai-core for every resource). */
		clientCacheEvent: "ai-core:client:cache",
		charactersCallback: "ai-core:characters",
		createCharacterCallback: "ai-core:createCharacter",
		deleteCharacterCallback: "ai-core:deleteCharacter",
		selectCharacterCallback: "ai-core:selectCharacter",
		/** Server -> client: (notification: Notification) a notification card on the player's screen. */
		clientNotifyEvent: "ai-core:client:notify",
		/** Server -> client: (spawn: SpawnPoint) puts the loaded character into the world. */
		spawnEvent: "ai-core:client:spawn",
		/** Server -> client: () the character was let go (switch); show the character screen again. */
		openCharactersEvent: "ai-core:client:openCharacters"
	};

// ../../../packages/shared/src/menu.ts
	const MENU_EVENTS = {
		/** Client local: (resource, requestId, itemId | null) the player picked an item or closed the menu. */
		menuResult: "ai-core:client:menuResult",
		/** Client local: (resource, requestId, itemId) the pointer or focus is on an item (previews). */
		menuHover: "ai-core:client:menuHover",
		/** Client local: (resource, requestId, values | null) the player confirmed or closed the input dialog. */
		inputResult: "ai-core:client:inputResult"
	};

// ../../../packages/shared/src/commands.ts
/** Client local events between the lib's `Keybind` and ai-core's client. */
	const KEYBIND = {
		/** lib -> ai-core: (info: KeybindInfo) a keybind waits for its default key. */
		announceEvent: "ai-core:client:keybind",
		/** ai-core -> lib: (resource, name, key) the default key to register: the panel's value, else the script's. */
		keyEvent: "ai-core:client:keybindKey"
	};

// ../../../packages/lib/src/client/cache.ts
/** The unarmed "weapon" hash: cached as `false`. */
	const UNARMED = GetHashKey("WEAPON_UNARMED") | 0;
	/** The vehicle, seat and weapon of a ped right now (also ai-core's watcher). */
	function readPlayerState(ped) {
		const vehicle = GetVehiclePedIsIn(ped, false);
		let seat = false;
		if (vehicle) for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle); i++) {
			if (GetPedInVehicleSeat(vehicle, i) !== ped) continue;
			seat = i;
			break;
		}
		const weapon = GetSelectedPedWeapon(ped) | 0;
		return {
			vehicle: vehicle || false,
			seat,
			weapon: weapon === UNARMED ? false : weapon
		};
	}
	/**
	* The local player's often read values (ped, player id, server id, vehicle, seat, weapon), like ox_lib's `cache`:
	* read `cache.ped` instead of calling PlayerPedId() in loops. One watcher in ai-core updates every resource through
	* a local event, so no resource polls for these itself. Read only.
	*/
	const ped = PlayerPedId();
	const cache = {
		ped,
		playerId: PlayerId(),
		serverId: GetPlayerServerId(PlayerId()),
		...readPlayerState(ped)
	};
	const handlers = /* @__PURE__ */ new Map();
	const valid = (key, value) => key === "ped" || key === "playerId" || key === "serverId" ? typeof value === "number" : typeof value === "number" || value === false;
	on(CORE.clientCacheEvent, (key, value) => {
		if (typeof key !== "string" || !(key in cache)) return;
		const name = key;
		if (!valid(name, value) || cache[name] === value) return;
		const old = cache[name];
		cache[name] = value;
		for (const handler of handlers.get(name) ?? []) handler(value, old);
	});
	/** Runs `handler(value, old)` whenever a cached value changes (entering a vehicle, a new ped after a model swap...). */
	function onCache(key, handler) {
		let set = handlers.get(key);
		if (!set) handlers.set(key, set = /* @__PURE__ */ new Set());
		set.add(handler);
	}

// ../../../packages/lib/src/client/zones.ts
/**
	* Zones on this client: inside / outside checks at each zone's own interval, never per frame. Built for any count
	* (measured with 1,000,000 zones): zones sit in a grid of 64 m cells and a check looks only at the player's cell and
	* the zones the player is in.
	*/
	const log = createLogger(GetCurrentResourceName());

// ../../../packages/lib/src/fivem/exports.ts
/** Typed access to another resource's exports (types come from CitizenExports in @aicore-fivem/shared). */
	function resourceExport(resource) {
		return globalThis.exports[resource];
	}
	/** Whether a resource is running now. */
	function isResourceStarted(resource) {
		return GetResourceState(resource) === "started";
	}

// ../../../packages/lib/src/client/streaming.ts
/** Loads an animation dictionary. Call `RemoveAnimDict(dict)` when it is no longer played. */
	async function requestAnimDict(dict, timeoutMs = 1e4) {
		if (!DoesAnimDictExist(dict)) throw new Error(`anim dict ${dict} does not exist`);
		RequestAnimDict(dict);
		await waitFor(() => HasAnimDictLoaded(dict) || void 0, timeoutMs);
		return dict;
	}

// ../../../packages/lib/src/client/notify.ts
/** Shows a notification card on this player's screen (ai-core draws it); `text` is already translated. */
	function notify(text, kind = "info", duration) {
		resourceExport(CORE.resource).Notify({
			text,
			kind,
			duration
		});
	}
	/**
	* Runs a timed action with ai-core's progress bar and an optional animation; resolves true when it ran out, false
	* when cancelled (death, getting into a vehicle). Checks ten times a second, nothing per frame.
	*/
	async function progress(options) {
		const core = resourceExport(CORE.resource);
		const ped = cache.ped;
		if (options.anim) {
			await requestAnimDict(options.anim.dict);
			TaskPlayAnim(ped, options.anim.dict, options.anim.clip, 3, 3, options.duration, options.anim.flag ?? 49, 0, false, false, false);
		}
		core.ShowProgress(options.label, options.duration);
		const end = GetGameTimer() + options.duration;
		const done = await new Promise((resolve) => {
			const timer = setInterval(() => {
				const cancelled = IsEntityDead(cache.ped) || !options.allowVehicle && cache.vehicle !== false;
				if (!cancelled && GetGameTimer() < end) return;
				clearInterval(timer);
				resolve(!cancelled);
			}, 100);
		});
		if (options.anim) StopAnimTask(ped, options.anim.dict, options.anim.clip, 1);
		core.HideProgress();
		return done;
	}

// ../../../packages/lib/src/client/menu.ts
/** Menus and input dialogs this resource asked ai-core for, waiting for the player's answer. */
	var Requests = class {
		resource = GetCurrentResourceName();
		waiting = /* @__PURE__ */ new Map();
		hovers = /* @__PURE__ */ new Map();
		nextId = 0;
		constructor() {
			const answer = (owner, id, value) => {
				if (owner !== this.resource || typeof id !== "number") return;
				this.waiting.get(id)?.(value);
				this.waiting.delete(id);
				this.hovers.delete(id);
			};
			on(MENU_EVENTS.menuHover, (owner, id, item) => {
				if (owner === this.resource && typeof id === "number" && typeof item === "string") this.hovers.get(id)?.(item);
			});
			on(MENU_EVENTS.menuResult, answer);
			on(MENU_EVENTS.inputResult, answer);
		}
		ask(open, read, onHover) {
			const id = ++this.nextId;
			this.waiting.set(id, read);
			if (onHover) this.hovers.set(id, onHover);
			open(id);
		}
	};
	const requests = new Requests();

// ../../../packages/lib/src/client/vehicleProps.ts
	const MOD_TYPES = Array.from({ length: 50 }, (_, i) => i);

// ../../../packages/lib/src/client/keybind.ts
	const resource = GetCurrentResourceName();
	/** Keybinds of this resource waiting for ai-core's answer (the panel's default key, else their own). */
	const waiting = /* @__PURE__ */ new Map();
	let listening = false;
	/** Asks ai-core's client for the default key (it knows the panel's keybind defaults); without ai-core the script's own. */
	function requestKey(info, apply) {
		if (resource !== CORE.resource && !isResourceStarted(CORE.resource)) return apply(info.defaultKey);
		if (!listening) {
			listening = true;
			on(KEYBIND.keyEvent, (owner, name, key) => {
				if (owner !== resource || typeof name !== "string" || typeof key !== "string") return;
				const done = waiting.get(name);
				waiting.delete(name);
				done?.(key);
			});
		}
		waiting.set(info.name, apply);
		emit(KEYBIND.announceEvent, info);
		setTimeout(() => {
			if (waiting.get(info.name) !== apply) return;
			waiting.delete(info.name);
			apply(info.defaultKey);
		}, 15e3);
	}
	/**
	* A key the player can rebind in GTA's settings (RegisterKeyMapping); no per-frame key polling. The default key
	* comes from ai-core's admin panel when set there: the mapping command carries the key (`+<name>_<key>`), so a new
	* default makes a new mapping that every player gets. It is registered once ai-core answered (at start).
	*/
	var Keybind = class {
		options;
		name;
		disabled;
		pressed = false;
		hash = 0;
		constructor(options) {
			this.options = options;
			this.name = options.name;
			this.disabled = options.disabled ?? false;
			requestKey({
				resource,
				name: options.name,
				description: options.description,
				defaultKey: options.defaultKey ?? "",
				mapper: options.defaultMapper ?? "keyboard"
			}, (key) => this.register(key.toUpperCase()));
		}
		register(key) {
			const command = key ? `${this.name}_${key}` : this.name;
			this.hash = GetHashKey(`+${command}`) | 2147483648;
			RegisterCommand(`+${command}`, () => this.press(true), false);
			RegisterCommand(`-${command}`, () => this.press(false), false);
			RegisterKeyMapping(`+${command}`, this.options.description, this.options.defaultMapper ?? "keyboard", key);
			setTimeout(() => {
				emit("chat:removeSuggestion", `/+${command}`);
				emit("chat:removeSuggestion", `/-${command}`);
			}, 500);
		}
		press(down) {
			if (this.disabled || !this.options.allowInPauseMenu && IsPauseMenuActive()) return;
			this.pressed = down;
			if (down) this.options.onPressed?.();
			else this.options.onReleased?.();
		}
		/** Whether the key is held now. */
		get isPressed() {
			return this.pressed;
		}
		/** The key the player has bound right now, for HUD hints ("" until the mapping is registered). */
		get currentKey() {
			return this.hash ? GetControlInstructionalButton(0, this.hash, true).substring(2) : "";
		}
		disable(disabled) {
			this.disabled = disabled;
			this.pressed = false;
		}
	};

// ../../../packages/lib/src/fivem/locale.ts
/** Convar holding the language (`setr ai:locale "en"` in misc.cfg); replicated so clients read it too. */
	const LOCALE_CONVAR = "ai:locale";
	function readLocaleFile(resource, lang) {
		const raw = LoadResourceFile(resource, `locales/${lang}.json`);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed)) return {};
		const texts = {};
		for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") texts[key] = value;
		return texts;
	}
	/**
	* The resource's lang texts: `locales/en.json` (complete base) overlaid with `locales/<ai:locale>.json`.
	* `${OTHER_KEY}` inside a text is replaced by that text once at load. Returns `t(key, ...args)` filling
	* `{0}`, `{1}`...; a missing key returns the key itself so it is visible in game.
	*
	*   const t = createLocale<typeof import("../../locales/en.json")>();
	*   t("NOTIFY_NO_MONEY", price);
	*/
	function createLocale() {
		const texts = loadLocaleTexts();
		return (key, ...args) => formatText(texts[key] ?? key, args);
	}
	/**
	* The resource's merged lang table (`en.json` overlaid with the `ai:locale` language, `${KEY}` references
	* resolved). A NUI gets this once and fills `{0}` placeholders itself.
	*/
	function loadLocaleTexts(resource = GetCurrentResourceName()) {
		const lang = GetConvar(LOCALE_CONVAR, "en");
		const texts = {
			...readLocaleFile(resource, "en"),
			...lang === "en" ? {} : readLocaleFile(resource, lang)
		};
		for (const key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
		return texts;
	}

// resource/common/locale.ts
/** This resource's lang texts: `Locale("NOTIFY_NO_MONEY", price)`; keys typed from locales/en.json. */
	const Locale = createLocale();

// resource/common/resource.ts
	const ResourceName = GetCurrentResourceName();
	const ResourceContext = IsDuplicityVersion() ? "server" : "client";

// resource/common/keys.ts
/** ai-vehiclekeys' contracts. No natives. */
	const EVENTS = {
		/** Callback: (netId) -> boolean, whether the player holds a key to the vehicle (asked on taking the driver seat). */
		check: "ai-vehiclekeys:check",
		/** Server -> owner: (netId) a key to this vehicle was given while sitting in it: the engine may start. */
		granted: "ai-vehiclekeys:client:granted",
		/** Server -> owner: (kind: "unlock" | "hotwire", token, seconds) play the lockpick progress, then call `finishPick`. */
		startPick: "ai-vehiclekeys:client:startPick",
		/** Callback: (netId) -> { ok, locked? } toggle the lock of a vehicle the player has a key to. */
		toggleLock: "ai-vehiclekeys:toggleLock",
		/** Callback: (token) -> { ok } the lockpick progress finished. */
		finishPick: "ai-vehiclekeys:finishPick"
	};

// resource/client/index.ts
	const texts = loadLocaleTexts();
	const isObj = (v) => typeof v === "object" && v !== null;
	const errorOf = (v) => isObj(v) && v.ok === false && typeof v.error === "string" ? v.error : null;
	/** The closest networked vehicle within `metres` (the one the player sits in first). */
	function nearestVehicle(metres) {
		if (cache.vehicle !== false) return cache.vehicle;
		const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
		let best = null;
		let bestDistance = metres;
		for (const vehicle of GetGamePool("CVehicle")) {
			const [vx = 0, vy = 0, vz = 0] = GetEntityCoords(vehicle, false);
			const distance = Math.hypot(vx - x, vy - y, vz - z);
			if (distance < bestDistance && NetworkGetEntityIsNetworked(vehicle)) [best, bestDistance] = [vehicle, distance];
		}
		return best;
	}
	/** L: lock or unlock the nearest vehicle the player has a key to (the server decides and locks). */
	async function toggleLock() {
		const vehicle = nearestVehicle(10);
		if (!vehicle) return;
		const result = await triggerServerCallback(EVENTS.toggleLock, [NetworkGetNetworkIdFromEntity(vehicle)]).catch(() => null);
		const error = errorOf(result);
		if (error) return notify(texts[error] ?? error, "error", 2500);
		if (cache.vehicle === false) {
			SetVehicleLights(vehicle, 2);
			StartVehicleHorn(vehicle, 80, GetHashKey("HELDDOWN"), false);
			setTimeout(() => SetVehicleLights(vehicle, 0), 400);
		}
	}
	/**
	* Without a key the engine stays off: asked once when the player takes a driver seat, then held off twice a second
	* until a key arrives (hotwire) or the player leaves the seat.
	*/
	var Engine = class {
		blockTimer = null;
		async onSeat(seat) {
			this.release();
			const vehicle = cache.vehicle;
			if (seat !== -1 || vehicle === false) return;
			if (await triggerServerCallback(EVENTS.check, [NetworkGetNetworkIdFromEntity(vehicle)]).catch(() => false) === true || cache.vehicle !== vehicle) return;
			SetVehicleEngineOn(vehicle, false, true, true);
			this.blockTimer = setInterval(() => {
				if (cache.vehicle !== vehicle || cache.seat !== -1) return this.release();
				SetVehicleEngineOn(vehicle, false, true, true);
			}, 500);
		}
		release() {
			if (this.blockTimer) clearInterval(this.blockTimer);
			this.blockTimer = null;
		}
	};
	const engine = new Engine();
	onCache("seat", (seat) => void engine.onSeat(seat));
	onServerEvent(EVENTS.granted, () => {
		engine.release();
		if (cache.vehicle !== false) SetVehicleEngineOn(cache.vehicle, true, false, true);
	});
	onServerEvent(EVENTS.startPick, { args: ([kind, token, seconds]) => (kind === "unlock" || kind === "hotwire") && typeof token === "number" && typeof seconds === "number" ? [
		kind,
		token,
		seconds
	] : null }, async (kind, token, seconds) => {
		if (await progress({
			label: Locale(kind === "hotwire" ? "KEYS_HOTWIRING" : "KEYS_PICKING"),
			duration: seconds * 1e3,
			anim: kind === "hotwire" ? {
				dict: "veh@std@ds@base",
				clip: "hotwire"
			} : {
				dict: "veh@break_in@0h@p_m_one@",
				clip: "low_force_entry_ds"
			},
			allowVehicle: kind === "hotwire"
		})) triggerServerCallback(EVENTS.finishPick, [token]).catch(() => null);
	});
	new Keybind({
		name: "vehiclekeys_lock",
		description: Locale("KEYBIND_LOCK"),
		defaultKey: "L",
		onPressed: () => void toggleLock()
	});

})();
}catch(e){globalThis.__aicoreReportError&&globalThis.__aicoreReportError("load: "+(e&&e.stack||e));throw e}
