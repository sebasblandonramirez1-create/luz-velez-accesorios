import { notFound, redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { FormularioGasto } from "../formulario-gasto";
import { enviarGastoAPapelera } from "../acciones";

export const metadata = { title: "Editar gasto" };

export default async function PaginaGasto({ params, searchParams }: PageProps<"/gastos/[id]">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const supabase = await clienteServidor();
  const [{ data: gasto }, { data: proveedores }] = await Promise.all([
    supabase.from("gastos").select("*").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("contactos").select("id, nombre").eq("tipo", "proveedor").is("eliminado_en", null).order("nombre"),
  ]);
  if (!gasto) notFound();
  if (gasto.compra_id) redirect(`/compras/${gasto.compra_id}`);
  return (
    <div className="space-y-4">
      <Encabezado titulo="Editar gasto" volver="/gastos" />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <FormularioGasto gasto={gasto} proveedores={proveedores ?? []} />
      <div className="flex justify-end">
        <BotonConfirmar accion={enviarGastoAPapelera} campos={{ id: gasto.id }} titulo="¿Enviar a la papelera?" texto="El gasto dejará de contar en caja y reportes. Podrás restaurarlo durante 30 días." confirmar="Sí, enviar a la papelera">
          Enviar a la papelera
        </BotonConfirmar>
      </div>
    </div>
  );
}
