import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Campo, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { BotonConfirmar } from "@/components/confirmar";
import { FILTRO_SIN_CLASIFICAR } from "@/lib/clasificaciones";
import { alternarClasificacion, borrarClasificacion, crearClasificacion, editarClasificacion } from "./acciones";

export const metadata = { title: "Clasificaciones de productos" };

/**
 * Lista de clasificaciones (CP, CM, CCH, PL, PLM…): crear, renombrar, ordenar,
 * activar o desactivar y borrar las que no se usan. Solo la propietaria.
 */
export default async function PaginaClasificaciones({ searchParams }: PageProps<"/ajustes/clasificaciones">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/ajustes");
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const error = typeof p.error === "string" ? p.error : null;
  const supabase = await clienteServidor();
  const [{ data: clasificaciones }, { data: productos }] = await Promise.all([
    supabase.from("clasificaciones_producto").select("*").order("orden").order("codigo"),
    supabase.from("productos").select("clasificacion, stock_actual").is("eliminado_en", null).eq("activo", true),
  ]);
  const uso = new Map<string, { productos: number; unidades: number }>();
  let sinClasificar = 0;
  for (const x of productos ?? []) {
    if (!x.clasificacion) {
      sinClasificar += 1;
      continue;
    }
    const u = uso.get(x.clasificacion) ?? { productos: 0, unidades: 0 };
    u.productos += 1;
    u.unidades += x.stock_actual;
    uso.set(x.clasificacion, u);
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Clasificaciones de productos" volver="/ajustes" subtitulo="El código corto (CP, CM, PL…) acompaña al código y la descripción en recibos, hojas, listas y reportes, con un conteo por clasificación." />
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {sinClasificar > 0 && (
        <Aviso tipo="alerta">
          {sinClasificar} {sinClasificar === 1 ? "producto activo no tiene" : "productos activos no tienen"} clasificación.{" "}
          <Link href={`/productos?clasificacion=${FILTRO_SIN_CLASIFICAR}`} className="font-semibold underline">
            Ver cuáles
          </Link>
        </Aviso>
      )}

      <Tarjeta titulo="Clasificaciones">
        <ul className="divide-y divide-borde">
          {(clasificaciones ?? []).map((k) => {
            const u = uso.get(k.codigo);
            return (
              <li key={k.codigo} className="py-3">
                <form action={editarClasificacion} className="grid gap-2 sm:grid-cols-[6rem_1fr_5rem_auto] sm:items-end">
                  <input type="hidden" name="codigo_actual" value={k.codigo} />
                  <Campo etiqueta="Código" name="codigo" defaultValue={k.codigo} autoCapitalize="characters" maxLength={6} pattern="[A-Za-z]{1,6}" required />
                  <Campo etiqueta="Nombre" name="nombre" defaultValue={k.nombre} required />
                  <Campo etiqueta="Orden" name="orden" type="number" inputMode="numeric" defaultValue={k.orden} />
                  <BotonEnviar grande={false} variante="secundario" className="sm:w-auto">
                    Guardar
                  </BotonEnviar>
                </form>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {k.activa ? <Etiqueta tono="exito">Activa</Etiqueta> : <Etiqueta>Inactiva</Etiqueta>}
                  <span className="text-texto-suave">
                    {u ? `${u.productos} ${u.productos === 1 ? "producto" : "productos"} · ${u.unidades} unidades en stock` : "Sin productos"}
                  </span>
                  <span className="ml-auto flex flex-wrap gap-2">
                    <form action={alternarClasificacion}>
                      <input type="hidden" name="codigo" value={k.codigo} />
                      <input type="hidden" name="activa" value={k.activa ? "false" : "true"} />
                      <button type="submit" className="min-h-10 rounded-lg px-3 font-semibold text-primario hover:bg-primario-claro">
                        {k.activa ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                    {!u && (
                      <BotonConfirmar accion={borrarClasificacion} campos={{ codigo: k.codigo }} titulo={`¿Borrar ${k.codigo}?`} texto="Ningún producto la usa. Se puede volver a crear después." confirmar="Sí, borrar" className="!min-h-10 !px-3 text-sm">
                        Borrar
                      </BotonConfirmar>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Añadir una clasificación">
        <form action={crearClasificacion} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
          <Campo etiqueta="Código" name="codigo" placeholder="AR" autoCapitalize="characters" maxLength={6} pattern="[A-Za-z]{1,6}" required ayuda="De 1 a 6 letras." />
          <Campo etiqueta="Nombre" name="nombre" placeholder="Aretas" required />
          <BotonEnviar grande={false} className="sm:w-auto">
            Añadir
          </BotonEnviar>
        </form>
      </Tarjeta>
    </div>
  );
}
