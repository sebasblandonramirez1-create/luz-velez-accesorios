import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { BotonImprimir } from "@/components/copiar";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { filasResumen, textoValor } from "@/lib/reportes";
import { CATEGORIAS, CATEGORIAS_GASTO, MEDIOS_PAGO, type Reporte } from "@/lib/tipos";

function Seccion({ titulo, filas }: { titulo: string; filas: [string, number][] }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1 border-b border-black text-base font-bold uppercase">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="text-sm text-gray-500">Sin datos.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {filas.map(([k, v]) => (
              <tr key={k} className="border-b border-gray-300">
                <td className="py-1 pr-2">{k}</td>
                <td className="py-1 text-right">{pesos(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function ImprimirReporte({ searchParams }: PageProps<"/imprimir/reportes">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const sp = await searchParams;
  const desde = typeof sp.desde === "string" ? sp.desde : "";
  const hasta = typeof sp.hasta === "string" ? sp.hasta : "";
  const etiqueta = typeof sp.etiqueta === "string" ? sp.etiqueta : `${desde} a ${hasta}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) redirect("/reportes");
  const supabase = await clienteServidor();
  const [{ data }, { data: ajustes }] = await Promise.all([
    supabase.rpc("reporte_periodo", { p_desde: desde, p_hasta: hasta }),
    supabase.from("ajustes").select("nombre_negocio").eq("id", 1).single(),
  ]);
  const r = data as Reporte | null;
  if (!r) redirect("/reportes");

  return (
    <div>
      <div className="no-imprimir mb-4 flex items-center justify-between gap-2">
        <Link href={`/reportes?tipo=rango&desde=${desde}&hasta=${hasta}`} className="font-semibold text-primario">
          ← Volver a reportes
        </Link>
        <BotonImprimir />
      </div>
      <header className="mb-4 border-b-2 border-black pb-2">
        <p className="text-xs uppercase tracking-wide">{ajustes?.nombre_negocio}</p>
        <h1 className="text-xl font-bold uppercase">Reporte del período</h1>
        <p className="text-sm">
          {etiqueta} · impreso el {fecha(`${hoyIso()}T12:00:00-05:00`)}
        </p>
      </header>
      <section className="mb-5">
        <h2 className="mb-1 border-b border-black text-base font-bold uppercase">Resumen</h2>
        <table className="w-full text-sm">
          <tbody>
            {filasResumen(r).map((f) => (
              <tr key={f.concepto} className="border-b border-gray-300">
                <td className="py-1 pr-2">
                  {f.concepto}
                  {f.nota && <span className="block text-xs text-gray-500">{f.nota}</span>}
                </td>
                <td className="py-1 text-right font-semibold">{textoValor(f.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Seccion titulo="Ventas por categoría" filas={r.por_categoria.map((c) => [`${CATEGORIAS[c.categoria] ?? c.categoria} (${c.cantidad})`, c.ingreso])} />
      <Seccion titulo="Productos más vendidos" filas={r.mas_vendidos.map((p) => [`${p.codigo} · ${p.nombre} (${p.cantidad})`, p.ingreso])} />
      <Seccion titulo="Gastos por categoría" filas={r.gastos_por_categoria.map((g) => [`${CATEGORIAS_GASTO[g.categoria] ?? g.categoria} (${g.cantidad})`, g.valor])} />
      <Seccion titulo="Cobros por medio de pago" filas={r.ingresos_por_medio.map((m) => [MEDIOS_PAGO[m.medio_pago] ?? m.medio_pago, m.valor])} />
      <p className="text-xs text-gray-500">Control interno del negocio; no es contabilidad formal. Margen y utilidad son estimaciones con el costo de compra registrado.</p>
    </div>
  );
}
