import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { numeroDocumento } from "@/lib/ventas";
import { MEDIOS_PAGO } from "@/lib/tipos";

export const metadata = { title: "Ventas" };

export default async function PaginaVentas({ searchParams }: PageProps<"/ventas">) {
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const desde = typeof p.desde === "string" ? p.desde : "";
  const hasta = typeof p.hasta === "string" ? p.hasta : "";
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("ventas")
    .select("id, numero, fecha, total, medio_pago, contactos(nombre)")
    .is("eliminado_en", null)
    .order("fecha", { ascending: false })
    .limit(300);
  if (desde) consulta = consulta.gte("fecha", `${desde}T00:00:00-05:00`);
  if (hasta) consulta = consulta.lte("fecha", `${hasta}T23:59:59-05:00`);
  const { data: ventas, error } = await consulta;
  // La cuenta por cobrar de cada venta (origen polimórfico: se consulta aparte).
  const ids = (ventas ?? []).map((v) => v.id);
  const { data: cuentas } = ids.length
    ? await supabase.from("cuentas_por_cobrar").select("origen_id, saldo, estado").eq("origen_tipo", "venta").in("origen_id", ids)
    : { data: [] as { origen_id: string; saldo: number; estado: string }[] };
  const saldoPorVenta = new Map((cuentas ?? []).map((c) => [c.origen_id, c]));

  const hoy = hoyIso();
  const totalHoy = (ventas ?? []).filter((v) => fecha(v.fecha) === fecha(`${hoy}T12:00:00-05:00`)).reduce((s, v) => s + v.total, 0);
  const totalLista = (ventas ?? []).reduce((s, v) => s + v.total, 0);

  return (
    <div>
      <Encabezado titulo="Ventas" subtitulo={`Hoy: ${pesos(totalHoy)}`} acciones={<BotonEnlace href="/ventas/nueva">🛍️ Registrar venta</BotonEnlace>} />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" className="mb-4">
          No se pudieron cargar las ventas: {error.message}
        </Aviso>
      )}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-xs font-semibold text-texto-suave">Desde</span>
          <input type="date" name="desde" defaultValue={desde} className="campo !min-h-11" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-texto-suave">Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta} className="campo !min-h-11" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl border border-borde bg-superficie px-4 font-semibold">
          Filtrar
        </button>
        {(desde || hasta) && (
          <Link href="/ventas" className="min-h-11 px-2 py-2 font-semibold text-primario">
            Quitar
          </Link>
        )}
        <span className="ml-auto text-sm text-texto-suave">
          {ventas?.length ?? 0} ventas · {pesos(totalLista)}
        </span>
      </form>

      {!ventas?.length ? (
        <EstadoVacio titulo="Todavía no hay ventas" texto="Registra la primera con el botón de arriba." accion={<BotonEnlace href="/ventas/nueva">Registrar venta</BotonEnlace>} />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {ventas.map((v) => {
            const contacto = v.contactos as unknown as { nombre: string } | null;
            const c = saldoPorVenta.get(v.id);
            return (
              <li key={v.id}>
                <Link href={`/ventas/${v.id}`} className="flex items-center gap-3 p-3 hover:bg-fondo">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {numeroDocumento("V", v.numero)} · {contacto?.nombre ?? "Cliente ocasional"}
                    </span>
                    <span className="block text-sm text-texto-suave">
                      {fecha(v.fecha)} · {MEDIOS_PAGO[v.medio_pago]}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-lg font-bold">{pesos(v.total)}</span>
                    {c && c.saldo > 0 ? <Etiqueta tono="alerta">Debe {pesos(c.saldo)}</Etiqueta> : <Etiqueta tono="exito">Pagada</Etiqueta>}
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
