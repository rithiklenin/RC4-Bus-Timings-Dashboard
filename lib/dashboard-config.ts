export const DASHBOARD_CONFIG = {
  arrivalsRefreshMs: 20_000,
  publicityRotationMs: 60_000,
  publicStopsRotationMs: 15_000,
} as const;

// Each page is shown together in the public bus column; pages rotate every publicStopsRotationMs.
export const PUBLIC_STOP_PAGES = [
  [
    { id: "19059", name: "UTown – RC4" },
    { id: "19051", name: "New Town Sec Sch" },
  ],
  [
    { id: "17099", name: "UTown – Cendana" },
    { id: "17091", name: "Aft Clementi Ave 1" },
  ],
] as const;
