import { notFound, redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado } from "@/components/ui";
import { fecha } from "@/lib/formato";
import { numeroDocumento } from "@/lib/ventas";
import type { CategoriaProducto } from "@/lib/tipos";
import type { ProductoFiltrable } from "@/lib/filtros-productos";
import { FormularioModificar, type LineaEditable } from "./formulario-modificar";

export const metadata = { title: "Modificar entrega en consignación" };

type ProductoDeLinea = { codigo: string; nombre: string; categoria: CategoriaProducto; material: string; color: string; stock_actual: number; precio_base: number; producto_fotos: { ruta_miniatura: string; principal: boolean }[] | null };

const miniaturaDe = (fotos: { ruta_miniatura: string; principal: boolean }[] | null | undefined) => fotos?.find((f) => f.principal)?.ruta_miniatura ?? fotos?.[0]?.ruta_miniatura ?? null;

/**
 * Modificar una entrega sin liquidarla: añadir o retirar piezas, cambiar
 * cantidades, valores, la fecha límite y la nota. Cada cambio queda en el
 * historial de la consignación.
 */
export default async function PaginaModificarConsignacion({ params }: PageProps<"/consignaciones/[id]/modificar">) {
  const { id } = await params;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();
  const [{ data: c }, { data: lineas }, { data: productos }, { data: recibo }] = await Promise.all([
    supabase.from("consignaciones").select("id, numero, estado, fecha_entrega, fecha_limite, nota, contactos(nombre)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase
      .from("consignacion_lineas")
      .select("producto_id, cantidad_entregada, cantidad_vendida, cantidad_devuelta, valor_unitario, creado_en, productos(codigo, nombre, categoria, material, color, stock_actual, precio_base, producto_fotos(ruta_miniatura, principal))")
      .eq("consignacion_id", id)
      .order("creado_en"),
    supabase
      .from("productos")
      .select("id, codigo, nombre, categoria, material, color, stock_actual, precio_base, producto_fotos(ruta_miniatura, principal)")
      .is("eliminado_en", null)
      .eq("activo", true)
      .order("codigo"),
    supabase.from("consignacion_recibos").select("firmado_en, receptor_nombre, token_vence").eq("consignacion_id", id).maybeSingle(),
  ]);
  if (!c) notFound();
  if (c.estado === "cerrada") redirect(`/consignaciones/${id}?error=${encodeURIComponent("Esta entrega ya está cerrada y no se puede modificar. Si se lleva más mercancía, crea una entrega nueva.")}`);

  const contacto = c.contactos as unknown as { nombre: string };
  const esPropietaria = sesion.perfil.rol === "propietaria";
  const firmado = Boolean(recibo?.firmado_en);
  const titulo = `Modificar ${numeroDocumento("C", c.numero)}`;
  const volver = `/consignaciones/${id}`;

  if (firmado && !esPropietaria) {
    return (
      <div className="space-y-4">
        <Encabezado titulo={titulo} subtitulo={contacto.nombre} volver={volver} />
        <Aviso tipo="alerta">El recibo de esta entrega ya está firmado por {recibo?.receptor_nombre || "quien la recibió"}. Solo la propietaria puede modificarla, porque al hacerlo la firma se anula.</Aviso>
        <BotonEnlace href={volver} variante="secundario">
          Volver a la consignación
        </BotonEnlace>
      </div>
    );
  }

  // Lo que ya está en la entrega no figura en el stock: para esta entrega está disponible.
  const entregado = new Map((lineas ?? []).map((l) => [l.producto_id, l.cantidad_entregada]));
  const catalogo = new Map<string, ProductoFiltrable>();
  for (const p of productos ?? []) {
    catalogo.set(p.id, { id: p.id, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, material: p.material, color: p.color, precio_base: p.precio_base, stock_actual: p.stock_actual + (entregado.get(p.id) ?? 0), miniatura: miniaturaDe(p.producto_fotos) });
  }
  const iniciales: LineaEditable[] = (lineas ?? []).map((l) => {
    const p = l.productos as unknown as ProductoDeLinea;
    const maximo = p.stock_actual + l.cantidad_entregada;
    // Un producto desactivado que ya está en la entrega también debe poder ajustarse.
    if (!catalogo.has(l.producto_id)) {
      catalogo.set(l.producto_id, { id: l.producto_id, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, material: p.material, color: p.color, precio_base: p.precio_base, stock_actual: maximo, miniatura: miniaturaDe(p.producto_fotos) });
    }
    return {
      producto_id: l.producto_id,
      codigo: p.codigo,
      nombre: p.nombre,
      cantidad: l.cantidad_entregada,
      valor_unitario: l.valor_unitario,
      maximo,
      minimo: l.cantidad_vendida + l.cantidad_devuelta,
      vendida: l.cantidad_vendida,
      devuelta: l.cantidad_devuelta,
    };
  });

  return (
    <div>
      <Encabezado titulo={titulo} subtitulo={`${contacto.nombre} · entregada el ${fecha(c.fecha_entrega)}. Añade o retira piezas sin liquidar; cada cambio queda en el historial.`} volver={volver} />
      <FormularioModificar
        consignacionId={c.id}
        productos={[...catalogo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }))}
        lineasIniciales={iniciales}
        fechaEntrega={new Date(c.fecha_entrega).toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}
        fechaLimiteInicial={c.fecha_limite}
        notaInicial={c.nota}
        firmadoPor={firmado ? recibo?.receptor_nombre || "quien la recibió" : null}
        enlacePendiente={Boolean(recibo && !recibo.firmado_en && new Date(recibo.token_vence) > new Date())}
      />
    </div>
  );
}
