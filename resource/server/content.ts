import { AdminPanel } from "@aicore-fivem/lib/server";
import { readSettings } from "common/keys";
import { keysSchema } from "./schema";

const panel = new AdminPanel(keysSchema);
/** Panel settings, kept current by the panel. */
export const settings = panel.view("settings", readSettings);
