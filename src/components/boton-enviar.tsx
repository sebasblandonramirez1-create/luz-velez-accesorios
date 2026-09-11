"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function BotonEnviar({
  children,
  cargando = "Guardando…",
  variante = "primario",
  grande = true,
  className = "",
}: {
  children: ReactNode;
  cargando?: string;
  variante?: "primario" | "secundario" | "peligro" | "acento";
  grande?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const estilos = {
    primario: "bg-primario text-white hover:bg-primario-oscuro shadow-sm",
    secundario: "bg-superficie text-texto border border-borde hover:bg-primario-claro",
    peligro: "bg-peligro text-white hover:brightness-90",
    acento: "bg-acento text-white hover:brightness-95 shadow-sm",
  }[variante];
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 font-semibold transition disabled:opacity-60 ${estilos} ${
        grande ? "min-h-14 text-lg" : "min-h-12 text-base"
      } ${className}`}
    >
      {pending ? cargando : children}
    </button>
  );
}
