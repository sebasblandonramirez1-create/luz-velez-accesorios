import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioMovimiento } from "./formulario";

export const metadata = { title: "Registrar movimiento" };

export default async function PaginaNuevoMovimiento({ searchParams }: PageProps<"/inventario/nuevo">) {
  const p = await searchParams;
  const productoInicial = typeof p.producto === "string" ? p.producto : "";
  const supabase = await clienteServidor();
  const { data: productos } = await supabase
    .from("productos")
    .select("id, codigo, nombre, stock_actual, costo_compra, precio_base, producto_fotos(ruta_miniatura, principal)")
    .is("eliminado_en", null)
    .eq("activo", true)
    .order("codigo");

  return (
    <div>
      <Encabezado titulo="Registrar movimiento" volver="/inventario" subtitulo="Entradas por compra, ajustes, pérdidas u obsequios. Las ventas y consignaciones se registran desde sus propios módulos." />
      <FormularioMovimiento
        productos={(productos ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigo,
          nombre: x.nombre,
          stock_actual: x.stock_actual,
          costo: x.costo_compra ?? x.precio_base,
          miniatura: x.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? x.producto_fotos?.[0]?.ruta_miniatura ?? null,
        }))}
        productoInicial={productoInicial}
      />
    </div>
  );
}
