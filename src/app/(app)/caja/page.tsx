import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { fecha, hoyIso, pesos } from "@/lib/formato";
import { fechaLarga, sumarDias } from "@/lib/periodos";
import { MEDIOS_PAGO, type CajaDia } from "@/lib/tipos";
import { FormularioCierre } from "./formulario-cierre";

export const metadata = { title: "Caja del día" };

export default async function PaginaCaja({ searchParams }: PageProps<"/caja">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const p = await searchParams;
  const dia = typeof p.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.dia) ? p.dia : hoyIso();
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const supabase = await clienteServidor();
  const [{ data: caja, error }, { data: cierres }] = await Promise.all([
    supabase.rpc("caja_del_dia", { p_dia: dia }),
    supabase.from("cierres_caja").select("dia, efectivo_esperado, efectivo_contado, diferencia").order("dia", { ascending: false }).limit(10),
  ]);
  const c = caja as CajaDia | null;
  const esperado = c ? c.ingresos_efectivo - c.gastos_efectivo : 0;

  return (
    <div className="space-y-4">
      <Encabezado titulo="Caja del día" subtitulo={fechaLarga(dia)} />
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {error && <Aviso tipo="error">No se pudo calcular la caja: {error.message}</Aviso>}
      <div className="flex items-center justify-between gap-2">
        <Link href={`/caja?dia=${sumarDias(dia, -1)}`} className="min-h-11 rounded-xl border border-borde bg-superficie px-4 py-2 font-semibold">
          ‹ Día anterior
        </Link>
        <form method="get" className="flex items-center gap-2">
          <input type="date" name="dia" defaultValue={dia} className="campo !min-h-11" aria-label="Día" />
          <button type="submit" className="min-h-11 rounded-xl border border-borde bg-superficie px-3 font-semibold">
            Ir
          </button>
        </form>
        {dia < hoyIso() ? (
          <Link href={`/caja?dia=${sumarDias(dia, 1)}`} className="min-h-11 rounded-xl border border-borde bg-superficie px-4 py-2 font-semibold">
            Día siguiente ›
          </Link>
        ) : (
          <span />
        )}
      </div>

      {c && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-borde bg-superficie p-3">
              <p className="text-xs text-texto-suave">Ingresos en efectivo</p>
              <p className="text-lg font-bold text-exito">{pesos(c.ingresos_efectivo)}</p>
            </div>
            <div className="rounded-2xl border border-borde bg-superficie p-3">
              <p className="text-xs text-texto-suave">Ingresos por otros medios</p>
              <p className="text-lg font-bold">{pesos(c.ingresos_otros)}</p>
            </div>
            <div className="rounded-2xl border border-borde bg-superficie p-3">
              <p className="text-xs text-texto-suave">Gastos en efectivo</p>
              <p className="text-lg font-bold text-peligro">{pesos(c.gastos_efectivo)}</p>
            </div>
            <div className="rounded-2xl border border-borde bg-superficie p-3">
              <p className="text-xs text-texto-suave">Efectivo que debe haber</p>
              <p className="text-lg font-bold">{pesos(esperado)}</p>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Tarjeta titulo={`Ingresos (${c.ventas} ${c.ventas === 1 ? "venta" : "ventas"})`}>
              {c.ingresos.length === 0 ? (
                <p className="text-texto-suave">Sin pagos recibidos este día.</p>
              ) : (
                <ul className="divide-y divide-borde">
                  {c.ingresos.map((i) => (
                    <li key={i.medio_pago} className="flex justify-between py-2">
                      <span>
                        {MEDIOS_PAGO[i.medio_pago]} <span className="text-sm text-texto-suave">({i.cantidad})</span>
                      </span>
                      <span className="font-semibold">{pesos(i.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/ventas?desde=${dia}&hasta=${dia}`} className="mt-2 inline-block text-sm font-semibold text-primario">
                Ver ventas del día
              </Link>
            </Tarjeta>
            <Tarjeta titulo="Gastos">
              {c.gastos.length === 0 ? (
                <p className="text-texto-suave">Sin gastos este día.</p>
              ) : (
                <ul className="divide-y divide-borde">
                  {c.gastos.map((g) => (
                    <li key={g.medio_pago} className="flex justify-between py-2">
                      <span>
                        {MEDIOS_PAGO[g.medio_pago]} <span className="text-sm text-texto-suave">({g.cantidad})</span>
                      </span>
                      <span className="font-semibold">{pesos(g.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/gastos" className="mt-2 inline-block text-sm font-semibold text-primario">
                Ver gastos
              </Link>
            </Tarjeta>
          </div>

          <Tarjeta titulo={c.cierre ? "Cierre de caja" : "Cerrar la caja"}>
            {c.cierre && (
              <p className="mb-3">
                Cerrada: esperado {pesos(c.cierre.efectivo_esperado)}, contado {pesos(c.cierre.efectivo_contado)}.{" "}
                {c.cierre.diferencia === 0 ? <Etiqueta tono="exito">Cuadra</Etiqueta> : c.cierre.diferencia > 0 ? <Etiqueta tono="alerta">Sobran {pesos(c.cierre.diferencia)}</Etiqueta> : <Etiqueta tono="peligro">Faltan {pesos(-c.cierre.diferencia)}</Etiqueta>}
                {c.cierre.nota ? ` · ${c.cierre.nota}` : ""}
              </p>
            )}
            <FormularioCierre dia={dia} esperado={esperado} contadoActual={c.cierre?.efectivo_contado ?? null} yaCerrada={Boolean(c.cierre)} />
          </Tarjeta>
        </>
      )}

      {cierres && cierres.length > 0 && (
        <Tarjeta titulo="Últimos cierres">
          <ul className="divide-y divide-borde text-sm">
            {cierres.map((x) => (
              <li key={x.dia} className="flex items-center justify-between py-2">
                <Link href={`/caja?dia=${x.dia}`} className="font-semibold text-primario">
                  {fecha(`${x.dia}T12:00:00-05:00`)}
                </Link>
                <span>
                  {pesos(x.efectivo_contado)} contado ·{" "}
                  {x.diferencia === 0 ? <Etiqueta tono="exito">Cuadra</Etiqueta> : x.diferencia > 0 ? <Etiqueta tono="alerta">+{pesos(x.diferencia)}</Etiqueta> : <Etiqueta tono="peligro">−{pesos(-x.diferencia)}</Etiqueta>}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
