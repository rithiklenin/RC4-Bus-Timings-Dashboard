# RC4 Bus Timings Dashboard

An always-on, 16:9 bus arrival board for Residential College 4. It combines:

- NUS shuttle arrivals at University Town (`UTOWN`)
- LTA public buses at UTown – RC4 (`19059`)
- LTA public buses at New Town Sec Sch (`19051`)

The dashboard refreshes every 20 seconds, keeps the last successful timings through transient outages, and shows independent health states for the NUS and LTA feeds.

## Local setup

Requirements: Node.js 20.9 or newer and an [LTA DataMall](https://datamall.lta.gov.sg/) AccountKey.

```bash
npm install
cp .env.example .env.local
```

Add your LTA key to `.env.local`:

```dotenv
LTA_ACCOUNT_KEY=your-key-here
```

Then start the dashboard:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a wall display, use the browser's full-screen or kiosk mode at a 16:9 resolution such as 1920×1080.

## Data sources

Public arrivals come from LTA's official `v3/BusArrival` API. The key is read only by the server route and is never sent to the browser.

NUS arrivals use the public server endpoint maintained by the open-source [NUS NextBus Web](https://github.com/hewliyang/nus-nextbus-web) project. This is an unofficial integration and can change independently of this dashboard. Override it with `NUS_PROXY_BASE_URL` if a compatible provider is deployed elsewhere.

## Commands

```bash
npm run dev        # development server
npm run test       # unit and component tests
npm run typecheck  # TypeScript validation
npm run lint       # ESLint
npm run build      # production build
```

## Deploying to Vercel

Import the repository into Vercel, add `LTA_ACCOUNT_KEY` as a production environment variable, and deploy. `NUS_PROXY_BASE_URL` is optional. The internal `/api/arrivals` route aggregates both providers and applies a short CDN cache without exposing credentials.
