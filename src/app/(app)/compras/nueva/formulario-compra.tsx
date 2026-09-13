"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Boton, Campo, Selector, Tarjeta, AreaTexto } from "@/components/ui";
import { BuscadorProducto, type ProductoBuscable } from "@/components/buscador-producto";
import { MiniaturaProducto } from "@/components/miniatura";
import { hoyIso, pesos } from "@/lib/formato";
import { MEDIOS_PAGO, type MedioPago } from "@/lib/tipos";
import { registrarCompra } from "../acciones";

type ProductoCompra = ProductoBuscable & { costo: number };
interface Linea {
  producto_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  costo_unitario: number;
}

export function FormularioCompra({ productos, proveedores }: { productos: ProductoCompra[]; proveedores: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [proveedorId, setProveedorId] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const total = lineas.reduce((s, l) => s + l.cantidad * l.costo_unitario, 0);
  const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);

  function agregar(id: string) {
    if (!id) return setBuscando(false);
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setLineas((ls) => {
      const e = ls.find((l) => l.producto_id === id);
      if (e) return ls.map((l) => (l.producto_id === id ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: 1, costo_unitario: p.costo }];
    });
    setBuscando(false);
    setError(null);
  }
  function actualizar(id: string, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, ...cambios } : l)));
  }

  async function confirmar() {
    if (lineas.length === 0) return setError("Añade al menos un producto.");
    for (const l of lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) return setError(`La cantidad de ${l.codigo} debe ser un entero mayor que cero.`);
      if (l.costo_unitario < 0) return setError(`Revisa el costo de ${l.codigo}.`);
    }
    setEnviando(true);
    setError(null);
    const r = await registrarCompra({
      proveedor_id: proveedorId || null,
      fecha,
      medio_pago: medio,
      nota,
      lineas: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, costo_unitario: l.costo_unitario })),
    });
    setEnviando(false);
    if (r.error) return setError(r.error);
    router.push(`/compras/${r.id}?nueva=1`);
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Tarjeta titulo="1. Productos comprados">
        {lineas.length > 0 && (
          <ul className="mb-3 divide-y divide-borde">
            {lineas.map((l) => {
              const p = productos.find((x) => x.id === l.producto_id);
              return (
                <li key={l.producto_id} className="py-3">
                  <div className="flex items-center gap-3">
                    <MiniaturaProducto ruta={p?.miniatura} nombre={l.nombre} tamano={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.nombre}</span>
                      <span className="block text-sm text-texto-suave">
                        {l.codigo} · hoy hay {p?.stock_actual ?? 0}
                      </span>
                    </span>
                    <span className="font-bold">{pesos(l.cantidad * l.costo_unitario)}</span>
                    <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.producto_id !== l.producto_id))} aria-label={`Quitar ${l.codigo}`} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-peligro hover:bg-peligro-claro">
                      ×
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-xs font-semibold text-texto-suave">Cantidad</span>
                      <input type="number" inputMode="numeric" min={1} value={l.cantidad} onChange={(e) => actualizar(l.producto_id, { cantidad: Number.parseInt(e.target.value || "1", 10) })} className="campo !min-h-11" aria-label="Cantidad" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-texto-suave">Costo por unidad</span>
                      <input type="text" inputMode="numeric" value={pesos(l.costo_unitario)} onChange={(e) => actualizar(l.producto_id, { costo_unitario: Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} className="campo !min-h-11" aria-label="Costo unitario" />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {buscando ? (
          <BuscadorProducto productos={productos} seleccionado="" onSeleccionar={agregar} />
        ) : (
          <Boton variante="secundario" className="w-full" onClick={() => setBuscando(true)}>
            ➕ Añadir otro producto
          </Boton>
        )}
        <Link href="/productos/nuevo" className="mt-2 inline-block text-sm font-semibold text-primario">
          ¿Producto nuevo? Créalo primero
        </Link>
      </Tarjeta>

      <Tarjeta titulo="2. Datos de la compra">
        <div className="grid gap-3 sm:grid-cols-3">
          <Selector etiqueta="Proveedor (opcional)" name="proveedor_id" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Medio de pago" name="medio_pago" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {Object.entries(MEDIOS_PAGO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Campo etiqueta="Fecha" name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <AreaTexto etiqueta="Nota (opcional)" name="nota" value={nota} onChange={(e) => setNota(e.target.value)} className="mt-3" rows={2} />
      </Tarjeta>

      <div className="sticky bottom-20 z-10 rounded-2xl border border-borde bg-superficie p-4 shadow-lg md:bottom-4">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-texto-suave">{piezas} piezas</span>
          <span className="text-3xl font-bold">{pesos(total)}</span>
        </div>
        <Boton grande className="w-full" onClick={confirmar} disabled={enviando || lineas.length === 0}>
          {enviando ? "Guardando…" : "3. Confirmar compra"}
        </Boton>
      </div>
    </div>
  );
}
