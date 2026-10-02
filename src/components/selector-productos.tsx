"use client";

import { useMemo, useState } from "react";
import { MiniaturaProducto } from "./miniatura";
import { pesos } from "@/lib/formato";
import { facetas, filtrarProductos, filtrosActivos, FILTROS_INICIALES, ORDENES_PRODUCTOS, type FiltrosProductos, type OrdenProductos, type ProductoFiltrable } from "@/lib/filtros-productos";
import type { CategoriaProducto } from "@/lib/tipos";

type Vista = "cuadricula" | "lista";

function Contador({ p, cantidad, onCambiar, compacto = false }: { p: ProductoFiltrable; cantidad: number; onCambiar: (id: string, cantidad: number) => void; compacto?: boolean }) {
  const lleno = cantidad >= p.stock_actual;
  const boton = `flex items-center justify-center rounded-full border border-borde bg-superficie text-xl font-bold leading-none disabled:opacity-40 ${compacto ? "h-9 w-9" : "h-10 w-10"}`;
  if (cantidad === 0) {
    return (
      <button type="button" onClick={() => onCambiar(p.id, 1)} disabled={p.stock_actual <= 0} className={`min-h-10 rounded-full bg-acento px-4 text-sm font-bold text-white disabled:bg-borde disabled:text-texto-suave ${compacto ? "" : "w-full"}`} aria-label={`Añadir ${p.codigo}`}>
        {p.stock_actual <= 0 ? "Sin stock" : "Añadir"}
      </button>
    );
  }
  return (
    <span className={`flex items-center gap-1 ${compacto ? "" : "w-full justify-between"}`}>
      <button type="button" className={boton} onClick={() => onCambiar(p.id, cantidad - 1)} aria-label={`Quitar una unidad de ${p.codigo}`}>
        −
      </button>
      <span className="min-w-8 text-center text-lg font-bold" aria-live="polite" aria-label={`${cantidad} en la entrega`}>
        {cantidad}
      </span>
      <button type="button" className={boton} onClick={() => onCambiar(p.id, cantidad + 1)} disabled={lleno} aria-label={`Añadir una unidad de ${p.codigo}`}>
        +
      </button>
    </span>
  );
}

/**
 * Buscador de productos para armar una entrega: texto libre, pestañas por
 * categoría, filtros de material y color, existencias, orden, vista en
 * cuadrícula o lista, y una lista con barra de desplazamiento que muestra
 * todos los resultados. Cada producto se añade o se ajusta sin salir de la lista.
 */
export function SelectorProductos({
  productos,
  cantidades,
  onCambiar,
}: {
  productos: ProductoFiltrable[];
  cantidades: Record<string, number>;
  onCambiar: (id: string, cantidad: number) => void;
}) {
  const [f, setF] = useState<FiltrosProductos>(FILTROS_INICIALES);
  const [vista, setVista] = useState<Vista>("cuadricula");
  const [masFiltros, setMasFiltros] = useState(false);

  const opciones = useMemo(() => facetas(productos), [productos]);
  const anadidos = useMemo(() => new Set(Object.keys(cantidades).filter((id) => cantidades[id] > 0)), [cantidades]);
  const resultados = useMemo(() => filtrarProductos(productos, f, anadidos), [productos, f, anadidos]);
  const activos = filtrosActivos(f);
  const cambiar = (cambios: Partial<FiltrosProductos>) => setF((x) => ({ ...x, ...cambios }));

  const pestana = (activa: boolean) =>
    `shrink-0 rounded-full border px-4 min-h-10 text-sm font-semibold whitespace-nowrap ${activa ? "border-primario bg-primario text-white" : "border-borde bg-superficie text-texto hover:bg-primario-claro"}`;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          className="campo flex-1"
          placeholder="Buscar por código, nombre, material o color"
          value={f.texto}
          onChange={(e) => cambiar({ texto: e.target.value })}
          autoComplete="off"
          aria-label="Buscar producto"
        />
        <button type="button" onClick={() => setMasFiltros((v) => !v)} aria-expanded={masFiltros} className={`min-h-12 shrink-0 rounded-xl border px-4 font-semibold ${masFiltros || f.material || f.color || f.orden !== "codigo" ? "border-primario bg-primario-claro text-primario-oscuro" : "border-borde bg-superficie"}`}>
          Filtros
        </button>
      </div>

      {/* Categorías: fila que se desliza hacia los lados. */}
      <div className="desplazable-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Categoría">
        <button type="button" className={pestana(f.categoria === "")} aria-pressed={f.categoria === ""} onClick={() => cambiar({ categoria: "" })}>
          Todas ({productos.length})
        </button>
        {opciones.categorias.map((c) => (
          <button key={c.valor} type="button" className={pestana(f.categoria === c.valor)} aria-pressed={f.categoria === c.valor} onClick={() => cambiar({ categoria: f.categoria === c.valor ? "" : (c.valor as CategoriaProducto) })}>
            {c.etiqueta} ({c.cantidad})
          </button>
        ))}
      </div>

      {masFiltros && (
        <div className="grid gap-3 rounded-xl border border-borde bg-fondo p-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Material</span>
            <select className="campo" value={f.material} onChange={(e) => cambiar({ material: e.target.value })}>
              <option value="">Todos</option>
              {opciones.materiales.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Color</span>
            <select className="campo" value={f.color} onChange={(e) => cambiar({ color: e.target.value })}>
              <option value="">Todos</option>
              {opciones.colores.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Ordenar por</span>
            <select className="campo" value={f.orden} onChange={(e) => cambiar({ orden: e.target.value as OrdenProductos })}>
              {Object.entries(ORDENES_PRODUCTOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primario)]" checked={f.soloConStock} onChange={(e) => cambiar({ soloConStock: e.target.checked })} />
          Solo con existencias
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primario)]" checked={f.soloAnadidos} onChange={(e) => cambiar({ soloAnadidos: e.target.checked })} />
          Solo lo añadido ({anadidos.size})
        </label>
        <span className="ml-auto flex items-center gap-1" role="group" aria-label="Vista">
          {(["cuadricula", "lista"] as Vista[]).map((v) => (
            <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v} className={`min-h-10 rounded-lg border px-3 font-semibold ${vista === v ? "border-primario bg-primario-claro text-primario-oscuro" : "border-borde bg-superficie"}`}>
              {v === "cuadricula" ? "Fotos" : "Lista"}
            </button>
          ))}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm text-texto-suave">
        <span aria-live="polite">
          {resultados.length} {resultados.length === 1 ? "producto" : "productos"}
        </span>
        {activos > 0 && (
          <button type="button" onClick={() => setF(FILTROS_INICIALES)} className="min-h-10 font-semibold text-primario underline-offset-2 hover:underline">
            Limpiar filtros ({activos})
          </button>
        )}
      </div>

      {/* Lista con barra de desplazamiento propia: muestra todos los resultados. */}
      <div className="desplazable max-h-[min(28rem,55vh)] overflow-y-scroll rounded-xl border border-borde bg-fondo p-2" tabIndex={0} aria-label="Productos disponibles">
        {resultados.length === 0 ? (
          <p className="p-6 text-center text-texto-suave">No hay productos con esos filtros.</p>
        ) : vista === "cuadricula" ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {resultados.map((p) => {
              const cantidad = cantidades[p.id] ?? 0;
              return (
                <li key={p.id} className={`flex flex-col items-center gap-1 rounded-xl border bg-superficie p-2 text-center ${cantidad > 0 ? "border-acento ring-2 ring-acento/40" : "border-borde"}`}>
                  <button type="button" onClick={() => cantidad < p.stock_actual && onCambiar(p.id, cantidad + 1)} disabled={p.stock_actual <= 0} className="flex w-full flex-col items-center gap-1" aria-label={`Añadir ${p.nombre} (${p.codigo})`}>
                    <MiniaturaProducto ruta={p.miniatura} nombre={p.nombre} tamano={88} />
                    <span className="w-full truncate text-xs font-bold">{p.codigo}</span>
                    <span className="line-clamp-2 min-h-8 w-full text-xs leading-tight text-texto-suave">{p.nombre}</span>
                    <span className="text-sm font-semibold">$ {pesos(p.precio_base)}</span>
                    <span className={`text-xs ${p.stock_actual <= 0 ? "text-peligro" : "text-texto-suave"}`}>{p.stock_actual} en stock</span>
                  </button>
                  <Contador p={p} cantidad={cantidad} onCambiar={onCambiar} />
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-borde rounded-lg bg-superficie">
            {resultados.map((p) => {
              const cantidad = cantidades[p.id] ?? 0;
              return (
                <li key={p.id} className={`flex items-center gap-3 p-2 ${cantidad > 0 ? "bg-acento-claro" : ""}`}>
                  <MiniaturaProducto ruta={p.miniatura} nombre={p.nombre} tamano={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.nombre}</span>
                    <span className="block truncate text-sm text-texto-suave">
                      {p.codigo}
                      {p.material ? ` · ${p.material}` : ""}
                      {p.color ? ` · ${p.color}` : ""}
                    </span>
                    <span className="block text-sm">
                      $ {pesos(p.precio_base)} · <span className={p.stock_actual <= 0 ? "text-peligro" : "text-texto-suave"}>{p.stock_actual} en stock</span>
                    </span>
                  </span>
                  <Contador p={p} cantidad={cantidad} onCambiar={onCambiar} compacto />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
