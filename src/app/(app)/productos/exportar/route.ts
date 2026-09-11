import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { escribirCsv } from "@/lib/csv";
import { CATEGORIA_SINGULAR } from "@/lib/tipos";
import { fecha, hoyIso } from "@/lib/formato";

/** Exporta el catálogo completo a CSV (se abre en Excel). */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return new Response("No autorizada", { status: 401 });
  const supabase = await clienteServidor();
  const { data } = await supabase.from("productos").select("*").is("eliminado_en", null).order("codigo");
  const filas: (string | number | null)[][] = [
    ["Código", "Descripción", "Categoría", "Subcategoría", "Material", "Color", "Precio base", "Precio público", "Precio mayorista", "Costo compra", "Stock", "Stock mínimo", "Estado", "Catálogo público", "Creado", "Notas"],
    ...(data ?? []).map((p) => [
      p.codigo,
      p.nombre,
      CATEGORIA_SINGULAR[p.categoria],
      p.subcategoria,
      p.material,
      p.color,
      p.precio_base,
      p.precio_publico,
      p.precio_mayorista,
      sesion.perfil.rol === "propietaria" ? p.costo_compra : null,
      p.stock_actual,
      p.stock_minimo,
      p.activo ? "Activo" : "Descontinuado",
      p.visible_catalogo ? "Sí" : "No",
      fecha(p.creado_en),
      p.notas,
    ]),
  ];
  return new Response(escribirCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="productos-${hoyIso()}.csv"`,
    },
  });
}
