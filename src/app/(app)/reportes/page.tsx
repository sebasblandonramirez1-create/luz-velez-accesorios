import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, Tarjeta } from "@/components/ui";
import { hoyIso, pesos } from "@/lib/formato";
import { calcularPeriodo, desplazarPeriodo, type TipoPeriodo } from "@/lib/periodos";
import { filasResumen, textoValor } from "@/lib/reportes";
import { CATEGORIAS, CATEGORIAS_GASTO, MEDIOS_PAGO, type Reporte } from "@/lib/tipos";

export const metadata = { title: "Reportes" };

const TIPOS: { v: TipoPeriodo; t: string }[] = [
  { v: "dia", t: "Día" },
  { v: "semana", t: "Semana" },
  { v: "mes", t: "Mes" },
  { v: "anio", t: "Año" },
  { v: "rango", t: "Rango" },
];

function enlace(p: { tipo: TipoPeriodo; referencia: string; desde?: string; hasta?: string }) {
  const q = new URLSearchParams({ tipo: p.tipo, ref: p.referencia });
  if (p.desde) q.set("desde", p.desde);
  if (p.hasta) q.set("hasta", p.hasta);
  return `/reportes?${q}`;
}

export default async function PaginaReportes({ searchParams }: PageProps<"/reportes">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const p = await searchParams;
  const tipo = (TIPOS.some((t) => t.v === p.tipo) ? p.tipo : "mes") as TipoPeriodo;
  const ref = typeof p.ref === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.ref) ? p.ref : hoyIso();
  const periodo = calcularPeriodo(tipo, ref, { desde: typeof p.desde === "string" ? p.desde : undefined, hasta: typeof p.hasta === "string" ? p.hasta : undefined });
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("reporte_periodo", { p_desde: periodo.desde, p_hasta: periodo.hasta });
  const r = data as Reporte | null;
  const consulta = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta, etiqueta: periodo.etiqueta }).toString();

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Reportes"
        subtitulo={periodo.etiqueta}
        acciones={
          <>
            <a href={`/reportes/exportar?${consulta}`} className="inline-flex min-h-12 items-center rounded-xl border border-borde bg-superficie px-5 font-semibold hover:bg-primario-claro">
              Excel
            </a>
            <Link href={`/imprimir/reportes?${consulta}`} className="inline-flex min-h-12 items-center rounded-xl border border-borde bg-superficie px-5 font-semibold hover:bg-primario-claro">
              PDF / imprimir
            </Link>
          </>
        }
      />
      {error && <Aviso tipo="error">No se pudo calcular el reporte: {error.message}</Aviso>}

      <div className="flex flex-wrap items-center gap-2">
        {TIPOS.map((t) => (
          <Link key={t.v} href={enlace({ tipo: t.v, referencia: ref })} className={`min-h-11 rounded-xl border px-4 py-2 font-semibold ${tipo === t.v ? "border-primario bg-primario-claro text-primario-oscuro" : "border-borde bg-superficie"}`}>
            {t.t}
          </Link>
        ))}
        {tipo !== "rango" && (
          <span className="ml-auto flex gap-2">
            <Link href={enlace(desplazarPeriodo(periodo, -1))} className="min-h-11 rounded-xl border border-borde bg-superficie px-4 py-2 font-semibold" aria-label="Período anterior">
              ‹
            </Link>
            <Link href={enlace(desplazarPeriodo(periodo, 1))} className="min-h-11 rounded-xl border border-borde bg-superficie px-4 py-2 font-semibold" aria-label="Período siguiente">
              ›
            </Link>
          </span>
        )}
      </div>
      {tipo === "rango" && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tipo" value="rango" />
          <label className="block">
            <span className="block text-xs font-semibold text-texto-suave">Desde</span>
            <input type="date" name="desde" defaultValue={periodo.desde} className="campo !min-h-11" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-texto-suave">Hasta</span>
            <input type="date" name="hasta" defaultValue={periodo.hasta} className="campo !min-h-11" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-primario px-4 font-semibold text-white">
            Ver
          </button>
        </form>
      )}

      {r && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Ventas totales", r.ventas_total, ""],
              ["Margen bruto", r.margen_bruto, r.piezas_sin_costo > 0 ? `${r.piezas_sin_costo} piezas sin costo` : "estimado"],
              ["Gastos operativos", r.gastos_operativos, "sin mercancía"],
              ["Utilidad estimada", r.utilidad_estimada, ""],
            ].map(([t, v, n]) => (
              <div key={String(t)} className="rounded-2xl border border-borde bg-superficie p-3">
                <p className="text-xs text-texto-suave">{t}</p>
                <p className={`text-lg font-bold ${Number(v) < 0 ? "text-peligro" : ""}`}>{textoValor(Number(v))}</p>
                {n ? <p className="text-xs text-texto-suave">{n}</p> : null}
              </div>
            ))}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Tarjeta titulo="Resumen">
              <table className="w-full text-sm">
                <tbody>
                  {filasResumen(r).map((f) => (
                    <tr key={f.concepto} className="border-b border-borde">
                      <td className="py-1.5 pr-2">
                        {f.concepto}
                        {f.nota && <span className="block text-xs text-texto-suave">{f.nota}</span>}
                      </td>
                      <td className={`py-1.5 text-right font-semibold ${f.valor < 0 ? "text-peligro" : ""}`}>{textoValor(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>

            <div className="space-y-4">
              <Tarjeta titulo="Ventas por categoría">
                {r.por_categoria.length === 0 ? (
                  <p className="text-texto-suave">Sin ventas en el período.</p>
                ) : (
                  <ul className="divide-y divide-borde text-sm">
                    {r.por_categoria.map((c) => (
                      <li key={c.categoria} className="flex justify-between py-1.5">
                        <span>
                          {CATEGORIAS[c.categoria] ?? c.categoria} <span className="text-texto-suave">({c.cantidad})</span>
                        </span>
                        <span className="font-semibold">{pesos(c.ingreso)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
              <Tarjeta titulo="Gastos por categoría">
                {r.gastos_por_categoria.length === 0 ? (
                  <p className="text-texto-suave">Sin gastos en el período.</p>
                ) : (
                  <ul className="divide-y divide-borde text-sm">
                    {r.gastos_por_categoria.map((g) => (
                      <li key={g.categoria} className="flex justify-between py-1.5">
                        <span>
                          {CATEGORIAS_GASTO[g.categoria] ?? g.categoria} <span className="text-texto-suave">({g.cantidad})</span>
                        </span>
                        <span className="font-semibold">{pesos(g.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
              <Tarjeta titulo="Cobros por medio de pago">
                {r.ingresos_por_medio.length === 0 ? (
                  <p className="text-texto-suave">Sin cobros en el período.</p>
                ) : (
                  <ul className="divide-y divide-borde text-sm">
                    {r.ingresos_por_medio.map((m) => (
                      <li key={m.medio_pago} className="flex justify-between py-1.5">
                        <span>{MEDIOS_PAGO[m.medio_pago] ?? m.medio_pago}</span>
                        <span className="font-semibold">{pesos(m.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            </div>
          </div>

          <Tarjeta titulo="Productos más vendidos">
            {r.mas_vendidos.length === 0 ? (
              <p className="text-texto-suave">Sin ventas en el período.</p>
            ) : (
              <ol className="divide-y divide-borde text-sm">
                {r.mas_vendidos.map((p, i) => (
                  <li key={p.producto_id} className="flex items-center gap-3 py-1.5">
                    <span className="w-6 text-right text-texto-suave">{i + 1}.</span>
                    <Link href={`/productos/${p.producto_id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                      {p.nombre} <span className="font-normal text-texto-suave">{p.codigo}</span>
                    </Link>
                    <span className="text-texto-suave">{p.cantidad} uds.</span>
                    <span className="w-24 text-right font-semibold">{pesos(p.ingreso)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
          <p className="text-xs text-texto-suave">Control interno del negocio: no es contabilidad formal ni reemplaza la facturación electrónica. Margen y utilidad son estimaciones con el costo de compra registrado.</p>
        </>
      )}
    </div>
  );
}
