"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Aviso, AreaTexto, Boton, BotonEnlace, Campo, Tarjeta } from "@/components/ui";
import { MiniaturaProducto } from "@/components/miniatura";
import { SelectorProductos } from "@/components/selector-productos";
import { hoyIso, pesos } from "@/lib/formato";
import type { ProductoFiltrable } from "@/lib/filtros-productos";
import { CLAVE_SELECCION_PRODUCTOS, resumenEntrada, TIPOS_ENTRADA, totalesEntrada, validarEntrada, type LineaEntrada, type TipoEntrada } from "@/lib/entradas";
import { registrarEntradas } from "../acciones";

type ProductoEntrada = ProductoFiltrable & { costo: number };

export function FormularioEntrada({ productos }: { productos: ProductoEntrada[] }) {
  const router = useRouter();
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const [lineas, setLineas] = useState<LineaEntrada[]>([]);
  const [listo, setListo] = useState(false);
  const [tipo, setTipo] = useState<TipoEntrada>("entrada_compra");
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState("");
  const [cantidadComun, setCantidadComun] = useState(1);
  const [buscar, setBuscar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // La selección viene de la lista de productos (guardada en el navegador).
  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = Object.keys(JSON.parse(localStorage.getItem(CLAVE_SELECCION_PRODUCTOS) ?? "{}") as Record<string, unknown>);
    } catch {
      ids = [];
    }
    const iniciales = ids
      .map((id) => porId.get(id))
      .filter((p): p is ProductoEntrada => Boolean(p))
      .map((p) => ({ producto_id: p.id, codigo: p.codigo, nombre: p.nombre, stock_actual: p.stock_actual, cantidad: 1, valor_unitario: p.costo }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se carga una sola vez desde el navegador
    setLineas(iniciales);
    setListo(true);
    if (iniciales.length === 0) setBuscar(true);
  }, [porId]);

  const cantidades = Object.fromEntries(lineas.map((l) => [l.producto_id, l.cantidad]));
  const totales = totalesEntrada(lineas);

  function fijarCantidad(id: string, cantidad: number) {
    const p = porId.get(id);
    if (!p) return;
    const n = Math.max(0, Math.trunc(Number.isFinite(cantidad) ? cantidad : 0));
    setLineas((ls) => {
      if (ls.some((l) => l.producto_id === id)) return ls.map((l) => (l.producto_id === id ? { ...l, cantidad: n } : l));
      if (n === 0) return ls;
      return [...ls, { producto_id: p.id, codigo: p.codigo, nombre: p.nombre, stock_actual: p.stock_actual, cantidad: n, valor_unitario: p.costo }];
    });
  }
  function quitar(id: string) {
    setLineas((ls) => ls.filter((l) => l.producto_id !== id));
  }
  function fijarValor(id: string, valor: number) {
    setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, valor_unitario: valor } : l)));
  }

  async function guardar() {
    const problema = validarEntrada(lineas, tipo);
    if (problema) return setError(problema);
    setEnviando(true);
    setError(null);
    let r: { registrados?: number; error?: string };
    try {
      r = await registrarEntradas({ tipo, fecha, nota, lineas: lineas.filter((l) => l.cantidad > 0).map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, valor_unitario: l.valor_unitario })) });
    } catch {
      r = { error: "Sin conexión. No se registró nada; revisa el internet e inténtalo de nuevo." };
    }
    setEnviando(false);
    if (r.error) return setError(r.error);
    try {
      localStorage.removeItem(CLAVE_SELECCION_PRODUCTOS);
    } catch {
      // sin almacenamiento no hay nada que limpiar
    }
    router.push(`/inventario?aviso=${encodeURIComponent(`Entrada registrada: ${resumenEntrada(lineas)}. El stock ya está actualizado.`)}`);
    router.refresh();
  }

  if (!listo) return <p className="text-texto-suave">Cargando la selección…</p>;

  return (
    <div className="space-y-4">
      <Tarjeta titulo={`1. Productos que entran (${lineas.length})`}>
        {lineas.length === 0 && (
          <Aviso tipo="info">
            Busca abajo los productos que entran y toca «Añadir» en cada uno. También puedes volver a{" "}
            <Link href="/productos" className="font-semibold underline">
              Productos
            </Link>
            , usa los filtros y marca los que quieras.
          </Aviso>
        )}
        {lineas.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-fondo p-3">
              <label className="block">
                <span className="block text-xs font-semibold text-texto-suave">Misma cantidad para todos</span>
                <input type="number" inputMode="numeric" min={0} value={cantidadComun} onChange={(e) => setCantidadComun(Math.max(0, Number.parseInt(e.target.value || "0", 10)))} className="campo !min-h-11 w-28" aria-label="Cantidad para todos" />
              </label>
              <Boton variante="secundario" className="!min-h-11" onClick={() => setLineas((ls) => ls.map((l) => ({ ...l, cantidad: cantidadComun })))}>
                Aplicar a todos
              </Boton>
            </div>
            <ul className="divide-y divide-borde">
              {lineas.map((l) => {
                const p = porId.get(l.producto_id);
                return (
                  <li key={l.producto_id} className="py-3">
                    <div className="flex items-center gap-3">
                      <MiniaturaProducto ruta={p?.miniatura} nombre={l.nombre} tamano={48} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{l.nombre}</span>
                        <span className="block text-sm text-texto-suave">
                          {p?.clasificacion ? <strong className="mr-1 rounded bg-primario-claro px-1 text-primario-oscuro">{p.clasificacion}</strong> : null}
                          {l.codigo} · tiene {l.stock_actual}
                          {l.cantidad > 0 ? ` → quedará en ${l.stock_actual + l.cantidad}` : ""}
                        </span>
                      </span>
                      <button type="button" onClick={() => quitar(l.producto_id)} aria-label={`Quitar ${l.codigo}`} className="flex h-9 w-9 items-center justify-center rounded-full text-peligro hover:bg-peligro-claro">
                        ×
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-xs font-semibold text-texto-suave">Unidades que entran</span>
                        <div className="flex">
                          <button type="button" className="min-h-11 w-11 rounded-l-xl border border-borde bg-fondo text-xl font-bold disabled:opacity-40" onClick={() => fijarCantidad(l.producto_id, l.cantidad - 1)} disabled={l.cantidad <= 0} aria-label="Menos">
                            −
                          </button>
                          <input type="number" inputMode="numeric" min={0} value={l.cantidad} onChange={(e) => fijarCantidad(l.producto_id, Number.parseInt(e.target.value || "0", 10))} className="campo !min-h-11 !rounded-none text-center" aria-label={`Unidades de ${l.codigo}`} />
                          <button type="button" className="min-h-11 w-11 rounded-r-xl border border-borde bg-fondo text-xl font-bold" onClick={() => fijarCantidad(l.producto_id, l.cantidad + 1)} aria-label="Más">
                            +
                          </button>
                        </div>
                      </label>
                      {tipo === "entrada_compra" && (
                        <label className="block">
                          <span className="block text-xs font-semibold text-texto-suave">Costo por unidad</span>
                          <input type="text" inputMode="numeric" value={pesos(l.valor_unitario)} onChange={(e) => fijarValor(l.producto_id, Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} className="campo !min-h-11" aria-label={`Costo de ${l.codigo}`} />
                        </label>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="mt-3">
          {buscar ? (
            <SelectorProductos productos={productos.map((p) => ({ ...p, stock_actual: Number.MAX_SAFE_INTEGER }))} cantidades={cantidades} onCambiar={fijarCantidad} />
          ) : (
            <Boton variante="secundario" className="w-full" onClick={() => setBuscar(true)}>
              ➕ Añadir más productos
            </Boton>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="2. Tipo, fecha y nota">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(TIPOS_ENTRADA) as TipoEntrada[]).map((t) => (
            <label key={t} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${tipo === t ? "border-primario bg-primario-claro" : "border-borde bg-superficie"}`}>
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="mt-1 h-5 w-5 accent-primario" />
              <span>
                <span className="block font-semibold">+ {TIPOS_ENTRADA[t].nombre}</span>
                <span className="block text-sm text-texto-suave">{TIPOS_ENTRADA[t].ayuda}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha" name="fecha" type="date" value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} required />
          <AreaTexto etiqueta="Nota (opcional)" name="nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Ej.: compra del 15 de octubre, pedido a Ana…" />
        </div>
      </Tarjeta>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="sticky bottom-20 z-10 rounded-2xl border border-borde bg-superficie p-4 shadow-lg md:bottom-4">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-texto-suave">{resumenEntrada(lineas)}</span>
          <span className="text-3xl font-bold">+{totales.unidades}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Boton grande variante="acento" className="flex-1" onClick={guardar} disabled={enviando || totales.unidades === 0}>
            {enviando ? "Registrando…" : "Registrar la entrada"}
          </Boton>
          <BotonEnlace href="/productos" variante="fantasma" grande>
            Cancelar
          </BotonEnlace>
        </div>
      </div>
    </div>
  );
}
