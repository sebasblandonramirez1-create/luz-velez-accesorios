import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { calcularPeriodo, desplazarPeriodo } from "@/lib/periodos";
import { CATEGORIAS_GASTO, MEDIOS_PAGO } from "@/lib/tipos";

export const metadata = { title: "Gastos" };

export default async function PaginaGastos({ searchParams }: PageProps<"/gastos">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const referencia = typeof p.mes === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.mes) ? p.mes : hoyIso();
  const periodo = calcularPeriodo("mes", referencia);
  const supabase = await clienteServidor();

  const { data: gastos } = await supabase
    .from("gastos")
    .select("id, fecha, categoria, valor, medio_pago, nota, compra_id, foto_soporte, contactos(nombre)")
    .is("eliminado_en", null)
    .gte("fecha", `${periodo.desde}T00:00:00-05:00`)
    .lte("fecha", `${periodo.hasta}T23:59:59-05:00`)
    .order("fecha", { ascending: false });

  const total = (gastos ?? []).reduce((s, g) => s + g.valor, 0);
  const porCategoria = new Map<string, number>();
  for (const g of gastos ?? []) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.valor);
  const anterior = desplazarPeriodo(periodo, -1).referencia;
  const siguiente = desplazarPeriodo(periodo, 1).referencia;

  return (
    <div>
      <Encabezado titulo="Gastos" subtitulo={`${periodo.etiqueta}: ${pesos(total)}`} acciones={<BotonEnlace href="/gastos/nuevo">➕ Registrar gasto</BotonEnlace>} />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/gastos?mes=${anterior}`} className="min-h-11 rounded-xl border border-borde bg-superficie px-4 py-2 font-semibold">
          ‹ Mes anterior
        </Link>
        <span className="font-semibold">{periodo.etiqueta}</span>
        <Link href={`/gastos?mes=${siguiente}`} className="min-h-11 rounded-xl border border-borde bg-superficie px-4 py-2 font-semibold">
          Mes siguiente ›
        </Link>
      </div>

      {porCategoria.size > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {[...porCategoria.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c, v]) => (
              <li key={c} className="rounded-xl border border-borde bg-superficie px-3 py-2 text-sm">
                <span className="text-texto-suave">{CATEGORIAS_GASTO[c as keyof typeof CATEGORIAS_GASTO]}</span> <strong>{pesos(v)}</strong>
              </li>
            ))}
        </ul>
      )}

      {!gastos?.length ? (
        <EstadoVacio titulo="Sin gastos este mes" texto="Registra empaques, transporte, comisiones, publicidad… Las compras de mercancía se registran en Compras y aparecen aquí solas." accion={<BotonEnlace href="/gastos/nuevo">Registrar gasto</BotonEnlace>} />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {gastos.map((g) => {
            const prov = g.contactos as unknown as { nombre: string } | null;
            const href = g.compra_id ? `/compras/${g.compra_id}` : `/gastos/${g.id}`;
            return (
              <li key={g.id}>
                <Link href={href} className="flex items-center gap-3 p-3 hover:bg-fondo">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {CATEGORIAS_GASTO[g.categoria]}
                      {g.nota ? ` · ${g.nota}` : ""}
                    </span>
                    <span className="block text-sm text-texto-suave">
                      {fecha(g.fecha)} · {MEDIOS_PAGO[g.medio_pago]}
                      {prov ? ` · ${prov.nombre}` : ""}
                      {g.foto_soporte ? " · 📎" : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{pesos(g.valor)}</span>
                    {g.compra_id && <Etiqueta tono="primario">Compra</Etiqueta>}
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
