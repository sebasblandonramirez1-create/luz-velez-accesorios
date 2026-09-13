import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioGasto } from "../formulario-gasto";

export const metadata = { title: "Registrar gasto" };

export default async function PaginaNuevoGasto() {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const supabase = await clienteServidor();
  const { data: proveedores } = await supabase.from("contactos").select("id, nombre").eq("tipo", "proveedor").is("eliminado_en", null).order("nombre");
  return (
    <div>
      <Encabezado titulo="Registrar gasto" volver="/gastos" subtitulo="Para compras de mercancía con detalle de productos usa «Compras»." />
      <FormularioGasto proveedores={proveedores ?? []} />
    </div>
  );
}
