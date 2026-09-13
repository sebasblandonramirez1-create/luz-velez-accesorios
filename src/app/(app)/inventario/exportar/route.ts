import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { crearXlsx, TIPO_XLSX } from "@/lib/xlsx";
import { fechaHora, hoyIso } from "@/lib/formato";
import { nombreMovimiento, signoMovimiento } from "@/lib/inventario";

/** Exporta el inventario (existencias y movimientos) a Excel (.xlsx). */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return new Response("No autorizada", { status: 401 });
  const supabase = await clienteServidor();
  const [{ data: productos }, { data: movimientos }] = await Promise.all([
    supabase.from("productos").select("codigo, nombre, stock_actual, stock_minimo, precio_base, precio_publico, costo_compra").is("eliminado_en", null).eq("activo", true).order("codigo"),
    supabase
      .from("movimientos_inventario")
      .select("tipo, cantidad, valor_unitario, fecha, nota, productos(codigo, nombre)")
      .is("eliminado_en", null)
      .order("fecha", { ascending: false })
      .limit(10000),
  ]);
  const esPropietaria = sesion.perfil.rol === "propietaria";
  const existencias = [
    ["Código", "Descripción", "Stock", "Mínimo", "Valor a precio base", "Valor al público", ...(esPropietaria ? ["Valor a costo"] : [])],
    ...(productos ?? []).map((p) => [p.codigo, p.nombre, p.stock_actual, p.stock_minimo, p.stock_actual * p.precio_base, p.stock_actual * p.precio_publico, ...(esPropietaria ? [p.stock_actual * (p.costo_compra ?? 0)] : [])]),
  ];
  const movs = [
    ["Fecha", "Código", "Descripción", "Movimiento", "Signo", "Cantidad", "Valor unitario", "Nota"],
    ...(movimientos ?? []).map((m) => {
      const p = m.productos as unknown as { codigo: string; nombre: string } | null;
      return [fechaHora(m.fecha), p?.codigo ?? "", p?.nombre ?? "", nombreMovimiento(m.tipo), signoMovimiento(m.tipo) > 0 ? "+" : "-", m.cantidad, m.valor_unitario, m.nota];
    }),
  ];
  const bytes = crearXlsx([
    { nombre: "Existencias", filas: existencias, anchos: [12, 40, 8, 8, 18, 18, 14] },
    { nombre: "Movimientos", filas: movs, anchos: [18, 12, 40, 26, 6, 10, 14, 30] },
  ]);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": TIPO_XLSX, "Content-Disposition": `attachment; filename="inventario-${hoyIso()}.xlsx"` },
  });
}
