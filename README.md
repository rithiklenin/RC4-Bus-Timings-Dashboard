# RC4 Bus Timings Dashboard

An always-on, 16:9 smart display for Residential College 4. It combines rotating RC4 publicity with persistent live transport information:

- A rotating panel for CSC publicity, RC4 events, sign-up deadlines and selected announcements
- NUS shuttle arrivals at University Town (`UTOWN`)
- LTA public buses at UTown – RC4 (`19059`)
- LTA public buses at New Town Sec Sch (`19051`)

The publicity panel rotates once per minute, and its slide indicators can be clicked for manual testing. The transport dashboard refreshes every 20 seconds, keeps the last successful timings through transient outages, and shows independent health states for the NUS and LTA feeds.

Dashboard intervals are configured in `lib/dashboard-config.ts`. Change `publicityRotationMs` to adjust the publicity rotation duration.

## Dining menu prototype

Open [`/admin`](http://localhost:3000/admin) to enter the prototype admin console. The mock NUS login does not request credentials and is isolated behind `lib/admin-auth.ts` so an official NUS authentication provider can replace it later. The console also edits the three rotating CSC highlight cards; saved content is held by the running server and the dashboard checks for updates every 15 seconds.

From the **Dining connection** section, complete the NUS Dining connection before testing the live RC4 menu card. The current Dining App login flow returns to a fixed NUS callback URL, so the prototype asks you to paste that final URL back into the admin console. It validates the saved login state, exchanges the callback, and keeps the resulting tokens in a git-ignored local session file with owner-only permissions.

The public dashboard never receives the bearer token. It requests normalized menu data from `/api/dining-menu`, while the server discovers the account's RC4 hall and date-specific station IDs and sends the authenticated upstream requests. The menu refreshes every 15 minutes. If the token is unavailable, the card shows an explicit **Not connected** state and no sample dishes.

Because NUS redirects to a fixed NUS-owned callback page, browser cross-origin rules prevent the localhost admin page from reading that window's final URL automatically. The admin page opens the login in a small window and can read the copied callback URL directly from the clipboard with one click; a manual paste field remains as a fallback.

The mock admin session and edited CSC content remain in the running server process or local browser session. Dining authentication survives local development restarts and refreshes its access token until the NUS refresh token expires. The local file store is for evaluation only and should be replaced by a managed encrypted session store before deployment.

## Local setup

Requirements: Node.js 20.9 or newer and an [LTA DataMall](https://datamall.lta.gov.sg/) AccountKey.

```bash
npm install
cp .env.example .env.local
```

Add your LTA key and select the NUS provider in `.env.local`:

```dotenv
LTA_ACCOUNT_KEY=your-key-here
NUS_BUS_PROVIDER=nusbus
NUSBUS_BASE_URL=https://nusbus.app/api
```

Then start the dashboard:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a wall display, use the browser's full-screen or kiosk mode at a 16:9 resolution such as 1920×1080.

## Data sources

Public arrivals come from LTA's official `v3/BusArrival` API. The key is read only by the server route and is never sent to the browser.

NUS arrivals use a modular server-side provider selected with `NUS_BUS_PROVIDER`. The default `nusbus` provider calls the working `nusbus.app` proxy. The experimental `univus` provider retains the direct public-token and `inetapps.nus.edu.sg` bus-proxy flow; it requires the additional `UNIVUS_*` variables shown in `.env.example`. Provider credentials never reach the browser. A failing NUS request does not take down the independent LTA feed, and one unavailable LTA stop does not hide the other configured stop.

## Commands

```bash
npm run dev        # development server
npm run test       # unit and component tests
npm run typecheck  # TypeScript validation
npm run lint       # ESLint
npm run build      # production build
```

## Deploying to Vercel

Import this repository into Vercel and add `LTA_ACCOUNT_KEY` plus `NUS_BUS_PROVIDER=nusbus`. `NUSBUS_BASE_URL` is optional because it defaults to `https://nusbus.app/api`. If you deliberately select the experimental `univus` provider, add the required `UNIVUS_*` variables from `.env.example`. The internal `/api/arrivals` route aggregates both feeds and applies a short CDN cache without exposing credentials.
