import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioEntrada } from "./formulario-entrada";

export const metadata = { title: "Ingresar productos al stock" };

/**
 * Entrada de varios productos al stock de una vez. Parte de la selección hecha
 * en la lista de productos (guardada en el navegador) y permite añadir más.
 */
export default async function PaginaEntrada() {
  const supabase = await clienteServidor();
  const { data: productos } = await supabase
    .from("productos")
    .select("id, codigo, nombre, categoria, clasificacion, material, color, stock_actual, costo_compra, precio_base, producto_fotos(ruta_miniatura, principal)")
    .is("eliminado_en", null)
    .eq("activo", true)
    .order("codigo");
  return (
    <div>
      <Encabezado titulo="Ingresar productos al stock" volver="/productos" subtitulo="Escribe cuántas unidades entran de cada producto seleccionado. Todo se registra junto, con la misma fecha y nota." />
      <FormularioEntrada
        productos={(productos ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigo,
          nombre: x.nombre,
          categoria: x.categoria,
          clasificacion: x.clasificacion,
          material: x.material,
          color: x.color,
          stock_actual: x.stock_actual,
          precio_base: x.precio_base,
          costo: x.costo_compra ?? x.precio_base,
          miniatura: x.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? x.producto_fotos?.[0]?.ruta_miniatura ?? null,
        }))}
      />
    </div>
  );
}
