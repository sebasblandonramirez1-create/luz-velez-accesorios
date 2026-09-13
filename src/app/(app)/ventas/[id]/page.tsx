import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { BotonCopiar } from "@/components/copiar";
import { fechaHora, pesos } from "@/lib/formato";
import { MEDIOS_PAGO } from "@/lib/tipos";
import { enlaceWhatsApp, numeroDocumento, subtotalLinea, textoComprobanteVenta } from "@/lib/ventas";
import { enviarVentaAPapelera } from "../acciones";
import { FormularioAbono } from "@/app/(app)/cuentas/formulario-abono";

export default async function PaginaVenta({ params, searchParams }: PageProps<"/ventas/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const nueva = sp.nueva === "1";
  const error = typeof sp.error === "string" ? sp.error : null;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();

  const [{ data: venta }, { data: lineas }, { data: cuenta }, { data: ajustes }] = await Promise.all([
    supabase.from("ventas").select("*, contactos(id, nombre, telefono)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("venta_lineas").select("*, productos(codigo, nombre)").eq("venta_id", id).order("creado_en"),
    supabase.from("cuentas_por_cobrar").select("*, abonos(id, fecha, valor, medio_pago, nota, eliminado_en)").eq("origen_tipo", "venta").eq("origen_id", id).maybeSingle(),
    supabase.from("ajustes").select("nombre_negocio, telefono_negocio").eq("id", 1).single(),
  ]);
  if (!venta) notFound();

  const contacto = venta.contactos as unknown as { id: string; nombre: string; telefono: string } | null;
  const filas = (lineas ?? []).map((l) => {
    const p = l.productos as unknown as { codigo: string; nombre: string };
    return { ...l, codigo: p.codigo, nombre: p.nombre };
  });
  const saldo = cuenta?.saldo ?? 0;
  const abonos = ((cuenta?.abonos as unknown as { id: string; fecha: string; valor: number; medio_pago: keyof typeof MEDIOS_PAGO; nota: string; eliminado_en: string | null }[]) ?? []).filter((a) => !a.eliminado_en);
  const negocio = ajustes?.nombre_negocio ?? "Luz Vélez Accesorios";
  const texto = textoComprobanteVenta(negocio, {
    numero: venta.numero,
    fecha: venta.fecha,
    total: venta.total,
    descuento_total: venta.descuento_total,
    medio_pago: venta.medio_pago,
    saldo,
    lineas: filas.map((f) => ({ nombre: f.nombre, codigo: f.codigo, cantidad: f.cantidad, precio_unitario: f.precio_unitario, descuento: f.descuento })),
  });

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={`Venta ${numeroDocumento("V", venta.numero)}`}
        subtitulo={`${fechaHora(venta.fecha)} · ${contacto?.nombre ?? "Cliente ocasional"}`}
        volver="/ventas"
        acciones={
          <>
            <a href={enlaceWhatsApp(contacto?.telefono, texto)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-exito px-5 font-semibold text-white">
              WhatsApp
            </a>
            <BotonEnlace href={`/imprimir/ventas/${venta.id}`} variante="secundario">
              Comprobante / PDF
            </BotonEnlace>
          </>
        }
      />
      {nueva && <Aviso tipo="exito">Venta registrada. El inventario ya se descontó.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Tarjeta titulo="Productos">
          <ul className="divide-y divide-borde">
            {filas.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block font-semibold">
                    {f.cantidad} × {f.nombre}
                  </span>
                  <span className="block text-sm text-texto-suave">
                    {f.codigo} · {pesos(f.precio_unitario)} c/u{f.descuento ? ` · desc. ${pesos(f.descuento)}` : ""}
                  </span>
                </span>
                <span className="font-bold">{pesos(subtotalLinea(f))}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-borde pt-3 text-right">
            {venta.descuento_total > 0 && (
              <div className="flex justify-between">
                <dt className="text-texto-suave">Subtotal</dt>
                <dd>{pesos(venta.subtotal)}</dd>
              </div>
            )}
            {venta.descuento_total > 0 && (
              <div className="flex justify-between">
                <dt className="text-texto-suave">Descuento</dt>
                <dd>− {pesos(venta.descuento_total)}</dd>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold">
              <dt>Total</dt>
              <dd>{pesos(venta.total)}</dd>
            </div>
          </dl>
          {venta.nota && <p className="mt-3 text-sm text-texto-suave">Nota: {venta.nota}</p>}
        </Tarjeta>

        <div className="space-y-4">
          <Tarjeta titulo="Pago">
            <p className="mb-2">
              {MEDIOS_PAGO[venta.medio_pago]} ·{" "}
              {saldo > 0 ? <Etiqueta tono="alerta">Saldo {pesos(saldo)}</Etiqueta> : <Etiqueta tono="exito">Pagada</Etiqueta>}
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
                <FormularioAbono cuentaId={cuenta.id} saldo={saldo} volver={`/ventas/${venta.id}`} />
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Mensaje para WhatsApp">
            <pre className="whitespace-pre-wrap rounded-xl bg-fondo p-3 text-sm">{texto}</pre>
            <div className="mt-2 flex gap-2">
              <BotonCopiar texto={texto} />
              {contacto && (
                <Link href={`/contactos/${contacto.id}`} className="inline-flex min-h-12 items-center px-3 font-semibold text-primario">
                  Ver contacto
                </Link>
              )}
            </div>
          </Tarjeta>
        </div>
      </div>

      {sesion.perfil.rol === "propietaria" && (
        <div className="flex justify-end">
          <BotonConfirmar
            accion={enviarVentaAPapelera}
            campos={{ id: venta.id }}
            titulo="¿Anular esta venta?"
            texto="Los productos vuelven al inventario y los pagos registrados se anulan. Podrás restaurarla desde la papelera durante 30 días."
            confirmar="Sí, anular la venta"
          >
            Anular venta
          </BotonConfirmar>
        </div>
      )}
    </div>
  );
}
