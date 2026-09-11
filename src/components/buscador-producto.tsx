"use client";

import { useMemo, useState } from "react";
import { MiniaturaProducto } from "./miniatura";

export interface ProductoBuscable {
  id: string;
  codigo: string;
  nombre: string;
  stock_actual: number;
  miniatura: string | null;
}

/**
 * Buscador de producto por código o nombre, con cuadrícula de fotos.
 * Reutilizable en movimientos, ventas y consignaciones.
 */
export function BuscadorProducto({
  productos,
  seleccionado,
  onSeleccionar,
}: {
  productos: ProductoBuscable[];
  seleccionado: string;
  onSeleccionar: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const actual = productos.find((p) => p.id === seleccionado);

  const resultados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return productos.slice(0, 24);
    return productos.filter((p) => p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)).slice(0, 24);
  }, [productos, texto]);

  if (actual) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primario bg-primario-claro p-3">
        <MiniaturaProducto ruta={actual.miniatura} nombre={actual.nombre} tamano={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{actual.nombre}</span>
          <span className="block text-sm text-texto-suave">
            {actual.codigo} · {actual.stock_actual} en stock
          </span>
        </span>
        <button type="button" onClick={() => onSeleccionar("")} className="min-h-10 rounded-lg px-3 font-semibold text-primario">
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        className="campo"
        placeholder="Buscar por código o nombre"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoComplete="off"
        autoFocus
      />
      {resultados.length === 0 ? (
        <p className="text-texto-suave">No hay productos que coincidan.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSeleccionar(p.id)}
                className="flex w-full flex-col items-center gap-1 rounded-xl border border-borde bg-superficie p-2 text-center hover:border-primario hover:bg-primario-claro"
              >
                <MiniaturaProducto ruta={p.miniatura} nombre={p.nombre} tamano={72} />
                <span className="w-full truncate text-xs font-semibold">{p.codigo}</span>
                <span className="w-full truncate text-xs text-texto-suave">{p.nombre}</span>
                <span className={`text-xs ${p.stock_actual === 0 ? "text-peligro" : "text-texto-suave"}`}>{p.stock_actual} en stock</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
