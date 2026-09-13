"use client";

import { useActionState, useState } from "react";
import { Aviso, AreaTexto, Campo, Selector, Tarjeta, BotonEnviar, BotonEnlace } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { SubirFotos } from "@/components/subir-fotos";
import { hoyIso } from "@/lib/formato";
import { CATEGORIAS_GASTO, MEDIOS_PAGO, type Gasto } from "@/lib/tipos";
import { urlFoto } from "@/lib/urls";
import { guardarGasto, type EstadoGasto } from "./acciones";

export function FormularioGasto({ gasto, proveedores }: { gasto?: Gasto; proveedores: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState<EstadoGasto, FormData>(guardarGasto, {});
  const [idNuevo] = useState(() => gasto?.id ?? crypto.randomUUID());
  const [quitarFoto, setQuitarFoto] = useState(false);
  const fechaInicial = gasto ? new Date(gasto.fecha).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : hoyIso();

  return (
    <form action={accion} className="space-y-4">
      {gasto && <input type="hidden" name="id" value={gasto.id} />}
      {gasto?.foto_soporte && !quitarFoto && <input type="hidden" name="foto_actual" value={gasto.foto_soporte} />}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Tarjeta>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoPesos etiqueta="Valor" name="valor" valorInicial={gasto?.valor ?? null} requerido />
          <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={fechaInicial} required />
          <Selector etiqueta="Categoría" name="categoria" defaultValue={gasto?.categoria ?? "otros"}>
            {Object.entries(CATEGORIAS_GASTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Medio de pago" name="medio_pago" defaultValue={gasto?.medio_pago ?? "efectivo"}>
            {Object.entries(MEDIOS_PAGO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Proveedor (opcional)" name="proveedor_id" defaultValue={gasto?.proveedor_id ?? ""}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </div>
        <AreaTexto etiqueta="Descripción o nota" name="nota" defaultValue={gasto?.nota ?? ""} className="mt-4" rows={2} placeholder="Ej.: bolsas y cajitas, taxi al centro…" />
      </Tarjeta>
      <Tarjeta titulo="Foto del soporte (opcional)">
        {gasto?.foto_soporte && !quitarFoto ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlFoto(gasto.foto_soporte)!} alt="Soporte" className="h-24 w-24 rounded-xl border border-borde object-cover" />
            <button type="button" onClick={() => setQuitarFoto(true)} className="font-semibold text-peligro">
              Quitar foto
            </button>
          </div>
        ) : (
          <SubirFotos productoId={idNuevo} carpeta="gastos" maximo={1} titulo="Recibo o factura" ayuda="Toma una foto del recibo. Se reduce automáticamente antes de subirse." />
        )}
      </Tarjeta>
      <div className="flex flex-col gap-2 sm:flex-row">
        <BotonEnviar>{gasto ? "Guardar cambios" : "Registrar gasto"}</BotonEnviar>
        <BotonEnlace href="/gastos" variante="fantasma" grande>
          Cancelar
        </BotonEnlace>
      </div>
    </form>
  );
}
