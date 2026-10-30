import type { PanelSchema } from "@aicore-fivem/shared"

const pct = { type: "number", min: 0, max: 100, integer: true } as const
const secs = { type: "number", min: 1, max: 120, integer: true } as const

/** ai-vehiclekeys' panel: lock reach and lockpicking odds. */
export const keysSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "key",
  files: {
    settings: {
      kind: "settings",
      sync: "all",
      sections: {
        lockDistance: { type: "number", min: 2, max: 30, integer: true },
        unlockChance: pct,
        unlockSeconds: secs,
        hotwireChance: pct,
        hotwireSeconds: secs,
        breakChance: pct,
      },
    },
  },
  tabs: [
    {
      id: "settings",
      file: "settings",
      icon: "key",
      label: "ADMIN_TAB_SETTINGS",
      desc: "ADMIN_TAB_SETTINGS_DESC",
      cards: [
        {
          icon: "lock",
          title: "ADMIN_C_LOCK",
          desc: "ADMIN_C_LOCK_DESC",
          fields: [
            {
              widget: "number",
              path: "lockDistance",
              label: "ADMIN_F_LOCK_DISTANCE",
              hint: "ADMIN_H_LOCK_DISTANCE",
              min: 2,
              max: 30,
              unit: "m",
            },
          ],
        },
        {
          icon: "screwdriver-wrench",
          title: "ADMIN_C_LOCKPICK",
          desc: "ADMIN_C_LOCKPICK_DESC",
          fields: [
            {
              widget: "number",
              path: "unlockChance",
              label: "ADMIN_F_UNLOCK_CHANCE",
              hint: "ADMIN_H_UNLOCK_CHANCE",
              min: 0,
              max: 100,
              unit: "%",
            },
            {
              widget: "number",
              path: "unlockSeconds",
              label: "ADMIN_F_UNLOCK_SECONDS",
              min: 1,
              max: 60,
              unit: "s",
            },
            {
              widget: "number",
              path: "hotwireChance",
              label: "ADMIN_F_HOTWIRE_CHANCE",
              hint: "ADMIN_H_HOTWIRE_CHANCE",
              min: 0,
              max: 100,
              unit: "%",
            },
            {
              widget: "number",
              path: "hotwireSeconds",
              label: "ADMIN_F_HOTWIRE_SECONDS",
              min: 1,
              max: 120,
              unit: "s",
            },
            {
              widget: "number",
              path: "breakChance",
              label: "ADMIN_F_BREAK_CHANCE",
              hint: "ADMIN_H_BREAK_CHANCE",
              min: 0,
              max: 100,
              unit: "%",
            },
          ],
        },
      ],
    },
  ],
}
