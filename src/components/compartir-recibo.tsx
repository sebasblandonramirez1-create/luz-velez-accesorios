"use client";

import { useState } from "react";
import { Boton } from "./ui";
import { asuntoRecibo, nombreArchivoRecibo, type DatosRecibo } from "@/lib/recibo";

async function archivoPdf(datos: DatosRecibo): Promise<File> {
  const { crearPdfRecibo } = await import("@/lib/recibo-pdf");
  const bytes = await crearPdfRecibo(datos);
  return new File([bytes as BlobPart], nombreArchivoRecibo(datos), { type: "application/pdf" });
}

function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Genera el recibo como archivo PDF. «Compartir» abre el menú del celular
 * (WhatsApp, correo, etc.) con el archivo adjunto; si el navegador no lo
 * permite, lo descarga para adjuntarlo a mano.
 */
export function BotonesPdfRecibo({ datos, texto }: { datos: DatosRecibo; texto?: string }) {
  const [ocupado, setOcupado] = useState<"" | "compartir" | "descargar">("");
  const [aviso, setAviso] = useState<string | null>(null);

  async function compartir() {
    setOcupado("compartir");
    setAviso(null);
    try {
      const archivo = await archivoPdf(datos);
      const paquete: ShareData = { files: [archivo], title: asuntoRecibo(datos), text: texto };
      if (typeof navigator.share === "function" && navigator.canShare?.(paquete)) {
        await navigator.share(paquete);
      } else {
        descargar(archivo);
        setAviso("Este navegador no comparte archivos directamente: el PDF se descargó. Adjúntalo desde WhatsApp o el correo.");
      }
    } catch (e) {
      // AbortError: la persona cerró el menú de compartir; no es un error.
      if ((e as Error).name !== "AbortError") setAviso("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setOcupado("");
    }
  }

  async function bajar() {
    setOcupado("descargar");
    setAviso(null);
    try {
      descargar(await archivoPdf(datos));
    } catch {
      setAviso("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setOcupado("");
    }
  }

  return (
    <>
      <Boton variante="primario" onClick={compartir} disabled={ocupado !== ""} className="no-imprimir">
        {ocupado === "compartir" ? "Preparando…" : "Compartir PDF"}
      </Boton>
      <Boton variante="secundario" onClick={bajar} disabled={ocupado !== ""} className="no-imprimir">
        {ocupado === "descargar" ? "Preparando…" : "Descargar PDF"}
      </Boton>
      {aviso && (
        <p role="status" className="no-imprimir basis-full text-sm text-texto-suave">
          {aviso}
        </p>
      )}
    </>
  );
}
