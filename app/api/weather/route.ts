import { getWeather } from "@/lib/providers/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body = await getWeather();
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
