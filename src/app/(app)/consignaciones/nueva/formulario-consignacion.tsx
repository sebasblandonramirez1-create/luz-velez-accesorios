"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Boton, Campo, Selector, Tarjeta, AreaTexto } from "@/components/ui";
import { BuscadorProducto, type ProductoBuscable } from "@/components/buscador-producto";
import { MiniaturaProducto } from "@/components/miniatura";
import { hoyIso, pesos } from "@/lib/formato";
import { TIPOS_CONTACTO, type TipoContacto } from "@/lib/tipos";
import { registrarConsignacion } from "../acciones";

type ProductoEntrega = ProductoBuscable & { precio_base: number };
interface Linea {
  producto_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  valor_unitario: number;
  stock_actual: number;
}

export function FormularioConsignacion({
  productos,
  contactos,
  contactoInicial,
}: {
  productos: ProductoEntrega[];
  contactos: { id: string; nombre: string; tipo: TipoContacto }[];
  contactoInicial: string;
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [contactoId, setContactoId] = useState(contactoInicial);
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const total = lineas.reduce((s, l) => s + l.cantidad * l.valor_unitario, 0);
  const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);

  function agregar(id: string) {
    if (!id) return setBuscando(false);
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setLineas((ls) => {
      const e = ls.find((l) => l.producto_id === id);
      if (e) return ls.map((l) => (l.producto_id === id ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: 1, valor_unitario: p.precio_base, stock_actual: p.stock_actual }];
    });
    setBuscando(false);
    setError(null);
  }
  function actualizar(id: string, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, ...cambios } : l)));
  }

  async function confirmar() {
    if (!contactoId) return setError("Elige la vendedora que se lleva la mercancía.");
    if (lineas.length === 0) return setError("Añade al menos un producto.");
    for (const l of lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) return setError(`La cantidad de ${l.codigo} debe ser un entero mayor que cero.`);
      if (l.cantidad > l.stock_actual) return setError(`De ${l.codigo} solo hay ${l.stock_actual} en inventario.`);
    }
    setEnviando(true);
    setError(null);
    const r = await registrarConsignacion({
      contacto_id: contactoId,
      fecha_entrega: fecha,
      nota,
      lineas: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, valor_unitario: l.valor_unitario })),
    });
    setEnviando(false);
    if (r.error) return setError(r.error);
    router.push(`/consignaciones/${r.id}?nueva=1`);
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Tarjeta titulo="1. Vendedora">
        <Selector etiqueta="¿Quién se lleva la mercancía?" name="contacto_id" value={contactoId} onChange={(e) => setContactoId(e.target.value)}>
          <option value="">Elige…</option>
          {contactos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} · {TIPOS_CONTACTO[c.tipo]}
            </option>
          ))}
        </Selector>
        <Link href="/contactos/nuevo?volver=/consignaciones/nueva&tipo=vendedora" className="mt-1 inline-block text-sm font-semibold text-primario">
          Crear vendedora nueva
        </Link>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha de entrega" name="fecha_entrega" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="2. Piezas entregadas">
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
                        {l.codigo} · {l.stock_actual} en stock
                      </span>
                    </span>
                    <span className="font-bold">{pesos(l.cantidad * l.valor_unitario)}</span>
                    <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.producto_id !== l.producto_id))} aria-label={`Quitar ${l.codigo}`} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-peligro hover:bg-peligro-claro">
                      ×
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-xs font-semibold text-texto-suave">Cantidad</span>
                      <div className="flex">
                        <button type="button" className="min-h-11 w-11 rounded-l-xl border border-borde bg-fondo text-xl font-bold" onClick={() => actualizar(l.producto_id, { cantidad: Math.max(1, l.cantidad - 1) })} aria-label="Menos">
                          −
                        </button>
                        <input type="number" inputMode="numeric" min={1} value={l.cantidad} onChange={(e) => actualizar(l.producto_id, { cantidad: Number.parseInt(e.target.value || "1", 10) })} className="campo !min-h-11 !rounded-none text-center" aria-label="Cantidad" />
                        <button type="button" className="min-h-11 w-11 rounded-r-xl border border-borde bg-fondo text-xl font-bold" onClick={() => actualizar(l.producto_id, { cantidad: l.cantidad + 1 })} aria-label="Más">
                          +
                        </button>
                      </div>
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-texto-suave">Valor unitario</span>
                      <input type="text" inputMode="numeric" value={pesos(l.valor_unitario)} onChange={(e) => actualizar(l.producto_id, { valor_unitario: Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} className="campo !min-h-11" aria-label="Valor unitario" />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {buscando ? (
          <BuscadorProducto productos={productos.filter((p) => p.stock_actual > 0)} seleccionado="" onSeleccionar={agregar} />
        ) : (
          <Boton variante="secundario" className="w-full" onClick={() => setBuscando(true)}>
            ➕ Añadir otro producto
          </Boton>
        )}
        <AreaTexto etiqueta="Nota (opcional)" name="nota" value={nota} onChange={(e) => setNota(e.target.value)} className="mt-3" rows={2} />
      </Tarjeta>

      <div className="sticky bottom-20 z-10 rounded-2xl border border-borde bg-superficie p-4 shadow-lg md:bottom-4">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-texto-suave">
            {piezas} {piezas === 1 ? "pieza" : "piezas"} a precio base
          </span>
          <span className="text-3xl font-bold">{pesos(total)}</span>
        </div>
        <Boton grande variante="acento" className="w-full" onClick={confirmar} disabled={enviando || lineas.length === 0}>
          {enviando ? "Guardando…" : "3. Confirmar entrega"}
        </Boton>
      </div>
    </div>
  );
}
