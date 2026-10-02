import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioConsignacion } from "./formulario-consignacion";

export const metadata = { title: "Nueva entrega en consignación" };

export default async function PaginaNuevaConsignacion({ searchParams }: PageProps<"/consignaciones/nueva">) {
  const p = await searchParams;
  const contactoInicial = typeof p.contacto === "string" ? p.contacto : "";
  const supabase = await clienteServidor();
  const [{ data: productos }, { data: contactos }, { data: ajustes }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, codigo, nombre, categoria, material, color, stock_actual, precio_base, producto_fotos(ruta_miniatura, principal)")
      .is("eliminado_en", null)
      .eq("activo", true)
      .order("codigo"),
    supabase.from("contactos").select("id, nombre, tipo").is("eliminado_en", null).in("tipo", ["vendedora", "mayorista", "cliente"]).order("nombre"),
    supabase.from("ajustes").select("consignacion_dias_plazo").eq("id", 1).maybeSingle(),
  ]);
  return (
    <div>
      <Encabezado titulo="Nueva entrega en consignación" volver="/consignaciones" subtitulo="Elige la vendedora y las piezas que se lleva. Usa el buscador y los filtros para ubicarlas; el valor unitario es el precio base." />
      <FormularioConsignacion
        productos={(productos ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigo,
          nombre: x.nombre,
          categoria: x.categoria,
          material: x.material,
          color: x.color,
          stock_actual: x.stock_actual,
          precio_base: x.precio_base,
          miniatura: x.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? x.producto_fotos?.[0]?.ruta_miniatura ?? null,
        }))}
        contactos={contactos ?? []}
        contactoInicial={contactoInicial}
        diasPlazo={ajustes?.consignacion_dias_plazo ?? 30}
      />
    </div>
  );
}
