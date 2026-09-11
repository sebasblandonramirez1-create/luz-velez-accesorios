"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIAS } from "@/lib/tipos";

export function Filtros({ q, categoria, filtro, orden }: { q: string; categoria: string; filtro: string; orden: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);

  function navegar(cambios: Record<string, string>) {
    const params = new URLSearchParams({ q, categoria, filtro, orden, ...cambios });
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
    router.replace(`/productos?${params.toString()}`);
  }

  // Busca mientras se escribe, con una pequeña espera.
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => navegar({ q: texto }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="mb-4 space-y-2">
      <label className="block">
        <span className="sr-only">Buscar</span>
        <input
          type="search"
          className="campo"
          placeholder="Buscar por código, nombre, material o color"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <select aria-label="Categoría" className="campo w-auto min-w-36" value={categoria} onChange={(e) => navegar({ categoria: e.target.value })}>
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Filtro" className="campo w-auto min-w-36" value={filtro} onChange={(e) => navegar({ filtro: e.target.value })}>
          <option value="">Activos</option>
          <option value="stock_bajo">Stock bajo</option>
          <option value="sin_movimiento">Sin movimiento (90 días)</option>
          <option value="descontinuados">Descontinuados</option>
          <option value="todos">Todos</option>
        </select>
        <select aria-label="Orden" className="campo w-auto min-w-36" value={orden} onChange={(e) => navegar({ orden: e.target.value })}>
          <option value="codigo">Por código</option>
          <option value="nombre">Por nombre</option>
          <option value="stock">Por stock</option>
          <option value="reciente">Más recientes</option>
        </select>
      </div>
    </div>
  );
}
