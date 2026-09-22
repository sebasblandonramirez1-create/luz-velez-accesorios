import { NextResponse } from "next/server";
import { informeProyecto } from "@/lib/supabase/proyecto";

export const dynamic = "force-dynamic";

/** Estado del proyecto para que la pantalla de reactivación lo consulte cada pocos segundos. */
export async function GET() {
  const informe = await informeProyecto();
  return NextResponse.json({ estado: informe.estado }, { headers: { "Cache-Control": "no-store" } });
}
