import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { MiniaturaProducto } from "@/components/miniatura";
import { pesos } from "@/lib/formato";
import { CATEGORIAS, type CategoriaProducto } from "@/lib/tipos";
import { Filtros } from "./filtros";

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
  const filtro = typeof p.filtro === "string" ? p.filtro : "";
  const orden = typeof p.orden === "string" && ORDENES[p.orden] ? p.orden : "codigo";
  const aviso = typeof p.aviso === "string" ? p.aviso : null;

  const supabase = await clienteServidor();

  let consulta = supabase
    .from("productos")
    .select("id, codigo, nombre, categoria, material, color, precio_base, precio_publico, stock_actual, stock_minimo, activo, producto_fotos(ruta_miniatura, principal)")
    .is("eliminado_en", null);

  if (filtro === "descontinuados") consulta = consulta.eq("activo", false);
  else if (filtro !== "todos") consulta = consulta.eq("activo", true);
  if (categoria && categoria in CATEGORIAS) consulta = consulta.eq("categoria", categoria as CategoriaProducto);
  if (q) {
    const patron = `%${q.replace(/[%_]/g, "")}%`;
    consulta = consulta.or(`codigo.ilike.${patron},nombre.ilike.${patron},material.ilike.${patron},color.ilike.${patron},subcategoria.ilike.${patron}`);
  }
  consulta = consulta.order(ORDENES[orden].columna, { ascending: ORDENES[orden].ascendente }).limit(500);

  const { data, error } = await consulta;
  let productos = data ?? [];

  if (filtro === "stock_bajo") productos = productos.filter((x) => x.stock_actual <= x.stock_minimo);
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

      <Filtros q={q} categoria={categoria} filtro={filtro} orden={orden} />

      {productos.length === 0 ? (
        <EstadoVacio
          titulo={q || categoria || filtro ? "Nada coincide con la búsqueda" : "Todavía no hay productos"}
          texto={q || categoria || filtro ? "Prueba con otra palabra o quita los filtros." : "Añade el primero con el botón de arriba o importa tu catálogo desde Excel."}
          accion={!q && !categoria && !filtro ? <BotonEnlace href="/productos/nuevo">Añadir producto</BotonEnlace> : undefined}
        />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {productos.map((prod) => {
            const foto = prod.producto_fotos?.find((f) => f.principal) ?? prod.producto_fotos?.[0];
            const bajo = prod.stock_actual <= prod.stock_minimo;
            return (
              <li key={prod.id}>
                <Link href={`/productos/${prod.id}`} className="flex items-center gap-3 p-3 hover:bg-fondo">
                  <MiniaturaProducto ruta={foto?.ruta_miniatura} nombre={prod.nombre} tamano={60} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{prod.nombre}</span>
                      {!prod.activo && <Etiqueta>Descontinuado</Etiqueta>}
                    </span>
                    <span className="block text-sm text-texto-suave">
                      {prod.codigo} · {CATEGORIAS[prod.categoria]}
                      {prod.material ? ` · ${prod.material}` : ""}
                      {prod.color ? ` · ${prod.color}` : ""}
                    </span>
                    <span className="block text-sm">
                      Público <strong>{pesos(prod.precio_publico)}</strong> · Base {pesos(prod.precio_base)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block text-xl font-bold ${prod.stock_actual === 0 ? "text-peligro" : bajo ? "text-alerta" : ""}`}>{prod.stock_actual}</span>
                    <span className="block text-xs text-texto-suave">en stock</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
