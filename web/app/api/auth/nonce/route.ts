import { buatTantangan } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(buatTantangan());
}
