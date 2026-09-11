"use client";

import { useRef, useState, type ReactNode } from "react";
import { Boton } from "./ui";

/**
 * Botón que pide confirmación antes de una acción destructiva. Usa <dialog>
 * nativo; `accion` es una Server Action que recibe FormData.
 */
export function BotonConfirmar({
  accion,
  titulo,
  texto,
  confirmar = "Sí, continuar",
  variante = "peligro",
  campos,
  children,
  className = "",
}: {
  accion: (datos: FormData) => void | Promise<void>;
  titulo: string;
  texto: string;
  confirmar?: string;
  variante?: "peligro" | "primario" | "secundario";
  campos?: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <>
      <Boton variante={variante === "peligro" ? "secundario" : variante} className={className} onClick={() => ref.current?.showModal()}>
        {children}
      </Boton>
      <dialog
        ref={ref}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-borde bg-superficie p-6 shadow-xl backdrop:bg-black/40"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <h2 className="text-xl font-bold">{titulo}</h2>
        <p className="mt-2 text-texto-suave">{texto}</p>
        <form
          action={async (fd) => {
            setEnviando(true);
            try {
              await accion(fd);
            } finally {
              setEnviando(false);
              ref.current?.close();
            }
          }}
          className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        >
          {campos && Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Boton variante="secundario" onClick={() => ref.current?.close()} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" variante={variante} disabled={enviando}>
            {enviando ? "Un momento…" : confirmar}
          </Boton>
        </form>
      </dialog>
    </>
  );
}
