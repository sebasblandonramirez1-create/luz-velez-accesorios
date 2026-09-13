"use client";

import { useState } from "react";
import { Boton } from "./ui";

/** Copia un texto al portapapeles y confirma. */
export function BotonCopiar({ texto, etiqueta = "Copiar texto" }: { texto: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Boton
      variante="secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          window.prompt("Copia el texto:", texto);
        }
      }}
    >
      {copiado ? "¡Copiado!" : etiqueta}
    </Boton>
  );
}

/** Botón que abre el diálogo de impresión (o «Guardar como PDF»). */
export function BotonImprimir({ etiqueta = "Imprimir o guardar PDF" }: { etiqueta?: string }) {
  return (
    <Boton onClick={() => window.print()} className="no-imprimir">
      🖨️ {etiqueta}
    </Boton>
  );
}
