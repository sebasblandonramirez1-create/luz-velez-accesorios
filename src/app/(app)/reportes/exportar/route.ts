import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { crearXlsx, TIPO_XLSX } from "@/lib/xlsx";
import { hojasReporte } from "@/lib/reportes";
import type { Reporte } from "@/lib/tipos";

/** Reporte del período en Excel (.xlsx) con varias hojas. */
export async function GET(request: Request) {
  const sesion = await sesionActual();
  if (!sesion || sesion.perfil.rol !== "propietaria") return new Response("No autorizada", { status: 403 });
  const url = new URL(request.url);
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  const etiqueta = url.searchParams.get("etiqueta") ?? `${desde} a ${hasta}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return new Response("Período inválido", { status: 400 });
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("reporte_periodo", { p_desde: desde, p_hasta: hasta });
  if (error || !data) return new Response(`No se pudo calcular el reporte: ${error?.message ?? ""}`, { status: 500 });
  const bytes = crearXlsx(hojasReporte(data as Reporte, etiqueta));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="reporte-${desde}-a-${hasta}.xlsx"`,
    },
  });
}
