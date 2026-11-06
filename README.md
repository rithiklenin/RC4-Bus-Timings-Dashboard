# RC4 Bus Timings Dashboard

An always-on, 16:9 smart display for Residential College 4. It combines rotating RC4 publicity with persistent live transport information:

- A rotating panel for CSC publicity, RC4 events, sign-up deadlines and selected announcements
- NUS shuttle arrivals at University Town (`UTOWN`)
- LTA public buses at UTown – RC4 (`19059`)
- LTA public buses at New Town Sec Sch (`19051`)

The publicity panel rotates once per minute, and its slide indicators can be clicked for manual testing. The transport dashboard refreshes every 20 seconds, keeps the last successful timings through transient outages, and shows independent health states for the NUS and LTA feeds.

Dashboard intervals are configured in `lib/dashboard-config.ts`. Change `publicityRotationMs` to adjust the publicity rotation duration.

Production dashboards check `/api/version` every minute and when connectivity returns. A changed build version triggers a page reload; failed checks leave the current display running. Use the stable production domain on the TV, since a deployment-specific URL always points to the same build. The TV needs one manual refresh when this feature is first deployed. Automatic reloads are disabled in `next dev`.

The dining panel measures the space available for its menu. It shows two stalls together when they fit, otherwise shows one, and divides oversized menus into consecutive pages marked **continued**. Long stall and dish names wrap, and every dish remains in the rotation. Pagination is recalculated when the menu, fonts, or panel size changes.

## Dining menu prototype

Open [`/admin`](http://localhost:3000/admin) to enter the prototype admin console. Approved addresses are listed one per line in `config/admin-whitelist.txt`; changing the list requires a redeployment. Entering an approved email creates an eight-hour signed, HTTP-only session using the existing private Blob token as signing key material. This prototype checks only whether the address is listed and does not verify email ownership, so it must not be treated as production authentication. The console edits the three rotating CSC highlight cards; published content is stored as one JSON document in the existing private Vercel Blob store, and the dashboard checks for updates every 15 seconds.

See the brief [admin guide](docs/admin-guide.md) for the user-testing workflow.

From the **Dining connection** section, complete the NUS Dining connection before testing the live RC4 menu card. The current Dining App login flow returns to a fixed NUS callback URL, so the prototype asks you to paste that final URL back into the admin console. It validates the saved login state, exchanges the callback, and stores the session encrypted in a private Vercel Blob store.

The public dashboard never receives the bearer token. It requests normalized menu data from `/api/dining-menu`, while the server discovers the account's RC4 hall and date-specific station IDs and sends the authenticated upstream requests. The menu refreshes every 15 minutes. If the token is unavailable, the card shows an explicit **Not connected** state and no sample dishes.

Because NUS redirects to a fixed NUS-owned callback page, browser cross-origin rules prevent the localhost admin page from reading that window's final URL automatically. The admin page opens the login in a small window and can read the copied callback URL directly from the clipboard with one click; a manual paste field remains as a fallback.

The mock admin session and edited CSC content remain prototype features: admin authentication and CSC content storage are not production-grade. Dining sessions are persisted in a private Blob store and encrypted with AES-256-GCM. Configure separate private stores for Production and for Development/Preview. When available, generate a dedicated key with `node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))'` and paste it into the server-only `DINING_AUTH_ENCRYPTION_KEY` variable. The key parser accepts base64, base64url, and 64-character hex values, but every form must encode exactly 32 bytes. If that variable is missing or invalid, the application safely derives an encryption key from the private Blob token with HKDF, allowing deployments where only the Blob integration variables are accessible. Rotating the Blob token or changing the dedicated key requires reconnecting Dining. For local work, connect a nonproduction private store, put its token and a unique development key in `.env.local`, and keep that file private. Never reuse the production key locally. Vercel environment changes require a redeployment. After the persistence change is deployed, reconnect the Production Dining account once; an old process-memory session cannot be migrated.

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
