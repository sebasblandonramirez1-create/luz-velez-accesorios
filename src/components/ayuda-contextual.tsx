"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ayudaPara } from "@/lib/ayuda";
import { reiniciarTutorial } from "./tutorial";

const CLAVE_LETRA = "tamano-letra";
const TAMANOS = ["", "grande", "muy-grande"];

function leerTamano(): string {
  try {
    return localStorage.getItem(CLAVE_LETRA) ?? "";
  } catch {
    return "";
  }
}
function aplicarTamano(v: string) {
  try {
    if (v) localStorage.setItem(CLAVE_LETRA, v);
    else localStorage.removeItem(CLAVE_LETRA);
  } catch {}
  const raiz = document.documentElement;
  if (v) raiz.setAttribute("data-tamano", v);
  else raiz.removeAttribute("data-tamano");
  window.dispatchEvent(new Event("tamano-letra-cambiado"));
}

/**
 * Botón «Ayuda» fijo en todas las pantallas. Abre un panel con los pasos de la
 * pantalla actual en lenguaje sencillo, letra más grande o más pequeña, vuelta
 * al inicio y la guía completa. Pensado para usarse sin saber de computadores.
 */
export function AyudaContextual() {
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [tamano, setTamano] = useState("");
  const ayuda = ayudaPara(pathname ?? "/");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el tamaño guardado solo existe en el navegador
    setTamano(leerTamano());
  }, []);

  function cambiarLetra(paso: 1 | -1) {
    const i = Math.max(0, Math.min(TAMANOS.length - 1, TAMANOS.indexOf(tamano) + paso));
    setTamano(TAMANOS[i]);
    aplicarTamano(TAMANOS[i]);
  }
  function cerrar() {
    ref.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="no-imprimir fixed bottom-24 right-4 z-20 inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-oro bg-superficie px-5 text-lg font-bold text-primario-oscuro shadow-lg hover:bg-primario-claro md:bottom-6"
        aria-label="Ayuda de esta pantalla"
      >
        <span aria-hidden className="text-2xl">
          ?
        </span>
        Ayuda
      </button>
      <dialog ref={ref} className="m-auto w-[min(94vw,32rem)] rounded-2xl border border-borde bg-superficie p-0 shadow-xl backdrop:bg-black/40" onClick={(e) => e.target === ref.current && cerrar()}>
        <div className="p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-texto-suave">¿Qué hago en esta pantalla?</p>
          <h2 className="mt-1 text-2xl font-bold">{ayuda.titulo}</h2>
          <ol className="mt-3 space-y-3">
            {ayuda.pasos.map((p, i) => (
              <li key={i} className="flex gap-3 text-lg leading-snug">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento text-base font-bold text-white">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          {ayuda.enlaces && ayuda.enlaces.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {ayuda.enlaces.map((e) => (
                <Link key={e.href} href={e.href} onClick={cerrar} className="inline-flex min-h-12 items-center rounded-xl bg-primario px-4 font-semibold text-white">
                  {e.texto}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl bg-fondo p-3">
            <p className="font-semibold">Tamaño de la letra</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => cambiarLetra(-1)} disabled={tamano === ""} className="min-h-12 flex-1 rounded-xl border border-borde bg-superficie text-lg font-bold disabled:opacity-40">
                A−
              </button>
              <span className="min-w-24 text-center text-sm text-texto-suave">{tamano === "" ? "Normal" : tamano === "grande" ? "Grande" : "Muy grande"}</span>
              <button type="button" onClick={() => cambiarLetra(1)} disabled={tamano === "muy-grande"} className="min-h-12 flex-1 rounded-xl border border-borde bg-superficie text-2xl font-bold disabled:opacity-40">
                A+
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/" onClick={cerrar} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-borde bg-superficie px-3 font-semibold hover:bg-primario-claro">
              🏠 Ir al inicio
            </Link>
            <Link href="/ajustes/ayuda" onClick={cerrar} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-borde bg-superficie px-3 font-semibold hover:bg-primario-claro">
              📖 Guía completa
            </Link>
            <button
              type="button"
              onClick={() => {
                // El tutorial escucha el cambio y se muestra sobre esta misma pantalla.
                reiniciarTutorial();
                cerrar();
              }}
              className="col-span-2 min-h-12 rounded-xl border border-borde bg-superficie px-3 font-semibold hover:bg-primario-claro"
            >
              Ver el tutorial paso a paso otra vez
            </button>
          </div>
          <button type="button" onClick={cerrar} className="mt-4 min-h-14 w-full rounded-xl bg-acento text-lg font-bold text-white">
            Entendido
          </button>
        </div>
      </dialog>
    </>
  );
}
