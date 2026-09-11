"use client";

import { useActionState, useMemo, useState } from "react";
import { Aviso, AreaTexto, Campo, Tarjeta, BotonEnviar } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { BuscadorProducto, type ProductoBuscable } from "@/components/buscador-producto";
import { hoyIso } from "@/lib/formato";
import { TIPOS_MOVIMIENTO, tiposManuales, validarMovimiento, type TipoMovimiento } from "@/lib/inventario";
import { registrarMovimiento, type EstadoMovimiento } from "../acciones";

export function FormularioMovimiento({ productos, productoInicial }: { productos: (ProductoBuscable & { costo: number })[]; productoInicial: string }) {
  const [estado, accion] = useActionState<EstadoMovimiento, FormData>(registrarMovimiento, {});
  const [productoId, setProductoId] = useState(productoInicial);
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada_compra");
  const [cantidad, setCantidad] = useState(1);

  const producto = useMemo(() => productos.find((p) => p.id === productoId), [productos, productoId]);
  const advertencia = producto ? validarMovimiento(tipo, cantidad, producto.stock_actual) : null;
  const signo = TIPOS_MOVIMIENTO[tipo].signo;
  const resultado = producto ? producto.stock_actual + signo * cantidad : null;

  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <Tarjeta titulo="1. Producto">
        <BuscadorProducto productos={productos} seleccionado={productoId} onSeleccionar={setProductoId} />
        <input type="hidden" name="producto_id" value={productoId} />
      </Tarjeta>

      <Tarjeta titulo="2. Tipo de movimiento">
        <div className="grid gap-2 sm:grid-cols-2">
          {tiposManuales().map((t) => (
            <label key={t} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${tipo === t ? "border-primario bg-primario-claro" : "border-borde bg-superficie"}`}>
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="h-5 w-5 accent-primario" />
              <span className="font-semibold">
                {TIPOS_MOVIMIENTO[t].signo > 0 ? "+" : "−"} {TIPOS_MOVIMIENTO[t].nombre}
              </span>
            </label>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="3. Cantidad y detalles">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cantidad" name="cantidad" type="number" inputMode="numeric" min={1} value={cantidad} onChange={(e) => setCantidad(Number.parseInt(e.target.value || "0", 10))} required />
          <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={hoyIso()} required />
          {tipo === "entrada_compra" && (
            <CampoPesos etiqueta="Costo por unidad (opcional)" name="valor_unitario" valorInicial={producto?.costo ?? null} ayuda="Se guarda como costo de compra del producto." />
          )}
        </div>
        <AreaTexto etiqueta="Nota (opcional)" name="nota" className="mt-4" placeholder="Ej.: compra en el centro, se rompió una perla…" />
        {producto && (
          <p className="mt-4 rounded-xl bg-fondo p-3 text-sm">
            <strong>{producto.nombre}</strong>: tiene {producto.stock_actual} y quedará en <strong>{resultado}</strong>.
          </p>
        )}
        {advertencia && <Aviso tipo="alerta" className="mt-3">{advertencia}</Aviso>}
      </Tarjeta>

      <BotonEnviar>Registrar movimiento</BotonEnviar>
    </form>
  );
}
