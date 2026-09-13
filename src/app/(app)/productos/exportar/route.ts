import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { crearXlsx, TIPO_XLSX } from "@/lib/xlsx";
import { CATEGORIA_SINGULAR } from "@/lib/tipos";
import { fecha, hoyIso } from "@/lib/formato";

/** Exporta el catálogo completo a Excel (.xlsx). */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return new Response("No autorizada", { status: 401 });
  const supabase = await clienteServidor();
  const { data } = await supabase.from("productos").select("*").is("eliminado_en", null).order("codigo");
  const esPropietaria = sesion.perfil.rol === "propietaria";
  const filas = [
    ["Código", "Descripción", "Categoría", "Subcategoría", "Material", "Color", "Precio base", "Precio público", "Precio mayorista", ...(esPropietaria ? ["Costo compra"] : []), "Stock", "Stock mínimo", "Estado", "Catálogo público", "Creado", "Notas"],
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
      ...(esPropietaria ? [p.costo_compra] : []),
      p.stock_actual,
      p.stock_minimo,
      p.activo ? "Activo" : "Descontinuado",
      p.visible_catalogo ? "Sí" : "No",
      fecha(p.creado_en),
      p.notas,
    ]),
  ];
  const bytes = crearXlsx([{ nombre: "Productos", filas, anchos: [12, 40, 12, 16, 14, 12, 13, 14, 14, ...(esPropietaria ? [13] : []), 8, 12, 14, 14, 12, 30] }]);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": TIPO_XLSX, "Content-Disposition": `attachment; filename="productos-${hoyIso()}.xlsx"` },
  });
}
