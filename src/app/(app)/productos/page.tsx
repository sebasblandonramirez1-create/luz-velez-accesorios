import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio } from "@/components/ui";
import { CATEGORIAS, type CategoriaProducto } from "@/lib/tipos";
import { Filtros, type OpcionesFiltros } from "./filtros";
import { ListaProductos } from "./lista-productos";
import { conteoPorClasificacion, FILTRO_SIN_CLASIFICAR } from "@/lib/clasificaciones";

export const metadata = { title: "Productos" };

const ORDENES: Record<string, { columna: string; ascendente: boolean }> = {
  codigo: { columna: "codigo", ascendente: true },
  nombre: { columna: "nombre", ascendente: true },
  stock: { columna: "stock_actual", ascendente: true },
  reciente: { columna: "creado_en", ascendente: false },
};

export default async function PaginaProductos({ searchParams }: PageProps<"/productos">) {
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim() : "";
  const categoria = typeof p.categoria === "string" ? p.categoria : "";
  const clasificacion = typeof p.clasificacion === "string" ? p.clasificacion : "";
  const filtro = typeof p.filtro === "string" ? p.filtro : "";
  const material = typeof p.material === "string" ? p.material : "";
  const color = typeof p.color === "string" ? p.color : "";
  const proveedor = typeof p.proveedor === "string" ? p.proveedor : "";
  const existencias = typeof p.existencias === "string" ? p.existencias : "";
  const dia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const creadoDesde = dia(p.creado_desde);
  const creadoHasta = dia(p.creado_hasta);
  const hayFiltros = Boolean(q || categoria || clasificacion || filtro || material || color || proveedor || existencias || creadoDesde || creadoHasta);
  const orden = typeof p.orden === "string" && ORDENES[p.orden] ? p.orden : "codigo";
  const aviso = typeof p.aviso === "string" ? p.aviso : null;

  const supabase = await clienteServidor();

  let consulta = supabase
    .from("productos")
    .select("id, codigo, nombre, categoria, clasificacion, material, color, precio_base, precio_publico, stock_actual, stock_minimo, activo, creado_en, producto_fotos(ruta_miniatura, principal)")
    .is("eliminado_en", null);

  if (filtro === "descontinuados") consulta = consulta.eq("activo", false);
  else if (filtro !== "todos") consulta = consulta.eq("activo", true);
  if (categoria && categoria in CATEGORIAS) consulta = consulta.eq("categoria", categoria as CategoriaProducto);
  if (clasificacion === FILTRO_SIN_CLASIFICAR) consulta = consulta.is("clasificacion", null);
  else if (clasificacion) consulta = consulta.eq("clasificacion", clasificacion);
  if (material) consulta = consulta.ilike("material", material.replace(/[%_]/g, ""));
  if (color) consulta = consulta.ilike("color", color.replace(/[%_]/g, ""));
  if (proveedor === "sin") consulta = consulta.is("proveedor_id", null);
  else if (/^[0-9a-f-]{36}$/.test(proveedor)) consulta = consulta.eq("proveedor_id", proveedor);
  if (existencias === "sin") consulta = consulta.eq("stock_actual", 0);
  else if (existencias === "con") consulta = consulta.gt("stock_actual", 0);
  // Fechas de creación: días en Bogotá.
  if (creadoDesde) consulta = consulta.gte("creado_en", `${creadoDesde}T00:00:00-05:00`);
  if (creadoHasta) consulta = consulta.lte("creado_en", `${creadoHasta}T23:59:59.999-05:00`);
  if (q) {
    const patron = `%${q.replace(/[%_]/g, "")}%`;
    consulta = consulta.or(`codigo.ilike.${patron},nombre.ilike.${patron},material.ilike.${patron},color.ilike.${patron},subcategoria.ilike.${patron}`);
  }
  consulta = consulta.order(ORDENES[orden].columna, { ascending: ORDENES[orden].ascendente }).limit(500);

  const [{ data, error }, { data: clasificaciones }, { count: sinClasificar }, { data: valores }, { data: proveedores }] = await Promise.all([
    consulta,
    supabase.from("clasificaciones_producto").select("codigo, nombre, activa").order("orden").order("codigo"),
    supabase.from("productos").select("id", { count: "exact", head: true }).is("eliminado_en", null).eq("activo", true).is("clasificacion", null),
    supabase.from("productos").select("material, color").is("eliminado_en", null).limit(2000),
    supabase.from("contactos").select("id, nombre").eq("tipo", "proveedor").is("eliminado_en", null).order("nombre"),
  ]);
  let productos = data ?? [];
  const distintos = (lista: string[]) => {
    const vistos = new Map<string, string>();
    for (const v of lista) {
      const t = v.trim();
      if (t && !vistos.has(t.toLowerCase())) vistos.set(t.toLowerCase(), t);
    }
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"));
  };
  const opciones: OpcionesFiltros = {
    clasificaciones: clasificaciones ?? [],
    materiales: distintos((valores ?? []).map((v) => v.material)),
    colores: distintos((valores ?? []).map((v) => v.color)),
    proveedores: proveedores ?? [],
  };

  if (filtro === "stock_bajo" || existencias === "bajo") productos = productos.filter((x) => x.stock_actual <= x.stock_minimo);
  if (filtro === "sin_movimiento") {
    const { data: sin } = await supabase.from("productos_sin_movimiento").select("id");
    const ids = new Set((sin ?? []).map((x) => x.id));
    productos = productos.filter((x) => ids.has(x.id));
  }

  return (
    <div>
      <Encabezado
        titulo="Productos"
        subtitulo={`${productos.length} ${productos.length === 1 ? "producto" : "productos"}`}
        acciones={
          <>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- es un route handler que descarga un CSV */}
            <a href="/productos/exportar" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-borde bg-superficie px-5 font-semibold hover:bg-primario-claro">
              Exportar
            </a>
            <BotonEnlace href="/productos/importar" variante="secundario">
              Importar
            </BotonEnlace>
            <BotonEnlace href="/productos/nuevo">➕ Añadir</BotonEnlace>
          </>
        }
      />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" className="mb-4">
          No se pudo cargar la lista: {error.message}
        </Aviso>
      )}

      {(sinClasificar ?? 0) > 0 && clasificacion !== FILTRO_SIN_CLASIFICAR && (
        <Aviso tipo="alerta" className="mb-4">
          {sinClasificar} {sinClasificar === 1 ? "producto activo no tiene" : "productos activos no tienen"} clasificación (CP, CM, PL…).{" "}
          <Link href={`/productos?clasificacion=${FILTRO_SIN_CLASIFICAR}`} className="font-semibold underline">
            Ver cuáles
          </Link>{" "}
          y abre cada uno para elegirla.
        </Aviso>
      )}
      <Filtros
        valores={{ q, categoria, clasificacion, filtro, orden, material, color, proveedor, existencias, creado_desde: creadoDesde, creado_hasta: creadoHasta }}
        opciones={opciones}
      />

      {productos.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Nada coincide con los filtros" : "Todavía no hay productos"}
          texto={hayFiltros ? "Prueba con otra palabra o quita los filtros." : "Añade el primero con el botón de arriba o importa tu catálogo desde Excel."}
          accion={!hayFiltros ? <BotonEnlace href="/productos/nuevo">Añadir producto</BotonEnlace> : undefined}
        />
      ) : (
        <ListaProductos
          productos={productos.map((prod) => ({
            id: prod.id,
            codigo: prod.codigo,
            nombre: prod.nombre,
            categoria: CATEGORIAS[prod.categoria],
            clasificacion: prod.clasificacion,
            material: prod.material,
            color: prod.color,
            precio_base: prod.precio_base,
            precio_publico: prod.precio_publico,
            stock_actual: prod.stock_actual,
            stock_minimo: prod.stock_minimo,
            activo: prod.activo,
            creado_en: prod.creado_en,
            miniatura: (prod.producto_fotos?.find((f) => f.principal) ?? prod.producto_fotos?.[0])?.ruta_miniatura ?? null,
          }))}
        />
      )}

      {productos.length > 0 && (
        <section className="mt-4 rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="mb-2 font-bold">Conteo por clasificación</h2>
          <p className="mb-2 text-sm text-texto-suave">De los {productos.length} productos de esta lista.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-texto-suave">
                  <th className="py-1 pr-2">Clas.</th>
                  <th className="py-1 pr-2">Nombre</th>
                  <th className="py-1 pr-2 text-right">Productos</th>
                  <th className="py-1 text-right">Unidades en stock</th>
                </tr>
              </thead>
              <tbody>
                {conteoPorClasificacion(
                  productos.map((x) => ({ codigo: x.codigo, clasificacion: x.clasificacion, cantidad: x.stock_actual })),
                  clasificaciones ?? [],
                ).map((k) => (
                  <tr key={k.codigo ?? "sin"} className="border-b border-borde">
                    <td className="py-1 pr-2 font-mono font-bold">{k.codigo ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {k.codigo ? (
                        k.nombre
                      ) : (
                        <Link href={`/productos?clasificacion=${FILTRO_SIN_CLASIFICAR}`} className="font-semibold text-alerta underline-offset-2 hover:underline">
                          Sin clasificar
                        </Link>
                      )}
                    </td>
                    <td className="py-1 pr-2 text-right">{k.referencias}</td>
                    <td className="py-1 text-right font-semibold">{k.piezas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
