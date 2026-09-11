"use client";

import { useSyncExternalStore } from "react";

const OPCIONES = [
  { valor: "", texto: "Normal" },
  { valor: "grande", texto: "Grande" },
  { valor: "muy-grande", texto: "Muy grande" },
];

const CLAVE = "tamano-letra";
const EVENTO = "tamano-letra-cambiado";

function leerGuardado(): string {
  try {
    return localStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

function aplicarTamano(v: string) {
  try {
    if (v) localStorage.setItem(CLAVE, v);
    else localStorage.removeItem(CLAVE);
  } catch {}
  const raiz = document.documentElement;
  if (v) raiz.setAttribute("data-tamano", v);
  else raiz.removeAttribute("data-tamano");
  window.dispatchEvent(new Event(EVENTO));
}

/** Guarda el tamaño de letra en el navegador y lo aplica al instante. */
export function TamanoLetra() {
  const actual = useSyncExternalStore(suscribir, leerGuardado, () => "");
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tamaño de letra">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={actual === o.valor}
          onClick={() => aplicarTamano(o.valor)}
          className={`min-h-12 rounded-xl border px-4 font-semibold ${actual === o.valor ? "border-primario bg-primario-claro text-primario-oscuro" : "border-borde bg-superficie"}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}
