import { notFound, redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { fechaHora, pesos } from "@/lib/formato";
import { MEDIOS_PAGO } from "@/lib/tipos";
import { enviarCompraAPapelera } from "../acciones";

export default async function PaginaCompra({ params, searchParams }: PageProps<"/compras/[id]">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const nueva = sp.nueva === "1";
  const error = typeof sp.error === "string" ? sp.error : null;
  const supabase = await clienteServidor();
  const [{ data: compra }, { data: lineas }] = await Promise.all([
    supabase.from("compras").select("*, contactos(nombre)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("compra_lineas").select("*, productos(codigo, nombre)").eq("compra_id", id).order("creado_en"),
  ]);
  if (!compra) notFound();
  const prov = compra.contactos as unknown as { nombre: string } | null;

  return (
    <div className="space-y-4">
      <Encabezado titulo={`Compra CP-${String(compra.numero).padStart(4, "0")}`} subtitulo={`${fechaHora(compra.fecha)} · ${prov?.nombre ?? "Sin proveedor"} · ${MEDIOS_PAGO[compra.medio_pago]}`} volver="/compras" />
      {nueva && <Aviso tipo="exito">Compra registrada: las piezas entraron al inventario, el costo de compra quedó actualizado y el gasto de mercancía se anotó solo.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Tarjeta titulo="Productos">
        <ul className="divide-y divide-borde">
          {(lineas ?? []).map((l) => {
            const p = l.productos as unknown as { codigo: string; nombre: string };
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block font-semibold">
                    {l.cantidad} × {p.nombre}
                  </span>
                  <span className="block text-sm text-texto-suave">
                    {p.codigo} · {pesos(l.costo_unitario)} c/u
                  </span>
                </span>
                <span className="font-bold">{pesos(l.subtotal)}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex justify-between border-t border-borde pt-3 text-xl font-bold">
          <span>Total</span>
          <span>{pesos(compra.total)}</span>
        </p>
        {compra.nota && <p className="mt-2 text-sm text-texto-suave">Nota: {compra.nota}</p>}
      </Tarjeta>
      <div className="flex justify-end">
        <BotonConfirmar accion={enviarCompraAPapelera} campos={{ id: compra.id }} titulo="¿Anular esta compra?" texto="Las piezas salen del inventario y el gasto se anula. Solo es posible si no se ha vendido ni entregado nada de esta compra." confirmar="Sí, anular la compra">
          Anular compra
        </BotonConfirmar>
      </div>
    </div>
  );
}
