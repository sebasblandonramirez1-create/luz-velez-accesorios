import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio } from "@/components/ui";
import { fecha, pesos } from "@/lib/formato";
import { MEDIOS_PAGO } from "@/lib/tipos";

export const metadata = { title: "Compras" };

export default async function PaginaCompras({ searchParams }: PageProps<"/compras">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const supabase = await clienteServidor();
  const { data: compras } = await supabase
    .from("compras")
    .select("id, numero, fecha, total, medio_pago, nota, contactos(nombre), compra_lineas(cantidad)")
    .is("eliminado_en", null)
    .order("fecha", { ascending: false })
    .limit(200);

  return (
    <div>
      <Encabezado titulo="Compras de mercancía" subtitulo="Cada compra entra al inventario y actualiza el costo de las piezas." acciones={<BotonEnlace href="/compras/nueva">➕ Registrar compra</BotonEnlace>} />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      {!compras?.length ? (
        <EstadoVacio titulo="Todavía no hay compras" texto="Registra la mercancía que compras: productos, cantidades y costo unitario." accion={<BotonEnlace href="/compras/nueva">Registrar compra</BotonEnlace>} />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {compras.map((c) => {
            const prov = c.contactos as unknown as { nombre: string } | null;
            const piezas = (c.compra_lineas as unknown as { cantidad: number }[]).reduce((s, l) => s + l.cantidad, 0);
            return (
              <li key={c.id}>
                <Link href={`/compras/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-fondo">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      CP-{String(c.numero).padStart(4, "0")} · {prov?.nombre ?? "Sin proveedor"}
                    </span>
                    <span className="block text-sm text-texto-suave">
                      {fecha(c.fecha)} · {piezas} piezas · {MEDIOS_PAGO[c.medio_pago]}
                      {c.nota ? ` · ${c.nota}` : ""}
                    </span>
                  </span>
                  <span className="text-lg font-bold">{pesos(c.total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
