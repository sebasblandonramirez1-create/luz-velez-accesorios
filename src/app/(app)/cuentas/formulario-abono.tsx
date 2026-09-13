"use client";

import { useActionState, useState } from "react";
import { Aviso, Campo, Selector, BotonEnviar } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { hoyIso, pesos } from "@/lib/formato";
import { MEDIOS_PAGO } from "@/lib/tipos";
import { registrarAbonoAccion, type EstadoAbono } from "./acciones";

/** Registro rápido de un abono contra una cuenta con saldo. */
export function FormularioAbono({ cuentaId, saldo, volver }: { cuentaId: string; saldo: number; volver: string }) {
  const [estado, accion] = useActionState<EstadoAbono, FormData>(registrarAbonoAccion, {});
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="min-h-12 w-full rounded-xl bg-primario px-4 font-semibold text-white">
        Registrar abono
      </button>
    );
  }
  return (
    <form action={accion} className="space-y-3 rounded-xl border border-borde bg-fondo p-3">
      <input type="hidden" name="cuenta_id" value={cuentaId} />
      <input type="hidden" name="volver" value={volver} />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <CampoPesos etiqueta={`Valor (saldo ${pesos(saldo)})`} name="valor" valorInicial={saldo} requerido />
      <div className="grid grid-cols-2 gap-2">
        <Selector etiqueta="Medio" name="medio_pago" defaultValue="efectivo">
          {Object.entries(MEDIOS_PAGO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={hoyIso()} />
      </div>
      <Campo etiqueta="Nota (opcional)" name="nota" />
      <div className="flex gap-2">
        <BotonEnviar grande={false}>Guardar abono</BotonEnviar>
        <button type="button" onClick={() => setAbierto(false)} className="min-h-12 px-3 font-semibold text-texto-suave">
          Cancelar
        </button>
      </div>
    </form>
  );
}
