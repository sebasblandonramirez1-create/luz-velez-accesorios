import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { fecha, pesos } from "@/lib/formato";
import { numeroDocumento } from "@/lib/ventas";
import { ESTADOS_CONSIGNACION, type EstadoConsignacion } from "@/lib/tipos";

export const metadata = { title: "Consignaciones" };

export default async function PaginaConsignaciones({ searchParams }: PageProps<"/consignaciones">) {
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const estado = typeof p.estado === "string" && p.estado in ESTADOS_CONSIGNACION ? (p.estado as EstadoConsignacion) : "";
  const supabase = await clienteServidor();
  let consulta = supabase
    .from("consignaciones")
    .select("id, numero, fecha_entrega, estado, total_entregado, total_vendido, total_pendiente, contactos(nombre)")
    .is("eliminado_en", null)
    .order("fecha_entrega", { ascending: false })
    .limit(300);
  if (estado) consulta = consulta.eq("estado", estado);
  else consulta = consulta.neq("estado", "cerrada");
  const { data: lista } = await consulta;

  const ids = (lista ?? []).map((c) => c.id);
  const { data: cuentas } = ids.length
    ? await supabase.from("cuentas_por_cobrar").select("origen_id, saldo").eq("origen_tipo", "consignacion").in("origen_id", ids)
    : { data: [] as { origen_id: string; saldo: number }[] };
  const saldoDe = new Map((cuentas ?? []).map((c) => [c.origen_id, c.saldo]));
  const enLaCalle = (lista ?? []).reduce((s, c) => s + c.total_pendiente, 0);

  return (
    <div>
      <Encabezado
        titulo="Consignaciones"
        subtitulo={`Mercancía con vendedoras: ${pesos(enLaCalle)}`}
        acciones={<BotonEnlace href="/consignaciones/nueva" variante="acento">📦 Nueva entrega</BotonEnlace>}
      />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {[
          ["", "Abiertas"],
          ["abierta", "Sin liquidar"],
          ["parcial", "Parciales"],
          ["cerrada", "Cerradas"],
        ].map(([v, t]) => (
          <Link key={v} href={v ? `/consignaciones?estado=${v}` : "/consignaciones"} className={`min-h-11 rounded-xl border px-4 py-2 font-semibold ${estado === v ? "border-primario bg-primario-claro text-primario-oscuro" : "border-borde bg-superficie"}`}>
            {t}
          </Link>
        ))}
      </div>

      {!lista?.length ? (
        <EstadoVacio titulo="No hay entregas en esta lista" texto="Crea una entrega para una vendedora y luego liquídala cuando te traiga la cuenta." accion={<BotonEnlace href="/consignaciones/nueva">Nueva entrega</BotonEnlace>} />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {lista.map((c) => {
            const contacto = c.contactos as unknown as { nombre: string } | null;
            const saldo = saldoDe.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/consignaciones/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-fondo">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {numeroDocumento("C", c.numero)} · {contacto?.nombre}
                    </span>
                    <span className="block text-sm text-texto-suave">
                      Entregada el {fecha(c.fecha_entrega)} · {pesos(c.total_entregado)} · pendiente {pesos(c.total_pendiente)}
                    </span>
                  </span>
                  <span className="text-right">
                    <Etiqueta tono={c.estado === "cerrada" ? "neutro" : c.estado === "parcial" ? "primario" : "alerta"}>{ESTADOS_CONSIGNACION[c.estado]}</Etiqueta>
                    {saldo > 0 && <span className="mt-1 block text-sm font-semibold text-alerta">Debe {pesos(saldo)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
