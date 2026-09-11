import { Encabezado } from "@/components/ui";
import { FormularioContacto } from "../formulario-contacto";

export const metadata = { title: "Añadir contacto" };

export default async function PaginaNuevoContacto({ searchParams }: PageProps<"/contactos/nuevo">) {
  const p = await searchParams;
  const volver = typeof p.volver === "string" ? p.volver : undefined;
  const tipo = typeof p.tipo === "string" ? p.tipo : undefined;
  return (
    <div>
      <Encabezado titulo="Añadir contacto" volver="/contactos" />
      <FormularioContacto volver={volver} tipoInicial={tipo} />
    </div>
  );
}
