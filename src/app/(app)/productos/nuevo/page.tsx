import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, Encabezado } from "@/components/ui";
import { FormularioProducto } from "../formulario-producto";

export const metadata = { title: "Añadir producto" };

export default async function PaginaNuevoProducto({ searchParams }: PageProps<"/productos/nuevo">) {
  const p = await searchParams;
  const creado = typeof p.creado === "string" ? p.creado : null;
  const supabase = await clienteServidor();
  const [{ data: ajustes }, { data: proveedores }] = await Promise.all([
    supabase.from("ajustes").select("*").eq("id", 1).single(),
    supabase.from("contactos").select("id, nombre").eq("tipo", "proveedor").is("eliminado_en", null).order("nombre"),
  ]);
  if (!ajustes) throw new Error("No se pudieron cargar los ajustes.");

  return (
    <div>
      <Encabezado titulo="Añadir producto" volver="/productos" subtitulo="Foto, código y precio: listo en menos de un minuto." />
      {creado && (
        <Aviso tipo="exito" className="mb-4">
          Producto {creado} guardado. Puedes añadir el siguiente.
        </Aviso>
      )}
      <FormularioProducto key={creado ?? "nuevo"} ajustes={ajustes} proveedores={proveedores ?? []} />
    </div>
  );
}
