"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Boton, Campo, Selector, Tarjeta, AreaTexto } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { BuscadorProducto, type ProductoBuscable } from "@/components/buscador-producto";
import { MiniaturaProducto } from "@/components/miniatura";
import { hoyIso, pesos } from "@/lib/formato";
import { MEDIOS_PAGO, TIPOS_CONTACTO, type MedioPago, type TipoContacto } from "@/lib/tipos";
import { subtotalLinea, totalesCarrito, validarCarrito, type LineaCarrito } from "@/lib/ventas";
import { registrarVenta, type DatosVenta } from "../acciones";
import { encolarPendiente, esErrorDeRed } from "@/lib/pendientes";

type ProductoVenta = ProductoBuscable & { precio_publico: number };

export function FormularioVenta({ productos, contactos }: { productos: ProductoVenta[]; contactos: { id: string; nombre: string; tipo: TipoContacto }[] }) {
  const router = useRouter();
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [contactoId, setContactoId] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [estadoPago, setEstadoPago] = useState<"pagada" | "abono" | "pendiente">("pagada");
  const [abono, setAbono] = useState<number | null>(null);
  const [descuentoTotal, setDescuentoTotal] = useState<number | null>(null);
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const totales = totalesCarrito(lineas, descuentoTotal ?? 0);

  function agregar(id: string) {
    if (!id) {
      setBuscando(false);
      return;
    }
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setLineas((ls) => {
      const existente = ls.find((l) => l.producto_id === id);
      if (existente) return ls.map((l) => (l.producto_id === id ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio_publico, descuento: 0, stock_actual: p.stock_actual }];
    });
    setBuscando(false);
    setError(null);
  }

  function actualizar(id: string, cambios: Partial<LineaCarrito>) {
    setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, ...cambios } : l)));
  }

  async function confirmar() {
    const problema = validarCarrito(lineas);
    if (problema) return setError(problema);
    if (estadoPago !== "pagada" && !contactoId) return setError("Para dejar saldo pendiente elige la clienta.");
    if (estadoPago === "abono" && (!abono || abono <= 0 || abono >= totales.total)) return setError("El abono debe ser mayor que cero y menor que el total.");
    setEnviando(true);
    setError(null);
    const datos: DatosVenta = {
      fecha,
      contacto_id: contactoId || null,
      descuento_total: descuentoTotal ?? 0,
      medio_pago: medio,
      estado_pago: estadoPago,
      abono: estadoPago === "abono" ? (abono ?? 0) : 0,
      nota,
      lineas: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio_unitario: l.precio_unitario, descuento: l.descuento })),
    };
    let r: { id?: string; error?: string };
    try {
      r = await registrarVenta(datos);
    } catch (e) {
      r = { error: (e as Error).message };
    }
    setEnviando(false);
    if (r.error) {
      if (esErrorDeRed(r.error)) {
        encolarPendiente("venta", datos, `Venta de ${totales.unidades} piezas por ${pesos(totales.total)}`);
        router.push("/ventas?aviso=" + encodeURIComponent("Sin conexión: la venta quedó guardada en el celular y se enviará sola cuando vuelva el internet."));
        return;
      }
      return setError(r.error);
    }
    router.push(`/ventas/${r.id}?nueva=1`);
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta titulo="1. Productos">
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
                    <span className="font-bold">{pesos(subtotalLinea(l))}</span>
                    <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.producto_id !== l.producto_id))} aria-label={`Quitar ${l.codigo}`} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-peligro hover:bg-peligro-claro">
                      ×
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
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
                      <span className="block text-xs font-semibold text-texto-suave">Precio</span>
                      <input type="text" inputMode="numeric" value={pesos(l.precio_unitario)} onChange={(e) => actualizar(l.producto_id, { precio_unitario: Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} className="campo !min-h-11" aria-label="Precio unitario" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-texto-suave">Descuento</span>
                      <input type="text" inputMode="numeric" value={l.descuento ? pesos(l.descuento) : ""} placeholder="0" onChange={(e) => actualizar(l.producto_id, { descuento: Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} className="campo !min-h-11" aria-label="Descuento" />
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
      </Tarjeta>

      <Tarjeta titulo="2. Pago">
        <div className="grid gap-3 sm:grid-cols-2">
          <Selector etiqueta="Medio de pago" name="medio_pago" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {Object.entries(MEDIOS_PAGO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Estado del pago" name="estado_pago" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value as typeof estadoPago)}>
            <option value="pagada">Pagada completa</option>
            <option value="abono">Abono parcial</option>
            <option value="pendiente">Queda pendiente</option>
          </Selector>
          {estadoPago === "abono" && <CampoPesos etiqueta="Valor del abono" name="abono" onCambio={setAbono} requerido />}
          <CampoPesos etiqueta="Descuento general (opcional)" name="descuento_total" onCambio={setDescuentoTotal} />
          <div>
            <Selector etiqueta={estadoPago === "pagada" ? "Clienta (opcional)" : "Clienta"} name="contacto_id" value={contactoId} onChange={(e) => setContactoId(e.target.value)}>
              <option value="">Cliente ocasional</option>
              {contactos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {TIPOS_CONTACTO[c.tipo]}
                </option>
              ))}
            </Selector>
            <Link href="/contactos/nuevo?volver=/ventas/nueva&tipo=cliente" className="mt-1 inline-block text-sm font-semibold text-primario">
              Crear contacto nuevo
            </Link>
          </div>
          <Campo etiqueta="Fecha" name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <AreaTexto etiqueta="Nota (opcional)" name="nota" value={nota} onChange={(e) => setNota(e.target.value)} className="mt-3" rows={2} />
      </Tarjeta>

      <div className="sticky bottom-20 z-10 rounded-2xl border border-borde bg-superficie p-4 shadow-lg md:bottom-4">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-texto-suave">
            {totales.unidades} {totales.unidades === 1 ? "pieza" : "piezas"}
            {descuentoTotal ? ` · descuento ${pesos(descuentoTotal)}` : ""}
          </span>
          <span className="text-3xl font-bold">{pesos(totales.total)}</span>
        </div>
        <Boton grande className="w-full" onClick={confirmar} disabled={enviando || lineas.length === 0}>
          {enviando ? "Guardando…" : "3. Confirmar venta"}
        </Boton>
      </div>
    </div>
  );
}
