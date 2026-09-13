import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonImprimir } from "@/components/copiar";
import { fechaHora, pesos } from "@/lib/formato";
import { MEDIOS_PAGO } from "@/lib/tipos";
import { numeroDocumento, subtotalLinea } from "@/lib/ventas";

export default async function ComprobanteVenta({ params }: PageProps<"/imprimir/ventas/[id]">) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const [{ data: venta }, { data: lineas }, { data: cuenta }, { data: ajustes }] = await Promise.all([
    supabase.from("ventas").select("*, contactos(nombre, telefono)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("venta_lineas").select("*, productos(codigo, nombre)").eq("venta_id", id).order("creado_en"),
    supabase.from("cuentas_por_cobrar").select("saldo, abonado").eq("origen_tipo", "venta").eq("origen_id", id).maybeSingle(),
    supabase.from("ajustes").select("nombre_negocio, telefono_negocio").eq("id", 1).single(),
  ]);
  if (!venta) notFound();
  const contacto = venta.contactos as unknown as { nombre: string; telefono: string } | null;

  return (
    <div>
      <div className="no-imprimir mb-4 flex items-center justify-between gap-2">
        <Link href={`/ventas/${id}`} className="font-semibold text-primario">
          ← Volver a la venta
        </Link>
        <BotonImprimir />
      </div>
      <p className="no-imprimir mb-4 text-sm text-gray-600">En el celular: al pulsar imprimir, elige «Guardar como PDF» para enviarlo por WhatsApp.</p>

      <article className="mx-auto max-w-sm border border-gray-300 p-5 font-mono text-sm print:max-w-none print:border-0">
        <header className="text-center">
          <h1 className="text-lg font-bold uppercase">{ajustes?.nombre_negocio}</h1>
          {ajustes?.telefono_negocio && <p>Tel. {ajustes.telefono_negocio}</p>}
          <p className="mt-2">COMPROBANTE DE VENTA {numeroDocumento("V", venta.numero)}</p>
          <p>{fechaHora(venta.fecha)}</p>
        </header>
        {contacto && (
          <p className="mt-3">
            Cliente: {contacto.nombre}
            {contacto.telefono ? ` · ${contacto.telefono}` : ""}
          </p>
        )}
        <table className="mt-3 w-full">
          <thead>
            <tr className="border-b border-dashed border-gray-400 text-left">
              <th className="py-1">Cant.</th>
              <th className="py-1">Descripción</th>
              <th className="py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(lineas ?? []).map((l) => {
              const p = l.productos as unknown as { codigo: string; nombre: string };
              return (
                <tr key={l.id} className="align-top">
                  <td className="py-1 pr-2">{l.cantidad}</td>
                  <td className="py-1 pr-2">
                    {p.nombre}
                    <br />
                    <span className="text-xs text-gray-600">
                      {p.codigo} · {pesos(l.precio_unitario)} c/u{l.descuento ? ` · desc. ${pesos(l.descuento)}` : ""}
                    </span>
                  </td>
                  <td className="py-1 text-right">{pesos(subtotalLinea(l))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 border-t border-dashed border-gray-400 pt-2">
          {venta.descuento_total > 0 && (
            <>
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>{pesos(venta.subtotal)}</span>
              </p>
              <p className="flex justify-between">
                <span>Descuento</span>
                <span>− {pesos(venta.descuento_total)}</span>
              </p>
            </>
          )}
          <p className="flex justify-between text-base font-bold">
            <span>TOTAL</span>
            <span>{pesos(venta.total)}</span>
          </p>
          <p className="flex justify-between">
            <span>Pago: {MEDIOS_PAGO[venta.medio_pago]}</span>
            <span>{(cuenta?.saldo ?? 0) > 0 ? `Saldo ${pesos(cuenta!.saldo)}` : "Pagado"}</span>
          </p>
        </div>
        {venta.nota && <p className="mt-2 text-xs">{venta.nota}</p>}
        <p className="mt-4 text-center text-xs">¡Gracias por tu compra! Este comprobante es un control interno y no es factura.</p>
      </article>
    </div>
  );
}
