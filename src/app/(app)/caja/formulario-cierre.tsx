"use client";

import { useActionState, useState } from "react";
import { Aviso, Campo, BotonEnviar } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { pesos } from "@/lib/formato";
import { cerrarCajaAccion, type EstadoCierre } from "./acciones";

export function FormularioCierre({ dia, esperado, contadoActual, yaCerrada }: { dia: string; esperado: number; contadoActual: number | null; yaCerrada: boolean }) {
  const [estado, accion] = useActionState<EstadoCierre, FormData>(cerrarCajaAccion, {});
  const [contado, setContado] = useState<number | null>(contadoActual);
  const diferencia = contado == null ? null : contado - esperado;
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="dia" value={dia} />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoPesos etiqueta="Efectivo contado" name="efectivo_contado" valorInicial={contadoActual} requerido onCambio={setContado} ayuda={`Debería haber ${pesos(esperado)}.`} />
        <Campo etiqueta="Nota (opcional)" name="nota" placeholder="Ej.: faltó el vuelto del taxi" />
      </div>
      {diferencia != null && (
        <p className={`text-sm font-semibold ${diferencia === 0 ? "text-exito" : diferencia > 0 ? "text-alerta" : "text-peligro"}`}>
          {diferencia === 0 ? "La caja cuadra." : diferencia > 0 ? `Sobran ${pesos(diferencia)}.` : `Faltan ${pesos(-diferencia)}.`}
        </p>
      )}
      <BotonEnviar grande={false} className="sm:w-auto">
        {yaCerrada ? "Corregir cierre" : "Cerrar caja"}
      </BotonEnviar>
    </form>
  );
}
