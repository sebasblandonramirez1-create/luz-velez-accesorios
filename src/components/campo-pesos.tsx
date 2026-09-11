"use client";

import { useState } from "react";
import { leerPesos, pesos } from "@/lib/formato";

/**
 * Campo de dinero: muestra 118.900 mientras se escribe y envía el número
 * limpio en un input oculto con el `name` indicado.
 */
export function CampoPesos({
  etiqueta,
  name,
  valorInicial,
  ayuda,
  requerido = false,
  onCambio,
  valorControlado,
}: {
  etiqueta: string;
  name: string;
  valorInicial?: number | null;
  ayuda?: string;
  requerido?: boolean;
  onCambio?: (valor: number | null) => void;
  /** Si se pasa, el campo muestra este valor cuando cambia desde afuera. */
  valorControlado?: number | null;
}) {
  const [texto, setTexto] = useState(valorInicial == null ? "" : pesos(valorInicial));
  const [ultimoControlado, setUltimoControlado] = useState(valorControlado);

  if (valorControlado !== undefined && valorControlado !== ultimoControlado) {
    setUltimoControlado(valorControlado);
    setTexto(valorControlado == null ? "" : pesos(valorControlado));
  }

  const numero = leerPesos(texto);
  return (
    <label className="block" htmlFor={name}>
      <span className="mb-1.5 block text-sm font-semibold">{etiqueta}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-texto-suave">$</span>
        <input
          id={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="campo pl-8"
          value={texto}
          required={requerido}
          onChange={(e) => {
            const n = leerPesos(e.target.value);
            setTexto(n == null ? "" : pesos(n));
            onCambio?.(n);
          }}
        />
      </span>
      <input type="hidden" name={name} value={numero ?? ""} />
      {ayuda && <span className="mt-1 block text-sm text-texto-suave">{ayuda}</span>}
    </label>
  );
}
