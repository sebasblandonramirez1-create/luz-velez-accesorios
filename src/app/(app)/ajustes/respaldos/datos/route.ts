import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { TABLAS_RESPALDO } from "@/lib/respaldo";

/** Todas las tablas (según permisos de la propietaria) y la lista de fotos, en JSON. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion || sesion.perfil.rol !== "propietaria") return new Response("No autorizada", { status: 403 });
  const supabase = await clienteServidor();
  const tablas: Record<string, unknown[]> = {};
  for (const t of TABLAS_RESPALDO) {
    const filas: unknown[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(desde, desde + 999);
      if (error) return new Response(`No se pudo leer ${t}: ${error.message}`, { status: 500 });
      filas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    tablas[t] = filas;
  }
  const fotos: string[] = [];
  for (const carpeta of ["productos", "gastos"]) {
    const { data: ids } = await supabase.storage.from("fotos").list(carpeta, { limit: 1000 });
    for (const d of ids ?? []) {
      const { data: archivos } = await supabase.storage.from("fotos").list(`${carpeta}/${d.name}`, { limit: 1000 });
      for (const a of archivos ?? []) fotos.push(`${carpeta}/${d.name}/${a.name}`);
    }
  }
  return Response.json({ tablas, fotos }, { headers: { "Cache-Control": "no-store" } });
}
