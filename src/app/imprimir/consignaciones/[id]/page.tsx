import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonImprimir } from "@/components/copiar";
import { enMiles, fecha, hoyIso, pesos } from "@/lib/formato";
import type { CategoriaProducto } from "@/lib/tipos";
import { hojasConsignacion, numeroDocumento, type FilaHoja } from "@/lib/ventas";
import { cargarRecibo } from "@/lib/recibo-servidor";
import { ReciboConsignacion } from "@/components/recibo-consignacion";
import { BotonesPdfRecibo } from "@/components/compartir-recibo";

interface Encabezamiento {
  negocio: string;
  contacto: { nombre: string; telefono: string };
  numero: number;
  fechaEntrega: string;
  hoy: string;
}

function Tabla({ filas, total, etiquetaTotal, conMiles }: { filas: FilaHoja[]; total: number; etiquetaTotal: string; conMiles: boolean }) {
  const codigoHoja = (f: FilaHoja) => (conMiles ? `${f.codigo} ${enMiles(f.valor_unitario)}` : f.codigo);
  return (
    <table className="w-full border-collapse text-sm">
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
        {filas.map((f) => (
          <tr key={f.codigo} className="border-b border-gray-300">
            <td className="py-1 pr-2 font-mono">{codigoHoja(f)}</td>
            <td className="py-1 pr-2 uppercase">{f.descripcion}</td>
            <td className="py-1 pr-2 text-right">{f.cantidad}</td>
            <td className="py-1 pr-2 text-right">{pesos(f.valor_unitario)}</td>
            <td className="py-1 text-right">{pesos(f.total)}</td>
          </tr>
        ))}
        {filas.length === 0 && (
          <tr>
            <td colSpan={5} className="py-2 text-center text-gray-500">
              —
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-black font-bold">
          <td colSpan={4} className="py-1 pr-2 text-right uppercase">
            {etiquetaTotal}
          </td>
          <td className="py-1 text-right">{pesos(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Hoja({ titulo, children, clave, solo, enc }: { titulo: string; children: React.ReactNode; clave: string; solo: string; enc: Encabezamiento }) {
  if (solo && solo !== clave) return null;
  return (
    <section className="mb-8 break-after-page print:mb-0">
      <header className="mb-3 border-b-2 border-black pb-2">
        <p className="text-xs uppercase tracking-wide">{enc.negocio}</p>
        <h2 className="text-xl font-bold uppercase">{titulo}</h2>
        <p className="text-sm">
          {enc.contacto.nombre}
          {enc.contacto.telefono ? ` · ${enc.contacto.telefono}` : ""} · Consignación {numeroDocumento("C", enc.numero)} · entregada el {fecha(enc.fechaEntrega)} · impreso el {enc.hoy}
        </p>
      </header>
      {children}
    </section>
  );
}

/**
 * Las hojas de la consignación, con la misma estructura que las de papel:
 * RELACIÓN DE ENTREGA, VENTAS, DEVOLUCIONES (por bloques) y PENDIENTE DE PAGO.
 * Cada hoja empieza en página nueva al imprimir.
 */
export default async function HojasConsignacion({ params, searchParams }: PageProps<"/imprimir/consignaciones/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const solo = typeof sp.hoja === "string" ? sp.hoja : "";
  const supabase = await clienteServidor();
  const [{ data: c }, { data: lineas }, { data: cuenta }, { data: ajustes }, recibo] = await Promise.all([
    supabase.from("consignaciones").select("*, contactos(nombre, telefono)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("consignacion_lineas").select("*, productos(codigo, nombre, categoria, material, precio_base)").eq("consignacion_id", id).order("creado_en"),
    supabase.from("cuentas_por_cobrar").select("saldo, abonado, valor_total").eq("origen_tipo", "consignacion").eq("origen_id", id).maybeSingle(),
    supabase.from("ajustes").select("nombre_negocio, etiqueta_mostrar_precio_miles").eq("id", 1).single(),
    cargarRecibo(supabase, id),
  ]);
  if (!c) notFound();
  const contacto = c.contactos as unknown as { nombre: string; telefono: string };
  const filas = (lineas ?? []).map((l) => {
    const p = l.productos as unknown as { codigo: string; nombre: string; categoria: CategoriaProducto; material: string; precio_base: number };
    return { ...l, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, material: p.material };
  });
  const h = hojasConsignacion(filas);
  const conMiles = ajustes?.etiqueta_mostrar_precio_miles ?? true;
  const hoy = fecha(`${hoyIso()}T12:00:00-05:00`);

  const enc: Encabezamiento = { negocio: ajustes?.nombre_negocio ?? "", contacto, numero: c.numero, fechaEntrega: c.fecha_entrega, hoy };

  return (
    <div>
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/consignaciones/${id}`} className="font-semibold text-primario">
          ← Volver a la consignación
        </Link>
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Todas"],
            ["entrega", "Recibo de entrega"],
            ["ventas", "Ventas"],
            ["devoluciones", "Devoluciones"],
            ["pendiente", "Pendiente"],
          ].map(([v, t]) => (
            <Link key={v} href={v ? `/imprimir/consignaciones/${id}?hoja=${v}` : `/imprimir/consignaciones/${id}`} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${solo === v ? "border-primario bg-primario-claro" : "border-gray-300"}`}>
              {t}
            </Link>
          ))}
          {recibo && <BotonesPdfRecibo datos={recibo.datos} />}
          <BotonImprimir />
        </div>
      </div>

      {/* Recibo de entrega: datos del negocio y de quien recibe, piezas, condiciones y firmas. */}
      {(!solo || solo === "entrega") && recibo && (
        <section className="mb-8 break-after-page print:mb-0">
          <ReciboConsignacion datos={recibo.datos} />
        </section>
      )}

      <Hoja titulo="Ventas" clave="ventas" solo={solo} enc={enc}>
        <Tabla filas={h.ventas.filas} total={h.ventas.total} etiquetaTotal={`Total vendido a ${hoy}`} conMiles={conMiles} />
        {cuenta && (
          <p className="mt-3 text-sm">
            Abonado: {pesos(cuenta.abonado)} · <strong>Saldo por pagar: {pesos(cuenta.saldo)}</strong>
          </p>
        )}
      </Hoja>

      <Hoja titulo="Devoluciones" clave="devoluciones" solo={solo} enc={enc}>
        {h.devoluciones.bloques.map((b) => (
          <div key={b.titulo} className="mb-4">
            <h3 className="mb-1 font-bold uppercase">{b.titulo}</h3>
            <Tabla filas={b.filas} total={b.total} etiquetaTotal={`Total ${b.titulo}`} conMiles={conMiles} />
          </div>
        ))}
        {h.devoluciones.bloques.length === 0 && <p className="text-gray-500">Sin devoluciones.</p>}
        <p className="mt-2 text-right text-base font-bold uppercase">Total general devuelto: {pesos(h.devoluciones.total)}</p>
      </Hoja>

      <Hoja titulo="Pendiente de pago" clave="pendiente" solo={solo} enc={enc}>
        <Tabla filas={h.pendientes.filas} total={h.pendientes.total} etiquetaTotal="Total pendiente" conMiles={conMiles} />
        <p className="mt-2 text-sm text-gray-600">Piezas entregadas que aún no se han vendido ni devuelto.</p>
      </Hoja>
    </div>
  );
}
