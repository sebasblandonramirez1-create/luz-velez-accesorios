import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioVenta } from "./formulario-venta";

export const metadata = { title: "Registrar venta" };

export default async function PaginaNuevaVenta() {
  const supabase = await clienteServidor();
  const [{ data: productos }, { data: contactos }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, codigo, nombre, stock_actual, precio_publico, producto_fotos(ruta_miniatura, principal)")
      .is("eliminado_en", null)
      .eq("activo", true)
      .order("codigo"),
    supabase.from("contactos").select("id, nombre, tipo").is("eliminado_en", null).order("nombre"),
  ]);
  return (
    <div>
      <Encabezado titulo="Registrar venta" volver="/ventas" subtitulo="Busca el producto, fija la cantidad y confirma." />
      <FormularioVenta
        productos={(productos ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigo,
          nombre: x.nombre,
          stock_actual: x.stock_actual,
          precio_publico: x.precio_publico,
          miniatura: x.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? x.producto_fotos?.[0]?.ruta_miniatura ?? null,
        }))}
        contactos={contactos ?? []}
      />
    </div>
  );
}
