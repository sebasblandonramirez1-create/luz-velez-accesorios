import { fecha, fechaHora, pesos } from "@/lib/formato";
import { CAMPOS_RECEPTOR, codigoVerificacion, parrafosCondiciones, quienRecibe, totalesRecibo, type DatosRecibo } from "@/lib/recibo";
import { numeroDocumento } from "@/lib/ventas";

/**
 * Recibo de entrega en consignación, en negro sobre blanco, listo para
 * imprimir. Lo usan la vista de impresión, la página pública de firma y el
 * detalle de la consignación; el PDF (src/lib/recibo-pdf.ts) lleva lo mismo.
 *
 * Los datos de quien recibe que falten quedan como renglones en blanco para
 * llenarlos a mano.
 */
export function ReciboConsignacion({ datos }: { datos: DatosRecibo }) {
  const persona = quienRecibe(datos);
  const t = totalesRecibo(datos.lineas);
  const n = datos.negocio;
  const condiciones = parrafosCondiciones(datos.condiciones);
  return (
    <article className="bg-white text-black">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black pb-3">
        <div>
          <p className="text-2xl font-bold leading-tight">{n.nombre}</p>
          <p className="text-xs text-gray-600">{[n.documento && `NIT / C.C. ${n.documento}`, n.telefono && `Tel. ${n.telefono}`, n.correo].filter(Boolean).join(" · ")}</p>
          <p className="text-xs text-gray-600">{[n.direccion, n.ciudad].filter(Boolean).join(", ")}</p>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold uppercase">Recibo de entrega en consignación</h2>
          <p className="text-lg font-bold">N.º {numeroDocumento("C", datos.consignacion.numero)}</p>
          <p className="text-sm">Fecha de entrega: {fecha(datos.consignacion.fecha_entrega)}</p>
          <p className="text-sm font-bold">Fecha límite para liquidar: {datos.consignacion.fecha_limite ? fecha(datos.consignacion.fecha_limite) : "____ / ____ / ________"}</p>
        </div>
      </header>

      <section className="mt-4">
        <h3 className="border-b border-gray-500 pb-0.5 text-xs font-bold uppercase tracking-wide">Datos de quien recibe la mercancía</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
          {CAMPOS_RECEPTOR.map((c) => (
            <div key={c.clave} className="flex items-end gap-2 text-sm">
              <dt className="shrink-0 text-xs text-gray-600">{c.etiqueta}:</dt>
              <dd className="min-h-6 flex-1 break-words border-b border-gray-400 font-semibold">{persona[c.clave]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4">
        <h3 className="border-b border-gray-500 pb-0.5 text-xs font-bold uppercase tracking-wide">Mercancía entregada</h3>
        <div className="overflow-x-auto">
          <table className="mt-1 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-1 pr-2">Código</th>
                <th className="py-1 pr-2">Descripción</th>
                <th className="py-1 pr-2 text-right">Cant.</th>
                <th className="py-1 pr-2 text-right">Valor unit.</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.lineas.map((l) => (
                <tr key={l.codigo} className="border-b border-gray-300">
                  <td className="py-1 pr-2 font-mono font-semibold">{l.codigo}</td>
                  <td className="py-1 pr-2 uppercase">{l.nombre}</td>
                  <td className="py-1 pr-2 text-right font-semibold">{l.cantidad}</td>
                  <td className="py-1 pr-2 text-right">{pesos(l.valor_unitario)}</td>
                  <td className="py-1 text-right">{pesos(l.cantidad * l.valor_unitario)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-bold">
                <td colSpan={2} className="py-1 pr-2 font-normal">
                  {t.referencias} {t.referencias === 1 ? "referencia" : "referencias"} · {t.piezas} {t.piezas === 1 ? "pieza" : "piezas"}
                </td>
                <td colSpan={2} className="py-1 pr-2 text-right uppercase">
                  Total entregado
                </td>
                <td className="py-1 text-right">$ {pesos(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 flex items-end gap-2 text-sm">
          <span className="shrink-0 text-xs text-gray-600">Observaciones:</span>
          <span className="min-h-6 flex-1 border-b border-gray-400">{datos.consignacion.nota}</span>
        </p>
      </section>

      {condiciones.length > 0 && (
        <section className="mt-4">
          <h3 className="border-b border-gray-500 pb-0.5 text-xs font-bold uppercase tracking-wide">Condiciones de la consignación</h3>
          <div className="mt-1 space-y-1 text-xs leading-snug">
            {condiciones.map((c, i) => (
              <p key={i}>{c}</p>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 break-inside-avoid">
        <h3 className="border-b border-gray-500 pb-0.5 text-xs font-bold uppercase tracking-wide">Firmas</h3>
        <div className="mt-2 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="h-16 border-b border-black" />
            <p className="mt-1 text-xs font-bold uppercase">Entrega</p>
            <p>{n.nombre}</p>
            {n.documento && <p className="text-xs text-gray-600">NIT / C.C. {n.documento}</p>}
          </div>
          <div>
            <div className="flex h-16 items-end border-b border-black">
              {datos.firma && (
                // eslint-disable-next-line @next/next/no-img-element -- la firma es una imagen incrustada (data URL)
                <img src={datos.firma.imagen} alt={`Firma de ${persona.nombre}`} className="max-h-16 max-w-full object-contain" />
              )}
            </div>
            <p className="mt-1 text-xs font-bold uppercase">Recibe conforme</p>
            <p>{persona.nombre || "Nombre: ____________________"}</p>
            <p className="text-xs text-gray-600">{persona.documento ? `C.C. / NIT ${persona.documento}` : "C.C. / NIT: ____________________"}</p>
            {!datos.firma && <p className="mt-1 text-xs">Fecha de la firma: ____ / ____ / ________</p>}
          </div>
        </div>
        {datos.firma && (
          <p className="mt-3 text-xs">
            <strong>
              Firmado electrónicamente el {fechaHora(datos.firma.firmado_en)} (hora de Colombia). Código de verificación {codigoVerificacion(datos.firma.huella)}.
            </strong>
            <span className="block break-all text-[0.65rem] text-gray-600">Huella SHA-256: {datos.firma.huella}</span>
          </p>
        )}
      </section>
    </article>
  );
}
