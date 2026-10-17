"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Etiqueta } from "@/components/ui";
import { MiniaturaProducto } from "@/components/miniatura";
import { fecha, pesos } from "@/lib/formato";
import { CLAVE_SELECCION_PRODUCTOS } from "@/lib/entradas";

export interface ProductoEnLista {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  clasificacion: string | null;
  material: string;
  color: string;
  precio_base: number;
  precio_publico: number;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  creado_en: string;
  miniatura: string | null;
}

type Seleccion = Record<string, { codigo: string; nombre: string }>;

function leerSeleccion(): Seleccion {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SELECCION_PRODUCTOS) ?? "{}") as Seleccion;
  } catch {
    return {};
  }
}

/**
 * Lista de productos con selección múltiple. La selección se guarda en el
 * navegador, así que se puede ir cambiando de filtros y sumar productos de
 * distintos criterios antes de ingresarlos al stock.
 */
export function ListaProductos({ productos }: { productos: ProductoEnLista[] }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Seleccion>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la selección vive en el navegador y solo se lee al montar
    setSeleccion(leerSeleccion());
  }, []);

  function guardar(nueva: Seleccion) {
    setSeleccion(nueva);
    try {
      localStorage.setItem(CLAVE_SELECCION_PRODUCTOS, JSON.stringify(nueva));
    } catch {
      // sin almacenamiento: la selección dura mientras la página esté abierta
    }
  }
  function alternar(p: ProductoEnLista) {
    const nueva = { ...seleccion };
    if (nueva[p.id]) delete nueva[p.id];
    else nueva[p.id] = { codigo: p.codigo, nombre: p.nombre };
    guardar(nueva);
  }
  function seleccionarLista() {
    const nueva = { ...seleccion };
    for (const p of productos) nueva[p.id] = { codigo: p.codigo, nombre: p.nombre };
    guardar(nueva);
  }
  function quitarLista() {
    const nueva = { ...seleccion };
    for (const p of productos) delete nueva[p.id];
    guardar(nueva);
  }

  const ids = Object.keys(seleccion);
  const enLista = productos.filter((p) => seleccion[p.id]).length;
  const todosEnLista = productos.length > 0 && enLista === productos.length;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={todosEnLista ? quitarLista : seleccionarLista} className="min-h-10 rounded-lg border border-borde bg-superficie px-3 font-semibold hover:bg-primario-claro">
          {todosEnLista ? `Quitar los ${productos.length} de la lista` : `Seleccionar los ${productos.length} de la lista`}
        </button>
        {ids.length > 0 && (
          <span className="text-texto-suave">
            {ids.length} {ids.length === 1 ? "seleccionado" : "seleccionados"}
            {ids.length !== enLista ? ` (${enLista} en esta lista)` : ""}
          </span>
        )}
      </div>

      <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
        {productos.map((prod) => {
          const bajo = prod.stock_actual <= prod.stock_minimo;
          const marcado = Boolean(seleccion[prod.id]);
          return (
            <li key={prod.id} className={`flex items-center gap-2 pl-3 ${marcado ? "bg-acento-claro/60" : ""}`}>
              <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--acento)]" checked={marcado} onChange={() => alternar(prod)} aria-label={`Seleccionar ${prod.codigo}`} />
              <Link href={`/productos/${prod.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3 hover:bg-fondo">
                <MiniaturaProducto ruta={prod.miniatura} nombre={prod.nombre} tamano={60} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{prod.nombre}</span>
                    {!prod.activo && <Etiqueta>Descontinuado</Etiqueta>}
                  </span>
                  <span className="block text-sm text-texto-suave">
                    {prod.clasificacion ? <strong className="mr-1 rounded bg-primario-claro px-1 text-primario-oscuro">{prod.clasificacion}</strong> : <span className="mr-1 rounded bg-alerta-claro px-1 text-xs font-semibold text-alerta">Sin clasificar</span>}
                    {prod.codigo} · {prod.categoria}
                    {prod.material ? ` · ${prod.material}` : ""}
                    {prod.color ? ` · ${prod.color}` : ""}
                  </span>
                  <span className="block text-sm">
                    Público <strong>{pesos(prod.precio_publico)}</strong> · Base {pesos(prod.precio_base)} · <span className="text-texto-suave">creado el {fecha(prod.creado_en)}</span>
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

      {ids.length > 0 && (
        <div className="no-imprimir sticky bottom-20 z-10 mt-4 rounded-2xl border border-acento bg-superficie p-3 shadow-lg md:bottom-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto font-semibold">
              {ids.length} {ids.length === 1 ? "producto seleccionado" : "productos seleccionados"}
            </span>
            <button type="button" onClick={() => router.push("/inventario/entrada")} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-acento px-5 font-semibold text-white shadow-sm">
              ⇧ Ingresar al stock
            </button>
            <button type="button" onClick={() => guardar({})} className="min-h-12 rounded-xl border border-borde bg-superficie px-4 font-semibold hover:bg-primario-claro">
              Quitar selección
            </button>
          </div>
        </div>
      )}
    </>
  );
}
