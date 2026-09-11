import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioProducto } from "../../formulario-producto";

export const metadata = { title: "Editar producto" };

export default async function PaginaEditarProducto({ params }: PageProps<"/productos/[id]/editar">) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const [{ data: producto }, { data: ajustes }, { data: proveedores }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("ajustes").select("*").eq("id", 1).single(),
    supabase.from("contactos").select("id, nombre").eq("tipo", "proveedor").is("eliminado_en", null).order("nombre"),
  ]);
  if (!producto || !ajustes) notFound();

  return (
    <div>
      <Encabezado titulo={`Editar ${producto.codigo}`} volver={`/productos/${id}`} />
      <FormularioProducto ajustes={ajustes} proveedores={proveedores ?? []} producto={producto} />
    </div>
  );
}
