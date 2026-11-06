import { DEPLOYMENT_VERSION } from "@/lib/deployment-version";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ version: DEPLOYMENT_VERSION }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
