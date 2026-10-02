import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { fecha, fechaHora, hoyIso, pesos } from "@/lib/formato";
import { ESTADOS_CONSIGNACION, MEDIOS_PAGO, type CategoriaProducto } from "@/lib/tipos";
import { enlaceWhatsApp, hojasConsignacion, numeroDocumento, textoRecordatorioSaldo } from "@/lib/ventas";
import { anularLiquidacion, enviarConsignacionAPapelera } from "../acciones";
import { FormularioLiquidacion } from "./formulario-liquidacion";
import { FormularioAbono } from "@/app/(app)/cuentas/formulario-abono";
import { cargarRecibo, urlDeLaApp } from "@/lib/recibo-servidor";
import { PanelRecibo } from "./panel-recibo";
import { describirCambio, resumenModificacion, type CambioConsignacion } from "@/lib/modificaciones";

export default async function PaginaConsignacion({ params, searchParams }: PageProps<"/consignaciones/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const nueva = sp.nueva === "1";
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();

  const [{ data: c }, { data: lineas }, { data: liquidaciones }, { data: cuenta }, { data: ajustes }, recibo, urlApp, { data: modificaciones }] = await Promise.all([
    supabase.from("consignaciones").select("*, contactos(id, nombre, telefono)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("consignacion_lineas").select("*, productos(codigo, nombre, categoria, material)").eq("consignacion_id", id).order("creado_en"),
    supabase.from("liquidaciones").select("*, liquidacion_lineas(consignacion_linea_id, cantidad_vendida, cantidad_devuelta)").eq("consignacion_id", id).is("eliminado_en", null).order("fecha", { ascending: false }),
    supabase.from("cuentas_por_cobrar").select("*, abonos(id, fecha, valor, medio_pago, nota, eliminado_en)").eq("origen_tipo", "consignacion").eq("origen_id", id).maybeSingle(),
    supabase.from("ajustes").select("nombre_negocio").eq("id", 1).single(),
    cargarRecibo(supabase, id),
    urlDeLaApp(),
    supabase.from("consignacion_modificaciones").select("*").eq("consignacion_id", id).order("numero", { ascending: false }),
  ]);
  if (!c) notFound();
  const enlaceFirma = recibo?.recibo ? `${urlApp}/firmar/${recibo.recibo.token}` : null;
  const vencida = c.estado !== "cerrada" && c.fecha_limite != null && c.fecha_limite < hoyIso();

  const contacto = c.contactos as unknown as { id: string; nombre: string; telefono: string };
  const filas = (lineas ?? []).map((l) => {
    const p = l.productos as unknown as { codigo: string; nombre: string; categoria: CategoriaProducto; material: string };
    return { ...l, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, material: p.material };
  });
  const hojas = hojasConsignacion(filas);
  const saldo = cuenta?.saldo ?? 0;
  const abonos = ((cuenta?.abonos as unknown as { id: string; fecha: string; valor: number; medio_pago: keyof typeof MEDIOS_PAGO; nota: string; eliminado_en: string | null }[]) ?? []).filter((a) => !a.eliminado_en);
  const negocio = ajustes?.nombre_negocio ?? "Luzazul Accesorios";
  const recordatorio = textoRecordatorioSaldo(negocio, contacto.nombre, saldo, [{ descripcion: `Consignación ${numeroDocumento("C", c.numero)} del ${fecha(c.fecha_entrega)}`, saldo }]);
  const esPropietaria = sesion.perfil.rol === "propietaria";

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={`Consignación ${numeroDocumento("C", c.numero)}`}
        subtitulo={`${contacto.nombre} · entregada el ${fecha(c.fecha_entrega)}${c.fecha_limite ? ` · límite ${fecha(c.fecha_limite)}` : ""}`}
        volver="/consignaciones"
        acciones={
          <>
            {c.estado !== "cerrada" && (
              <BotonEnlace href={`/consignaciones/${c.id}/modificar`} variante="secundario">
                ✏️ Modificar entrega
              </BotonEnlace>
            )}
            <BotonEnlace href={`/imprimir/consignaciones/${c.id}`} variante="secundario">
              Hojas / PDF
            </BotonEnlace>
            {saldo > 0 && (
              <a href={enlaceWhatsApp(contacto.telefono, recordatorio)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-exito px-5 font-semibold text-white">
                Recordar saldo
              </a>
            )}
          </>
        }
      />
      {nueva && <Aviso tipo="exito">Entrega registrada y descontada del inventario. Abajo puedes imprimir el recibo, compartirlo por WhatsApp o correo, o pedir la firma electrónica.</Aviso>}
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Entregado", c.total_entregado, "neutro"],
          ["Vendido", c.total_vendido, "exito"],
          ["Devuelto", c.total_devuelto, "primario"],
          ["Pendiente", c.total_pendiente, "alerta"],
        ].map(([t, v]) => (
          <div key={String(t)} className="rounded-2xl border border-borde bg-superficie p-3">
            <p className="text-xs text-texto-suave">{t}</p>
            <p className="text-lg font-bold">{pesos(Number(v))}</p>
          </div>
        ))}
      </section>
      <p>
        <Etiqueta tono={c.estado === "cerrada" ? "neutro" : c.estado === "parcial" ? "primario" : "alerta"}>{ESTADOS_CONSIGNACION[c.estado]}</Etiqueta>{" "}
        {saldo > 0 ? <Etiqueta tono="alerta">Debe {pesos(saldo)}</Etiqueta> : c.total_vendido > 0 ? <Etiqueta tono="exito">Al día</Etiqueta> : null}{" "}
        {vencida && <Etiqueta tono="peligro">Pasó la fecha límite ({fecha(c.fecha_limite)})</Etiqueta>}{" "}
        {recibo?.datos.firma ? <Etiqueta tono="exito">Recibo firmado</Etiqueta> : recibo?.recibo ? <Etiqueta tono="alerta">Firma pendiente</Etiqueta> : null}{" "}
        {modificaciones && modificaciones.length > 0 && (
          <a href="#historial">
            <Etiqueta tono="primario">
              Modificada {modificaciones.length} {modificaciones.length === 1 ? "vez" : "veces"}
            </Etiqueta>
          </a>
        )}
      </p>

      {recibo && (
        <div id="recibo" className="scroll-mt-20">
          <Tarjeta titulo="Recibo de entrega">
            <PanelRecibo datos={recibo.datos} enlaceFirma={enlaceFirma} esPropietaria={sesion.perfil.rol === "propietaria"} />
          </Tarjeta>
        </div>
      )}

      <Tarjeta titulo="Piezas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-texto-suave">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2 text-right">Valor</th>
                <th className="py-2 pr-2 text-right">Entr.</th>
                <th className="py-2 pr-2 text-right">Vend.</th>
                <th className="py-2 pr-2 text-right">Dev.</th>
                <th className="py-2 text-right">Pend.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-borde">
                  <td className="py-2 pr-2">
                    <span className="block font-semibold">{f.nombre}</span>
                    <span className="text-texto-suave">{f.codigo}</span>
                  </td>
                  <td className="py-2 pr-2 text-right">{pesos(f.valor_unitario)}</td>
                  <td className="py-2 pr-2 text-right">{f.cantidad_entregada}</td>
                  <td className="py-2 pr-2 text-right text-exito">{f.cantidad_vendida}</td>
                  <td className="py-2 pr-2 text-right text-primario">{f.cantidad_devuelta}</td>
                  <td className="py-2 text-right font-bold">{f.cantidad_pendiente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {c.nota && <p className="mt-2 text-sm text-texto-suave">Nota: {c.nota}</p>}
      </Tarjeta>

      {c.estado !== "cerrada" && (
        <Tarjeta titulo="Liquidar: ¿qué vendió y qué devuelve?">
          <FormularioLiquidacion
            consignacionId={c.id}
            saldoActual={saldo}
            lineas={filas.filter((f) => f.cantidad_pendiente > 0).map((f) => ({ id: f.id, codigo: f.codigo, nombre: f.nombre, valor_unitario: f.valor_unitario, pendiente: f.cantidad_pendiente }))}
          />
        </Tarjeta>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="Cuenta">
          <p className="mb-2">
            Vendido {pesos(cuenta?.valor_total ?? 0)} · abonado {pesos(cuenta?.abonado ?? 0)} · <strong>saldo {pesos(saldo)}</strong>
          </p>
          {abonos.length > 0 && (
            <ul className="divide-y divide-borde text-sm">
              {abonos.map((a) => (
                <li key={a.id} className="flex justify-between py-1.5">
                  <span>
                    {fechaHora(a.fecha)} · {MEDIOS_PAGO[a.medio_pago]}
                    {a.nota ? ` · ${a.nota}` : ""}
                  </span>
                  <span className="font-semibold">{pesos(a.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          {saldo > 0 && cuenta && (
            <div className="mt-3">
              <FormularioAbono cuentaId={cuenta.id} saldo={saldo} volver={`/consignaciones/${c.id}`} />
            </div>
          )}
          <Link href={`/cuentas/${contacto.id}`} className="mt-2 inline-block text-sm font-semibold text-primario">
            Ver todas las cuentas de {contacto.nombre.split(" ")[0]}
          </Link>
        </Tarjeta>

        <Tarjeta titulo="Liquidaciones">
          {!liquidaciones?.length ? (
            <p className="text-texto-suave">Todavía no se ha liquidado nada.</p>
          ) : (
            <ul className="divide-y divide-borde text-sm">
              {liquidaciones.map((l) => {
                const ll = l.liquidacion_lineas as unknown as { cantidad_vendida: number; cantidad_devuelta: number }[];
                const vend = ll.reduce((s, x) => s + x.cantidad_vendida, 0);
                const dev = ll.reduce((s, x) => s + x.cantidad_devuelta, 0);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="block font-semibold">{fechaHora(l.fecha)}</span>
                      <span className="text-texto-suave">
                        {vend} vendidas ({pesos(l.total_vendido)}) · {dev} devueltas{l.nota ? ` · ${l.nota}` : ""}
                      </span>
                    </span>
                    {esPropietaria && (
                      <BotonConfirmar accion={anularLiquidacion} campos={{ id: l.id, consignacion_id: c.id }} titulo="¿Anular esta liquidación?" texto="Se deshacen las cantidades vendidas y devueltas de esa visita, y las devoluciones salen otra vez del inventario." confirmar="Sí, anular" className="!min-h-10 !px-3 text-sm">
                        Anular
                      </BotonConfirmar>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div id="historial" className="scroll-mt-20">
        <Tarjeta titulo="Historial de modificaciones">
          {!modificaciones?.length ? (
            <p className="text-texto-suave">
              Esta entrega no se ha modificado desde que se registró.
              {c.estado !== "cerrada" ? " Con «Modificar entrega» puedes añadir o retirar piezas sin liquidar; cada cambio queda anotado aquí." : ""}
            </p>
          ) : (
            <ol className="space-y-4">
              {modificaciones.map((m) => (
                <li key={m.id} className="border-l-4 border-oro pl-3">
                  <p className="font-semibold">
                    Modificación n.º {m.numero} · {fechaHora(m.fecha)}
                  </p>
                  <p className="text-sm text-texto-suave">
                    Por {m.usuario_nombre || "una usuaria"}
                    {m.motivo ? ` · Motivo: ${m.motivo}` : ""}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {(m.cambios as unknown as CambioConsignacion[]).map((cambio, i) => (
                      <li key={i}>{describirCambio(cambio)}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-sm font-semibold">{resumenModificacion(m)}</p>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Resumen como en las hojas">
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <h3 className="font-bold">VENTAS</h3>
            {hojas.ventas.filas.length === 0 ? <p className="text-texto-suave">Nada vendido aún.</p> : hojas.ventas.filas.map((f) => <p key={f.codigo}>{f.cantidad} × {f.descripcion} · {pesos(f.total)}</p>)}
            <p className="mt-1 font-bold">Total vendido: {pesos(hojas.ventas.total)}</p>
          </div>
          <div>
            <h3 className="font-bold">DEVOLUCIONES</h3>
            {hojas.devoluciones.bloques.length === 0 ? <p className="text-texto-suave">Nada devuelto aún.</p> : hojas.devoluciones.bloques.map((b) => (
              <div key={b.titulo} className="mb-1">
                <p className="font-semibold">{b.titulo}</p>
                {b.filas.map((f) => <p key={f.codigo}>{f.cantidad} × {f.descripcion} · {pesos(f.total)}</p>)}
                <p className="text-texto-suave">Subtotal {pesos(b.total)}</p>
              </div>
            ))}
            <p className="mt-1 font-bold">Total devuelto: {pesos(hojas.devoluciones.total)}</p>
          </div>
          <div>
            <h3 className="font-bold">PENDIENTE DE PAGO</h3>
            {hojas.pendientes.filas.length === 0 ? <p className="text-texto-suave">Nada pendiente.</p> : hojas.pendientes.filas.map((f) => <p key={f.codigo}>{f.cantidad} × {f.descripcion} · {pesos(f.total)}</p>)}
            <p className="mt-1 font-bold">Total pendiente: {pesos(hojas.pendientes.total)}</p>
          </div>
        </div>
      </Tarjeta>

      {esPropietaria && (!liquidaciones || liquidaciones.length === 0) && (
        <div className="flex justify-end">
          <BotonConfirmar accion={enviarConsignacionAPapelera} campos={{ id: c.id }} titulo="¿Anular esta entrega?" texto="Los productos vuelven al inventario. Podrás restaurarla desde la papelera durante 30 días." confirmar="Sí, anular la entrega">
            Anular entrega
          </BotonConfirmar>
        </div>
      )}
    </div>
  );
}
