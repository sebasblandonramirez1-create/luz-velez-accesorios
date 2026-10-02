"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Aviso, AreaTexto, Boton, BotonEnlace, Campo, Tarjeta } from "@/components/ui";
import { SelectorProductos } from "@/components/selector-productos";
import { MiniaturaProducto } from "@/components/miniatura";
import { pesos } from "@/lib/formato";
import type { ProductoFiltrable } from "@/lib/filtros-productos";
import { describirCambio, diferenciasConsignacion, totalesLineas } from "@/lib/modificaciones";
import { modificarConsignacion } from "../../acciones";

export interface LineaEditable {
  producto_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  valor_unitario: number;
  /** Lo más que se puede entregar: existencias más lo que ya está en esta entrega. */
  maximo: number;
  /** Lo ya liquidado (vendido más devuelto): no se puede bajar de ahí. */
  minimo: number;
  vendida: number;
  devuelta: number;
}

export function FormularioModificar({
  consignacionId,
  productos,
  lineasIniciales,
  fechaEntrega,
  fechaLimiteInicial,
  notaInicial,
  firmadoPor,
  enlacePendiente,
}: {
  consignacionId: string;
  productos: ProductoFiltrable[];
  lineasIniciales: LineaEditable[];
  fechaEntrega: string;
  fechaLimiteInicial: string | null;
  notaInicial: string;
  firmadoPor: string | null;
  enlacePendiente: boolean;
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState<LineaEditable[]>(lineasIniciales);
  const [fechaLimite, setFechaLimite] = useState(fechaLimiteInicial ?? "");
  const [nota, setNota] = useState(notaInicial);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const originales = useMemo(() => new Map(lineasIniciales.map((l) => [l.producto_id, l])), [lineasIniciales]);
  const cantidades = Object.fromEntries(lineas.map((l) => [l.producto_id, l.cantidad]));
  const antes = totalesLineas(lineasIniciales);
  const ahora = totalesLineas(lineas);
  const cambios = diferenciasConsignacion({ lineas: lineasIniciales, fecha_limite: fechaLimiteInicial, nota: notaInicial }, { lineas, fecha_limite: fechaLimite || null, nota });

  /** Fija la cantidad de un producto respetando lo liquidado y las existencias. 0 lo retira. */
  function fijarCantidad(id: string, cantidad: number) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    const original = originales.get(id);
    const minimo = original?.minimo ?? 0;
    const maximo = original?.maximo ?? p.stock_actual;
    const n = Math.max(minimo, Math.min(Number.isFinite(cantidad) ? Math.trunc(cantidad) : minimo, maximo));
    setError(n !== cantidad && cantidad < minimo ? `De ${p.codigo} ya se liquidaron ${minimo} piezas: no puedes dejar menos.` : null);
    setLineas((ls) => {
      if (n <= 0) return ls.filter((l) => l.producto_id !== id);
      if (ls.some((l) => l.producto_id === id)) return ls.map((l) => (l.producto_id === id ? { ...l, cantidad: n } : l));
      return [...ls, { producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: n, valor_unitario: original?.valor_unitario ?? p.precio_base, maximo, minimo, vendida: original?.vendida ?? 0, devuelta: original?.devuelta ?? 0 }];
    });
  }

  function fijarValor(id: string, valor: number) {
    setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, valor_unitario: valor } : l)));
  }

  async function guardar() {
    if (lineas.length === 0) return setError("La entrega debe quedar con al menos una pieza. Para deshacerla del todo, usa «Anular entrega».");
    if (cambios.length === 0) return setError("No cambiaste nada. Ajusta las piezas, la fecha límite o la nota antes de guardar.");
    if (fechaLimite && fechaLimite < fechaEntrega) return setError("La fecha límite no puede ser anterior a la fecha de entrega.");
    setEnviando(true);
    setError(null);
    let r: { ok?: true; error?: string };
    try {
      r = await modificarConsignacion({
        consignacion_id: consignacionId,
        motivo,
        fecha_limite: fechaLimite,
        nota,
        lineas: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, valor_unitario: l.valor_unitario })),
      });
    } catch {
      r = { error: "Sin conexión. Los cambios no se guardaron; revisa el internet e inténtalo de nuevo." };
    }
    setEnviando(false);
    if (r.error) return setError(r.error);
    router.push(`/consignaciones/${consignacionId}?aviso=${encodeURIComponent("Entrega modificada. El cambio quedó en el historial y el inventario ya está ajustado.")}#historial`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {firmadoPor && (
        <Aviso tipo="alerta">
          El recibo de esta entrega está firmado por {firmadoPor}. Al guardar los cambios <strong>la firma se anula</strong>, porque lo firmado ya no coincide, y tendrás que pedirla de nuevo. La anulación queda anotada en el historial.
        </Aviso>
      )}
      {enlacePendiente && !firmadoPor && <Aviso tipo="info">Ya enviaste un enlace de firma que sigue vigente. Después de guardar, ese mismo enlace mostrará el recibo actualizado.</Aviso>}

      <Tarjeta titulo="1. Busca y ajusta las piezas">
        <p className="mb-3 text-sm text-texto-suave">Las existencias que ves incluyen lo que ya está en esta entrega. Añade piezas nuevas, o sube y baja las que ya tiene.</p>
        <SelectorProductos productos={productos} cantidades={cantidades} onCambiar={fijarCantidad} />
      </Tarjeta>

      <Tarjeta titulo={`2. Así queda la entrega (${ahora.piezas} ${ahora.piezas === 1 ? "pieza" : "piezas"})`}>
        {lineas.length === 0 && <p className="text-texto-suave">La entrega quedó sin piezas. Añade al menos una.</p>}
        <ul className="divide-y divide-borde">
          {lineas.map((l) => {
            const p = productos.find((x) => x.id === l.producto_id);
            const original = originales.get(l.producto_id);
            const delta = l.cantidad - (original?.cantidad ?? 0);
            return (
              <li key={l.producto_id} className="py-3">
                <div className="flex items-center gap-3">
                  <MiniaturaProducto ruta={p?.miniatura} nombre={l.nombre} tamano={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.nombre}</span>
                    <span className="block text-sm text-texto-suave">
                      {l.codigo} · hasta {l.maximo}
                      {l.minimo > 0 ? ` · ya liquidadas: ${l.minimo} (vendidas ${l.vendida}, devueltas ${l.devuelta})` : ""}
                    </span>
                    <span className="block text-sm font-semibold">
                      {!original ? <span className="text-exito">Pieza nueva</span> : delta > 0 ? <span className="text-exito">+{delta} respecto a lo entregado</span> : delta < 0 ? <span className="text-alerta">{delta} respecto a lo entregado</span> : null}
                    </span>
                  </span>
                  <span className="font-bold">{pesos(l.cantidad * l.valor_unitario)}</span>
                  <button
                    type="button"
                    onClick={() => fijarCantidad(l.producto_id, 0)}
                    disabled={l.minimo > 0}
                    title={l.minimo > 0 ? "Tiene piezas liquidadas: no se puede retirar" : undefined}
                    aria-label={`Retirar ${l.codigo} de la entrega`}
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-peligro hover:bg-peligro-claro disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-xs font-semibold text-texto-suave">Cantidad entregada</span>
                    <div className="flex">
                      <button type="button" className="min-h-11 w-11 rounded-l-xl border border-borde bg-fondo text-xl font-bold disabled:opacity-40" onClick={() => fijarCantidad(l.producto_id, l.cantidad - 1)} disabled={l.cantidad <= Math.max(1, l.minimo)} aria-label="Menos">
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={Math.max(1, l.minimo)}
                        max={l.maximo}
                        value={l.cantidad}
                        onChange={(e) => fijarCantidad(l.producto_id, Math.max(1, Number.parseInt(e.target.value || "1", 10)))}
                        className="campo !min-h-11 !rounded-none text-center"
                        aria-label={`Cantidad de ${l.codigo}`}
                      />
                      <button type="button" className="min-h-11 w-11 rounded-r-xl border border-borde bg-fondo text-xl font-bold disabled:opacity-40" onClick={() => fijarCantidad(l.producto_id, l.cantidad + 1)} disabled={l.cantidad >= l.maximo} aria-label="Más">
                        +
                      </button>
                    </div>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-texto-suave">Valor unitario{l.vendida > 0 ? " (fijo: ya hay ventas)" : ""}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pesos(l.valor_unitario)}
                      disabled={l.vendida > 0}
                      onChange={(e) => fijarValor(l.producto_id, Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                      className="campo !min-h-11"
                      aria-label={`Valor unitario de ${l.codigo}`}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="3. Fecha límite, nota y motivo">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha límite para liquidar" name="fecha_limite" type="date" min={fechaEntrega} value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
          <Campo etiqueta="Motivo del cambio (opcional)" name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ej.: pidió más aretas" ayuda="Queda escrito en el historial." />
        </div>
        <AreaTexto etiqueta="Nota de la entrega (opcional)" name="nota" value={nota} onChange={(e) => setNota(e.target.value)} className="mt-3" rows={2} />
      </Tarjeta>

      <Tarjeta titulo="4. Cambios que se van a guardar">
        {cambios.length === 0 ? (
          <p className="text-texto-suave">Todavía no has cambiado nada.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {cambios.map((c, i) => (
              <li key={i}>{describirCambio(c)}</li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="sticky bottom-20 z-10 rounded-2xl border border-borde bg-superficie p-4 shadow-lg md:bottom-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <span className="text-sm text-texto-suave">
            Antes: {antes.piezas} {antes.piezas === 1 ? "pieza" : "piezas"} · {pesos(antes.total)}
          </span>
          <span className="text-right">
            <span className="block text-sm text-texto-suave">
              Ahora: {ahora.piezas} {ahora.piezas === 1 ? "pieza" : "piezas"}
            </span>
            <span className="text-3xl font-bold">{pesos(ahora.total)}</span>
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Boton grande variante="acento" className="flex-1" onClick={guardar} disabled={enviando || cambios.length === 0 || lineas.length === 0}>
            {enviando ? "Guardando…" : firmadoPor ? "Guardar cambios y anular la firma" : "Guardar cambios"}
          </Boton>
          <BotonEnlace href={`/consignaciones/${consignacionId}`} variante="fantasma" grande>
            Cancelar
          </BotonEnlace>
        </div>
      </div>
    </div>
  );
}
