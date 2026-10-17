"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIAS } from "@/lib/tipos";
import { FILTRO_SIN_CLASIFICAR } from "@/lib/clasificaciones";

export interface ValoresFiltros {
  q: string;
  categoria: string;
  clasificacion: string;
  filtro: string;
  orden: string;
  material: string;
  color: string;
  proveedor: string;
  existencias: string;
  creado_desde: string;
  creado_hasta: string;
}

export interface OpcionesFiltros {
  clasificaciones: { codigo: string; nombre: string; activa: boolean }[];
  materiales: string[];
  colores: string[];
  proveedores: { id: string; nombre: string }[];
}

const VACIOS: ValoresFiltros = { q: "", categoria: "", clasificacion: "", filtro: "", orden: "codigo", material: "", color: "", proveedor: "", existencias: "", creado_desde: "", creado_hasta: "" };

/**
 * Filtros de la lista de productos. Viven en la dirección (?q=…&material=…),
 * así que se pueden compartir y la selección múltiple se conserva al cambiarlos.
 */
export function Filtros({ valores, opciones }: { valores: ValoresFiltros; opciones: OpcionesFiltros }) {
  const router = useRouter();
  const [texto, setTexto] = useState(valores.q);
  const activos = (Object.keys(VACIOS) as (keyof ValoresFiltros)[]).filter((k) => k !== "q" && k !== "orden" && valores[k] !== VACIOS[k]).length + (valores.q ? 1 : 0);
  const [mas, setMas] = useState(activos > 0 && Boolean(valores.material || valores.color || valores.proveedor || valores.existencias || valores.creado_desde || valores.creado_hasta));

  function navegar(cambios: Partial<ValoresFiltros>) {
    const params = new URLSearchParams({ ...valores, ...cambios });
    for (const [k, v] of [...params.entries()]) if (!v || (k === "orden" && v === "codigo")) params.delete(k);
    const cadena = params.toString();
    router.replace(cadena ? `/productos?${cadena}` : "/productos");
  }

  // Busca mientras se escribe, con una pequeña espera.
  useEffect(() => {
    if (texto === valores.q) return;
    const t = setTimeout(() => navegar({ q: texto }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const selectCorto = "campo w-auto min-w-36";

  return (
    <div className="mb-4 space-y-2">
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="sr-only">Buscar</span>
          <input type="search" className="campo" placeholder="Buscar por código, nombre, material, color o subcategoría" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </label>
        <button type="button" onClick={() => setMas((v) => !v)} aria-expanded={mas} className={`min-h-12 shrink-0 rounded-xl border px-4 font-semibold ${mas ? "border-primario bg-primario-claro text-primario-oscuro" : "border-borde bg-superficie"}`}>
          Más filtros
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <select aria-label="Categoría" className={selectCorto} value={valores.categoria} onChange={(e) => navegar({ categoria: e.target.value })}>
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Clasificación" className={selectCorto} value={valores.clasificacion} onChange={(e) => navegar({ clasificacion: e.target.value })}>
          <option value="">Todas las clasificaciones</option>
          {opciones.clasificaciones.map((k) => (
            <option key={k.codigo} value={k.codigo}>
              {k.codigo} · {k.nombre}
              {k.activa ? "" : " (inactiva)"}
            </option>
          ))}
          <option value={FILTRO_SIN_CLASIFICAR}>Sin clasificar</option>
        </select>
        <select aria-label="Estado" className={selectCorto} value={valores.filtro} onChange={(e) => navegar({ filtro: e.target.value })}>
          <option value="">Activos</option>
          <option value="sin_movimiento">Sin movimiento (90 días)</option>
          <option value="descontinuados">Descontinuados</option>
          <option value="todos">Todos</option>
        </select>
        <select aria-label="Orden" className={selectCorto} value={valores.orden} onChange={(e) => navegar({ orden: e.target.value })}>
          <option value="codigo">Por código</option>
          <option value="nombre">Por nombre</option>
          <option value="stock">Por stock</option>
          <option value="reciente">Más recientes</option>
        </select>
      </div>

      {mas && (
        <div className="grid gap-3 rounded-xl border border-borde bg-fondo p-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Existencias</span>
            <select className="campo" value={valores.existencias} onChange={(e) => navegar({ existencias: e.target.value })}>
              <option value="">Todas</option>
              <option value="con">Con existencias</option>
              <option value="sin">Sin existencias (0)</option>
              <option value="bajo">Stock bajo (en el mínimo o menos)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Material o línea</span>
            <select className="campo" value={valores.material} onChange={(e) => navegar({ material: e.target.value })}>
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
            <select className="campo" value={valores.color} onChange={(e) => navegar({ color: e.target.value })}>
              <option value="">Todos</option>
              {opciones.colores.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Proveedor</span>
            <select className="campo" value={valores.proveedor} onChange={(e) => navegar({ proveedor: e.target.value })}>
              <option value="">Todos</option>
              {opciones.proveedores.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.nombre}
                </option>
              ))}
              <option value="sin">Sin proveedor</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Creado desde</span>
            <input type="date" className="campo" value={valores.creado_desde} max={valores.creado_hasta || undefined} onChange={(e) => navegar({ creado_desde: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Creado hasta</span>
            <input type="date" className="campo" value={valores.creado_hasta} min={valores.creado_desde || undefined} onChange={(e) => navegar({ creado_hasta: e.target.value })} />
          </label>
        </div>
      )}

      {activos > 0 && (
        <div className="flex items-center justify-between text-sm text-texto-suave">
          <span>
            {activos} {activos === 1 ? "filtro puesto" : "filtros puestos"}
          </span>
          <button
            type="button"
            onClick={() => {
              setTexto("");
              router.replace("/productos");
            }}
            className="min-h-10 font-semibold text-primario underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
