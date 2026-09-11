import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { escribirCsv } from "@/lib/csv";
import { fechaHora, hoyIso } from "@/lib/formato";
import { nombreMovimiento, signoMovimiento } from "@/lib/inventario";

/** Exporta los movimientos de inventario a CSV. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return new Response("No autorizada", { status: 401 });
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("movimientos_inventario")
    .select("tipo, cantidad, valor_unitario, fecha, nota, productos(codigo, nombre)")
    .is("eliminado_en", null)
    .order("fecha", { ascending: false })
    .limit(10000);
  const filas: (string | number | null)[][] = [
    ["Fecha", "Código", "Descripción", "Movimiento", "Signo", "Cantidad", "Valor unitario", "Nota"],
    ...(data ?? []).map((m) => {
      const p = m.productos as unknown as { codigo: string; nombre: string } | null;
      return [fechaHora(m.fecha), p?.codigo ?? "", p?.nombre ?? "", nombreMovimiento(m.tipo), signoMovimiento(m.tipo) > 0 ? "+" : "-", m.cantidad, m.valor_unitario, m.nota];
    }),
  ];
  return new Response(escribirCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${hoyIso()}.csv"`,
    },
  });
}
