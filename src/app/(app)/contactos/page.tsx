import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { TIPOS_CONTACTO, type TipoContacto } from "@/lib/tipos";

export const metadata = { title: "Contactos" };

export default async function PaginaContactos({ searchParams }: PageProps<"/contactos">) {
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim() : "";
  const tipo = typeof p.tipo === "string" && p.tipo in TIPOS_CONTACTO ? (p.tipo as TipoContacto) : "";
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const error = typeof p.error === "string" ? p.error : null;
  const supabase = await clienteServidor();

  let consulta = supabase.from("contactos").select("*").is("eliminado_en", null).order("nombre");
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (q) consulta = consulta.or(`nombre.ilike.%${q.replace(/[%_]/g, "")}%,telefono.ilike.%${q.replace(/[%_]/g, "")}%`);
  const { data: contactos } = await consulta;

  return (
    <div>
      <Encabezado titulo="Contactos" subtitulo="Clientas, vendedoras en consignación, mayoristas y proveedores." acciones={<BotonEnlace href="/contactos/nuevo">➕ Añadir</BotonEnlace>} />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" className="mb-4">
          {error}
        </Aviso>
      )}
      <form method="get" className="mb-4 flex gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre o teléfono" className="campo" aria-label="Buscar" />
        <select name="tipo" defaultValue={tipo} className="campo w-auto min-w-36" aria-label="Tipo">
          <option value="">Todos</option>
          {Object.entries(TIPOS_CONTACTO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-12 rounded-xl border border-borde bg-superficie px-4 font-semibold">
          Buscar
        </button>
      </form>

      {!contactos?.length ? (
        <EstadoVacio titulo="No hay contactos" texto="Añade a tus vendedoras, clientas y proveedores para usarlos en ventas y consignaciones." accion={<BotonEnlace href="/contactos/nuevo">Añadir contacto</BotonEnlace>} />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {contactos.map((c) => (
            <li key={c.id}>
              <Link href={`/contactos/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-fondo">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primario-claro font-bold text-primario-oscuro">{c.nombre.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.nombre}</span>
                  <span className="block text-sm text-texto-suave">{c.telefono || "Sin teléfono"}</span>
                </span>
                <Etiqueta tono={c.tipo === "vendedora" ? "primario" : "neutro"}>{TIPOS_CONTACTO[c.tipo]}</Etiqueta>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
