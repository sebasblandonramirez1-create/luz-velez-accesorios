"use client";

/**
 * Impresión directa por Bluetooth con la biblioteca abierta @mmote/niimbluelib
 * (MIT, en estado alfa: versión fijada en package.json). Solo funciona en
 * navegadores con Web Bluetooth: Chrome y Edge en Android, Windows, macOS y
 * Linux. No funciona en iPhone ni en Safari.
 *
 * La biblioteca se carga bajo demanda para no pesar en el resto de la app.
 */
import { tamanoParaImpresora, type ConfiguracionEtiqueta, type ProductoEtiqueta, type TamanoEtiqueta } from "./etiquetas";
import { dibujarEtiqueta } from "@/components/etiqueta-canvas";

export interface TrabajoEtiqueta {
  producto: ProductoEtiqueta;
  cantidad: number;
}

export interface EstadoImpresion {
  fase: "conectando" | "imprimiendo" | "listo" | "error";
  mensaje: string;
  pagina?: number;
  total?: number;
}

export function bluetoothDisponible(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Conecta con la impresora (el navegador muestra el selector de dispositivos),
 * imprime la cola y desconecta. `avisar` recibe el progreso.
 */
export async function imprimirPorBluetooth(
  trabajos: TrabajoEtiqueta[],
  cfg: ConfiguracionEtiqueta,
  tamano: TamanoEtiqueta,
  avisar: (e: EstadoImpresion) => void,
  opciones: { tareaForzada?: string; densidad?: number } = {},
): Promise<{ modelo: string; tarea: string }> {
  if (!bluetoothDisponible()) {
    throw new Error("Este navegador no tiene Bluetooth web. Usa Chrome o Edge en Android o en computador, o descarga las etiquetas en PNG.");
  }
  const lib = await import("@mmote/niimbluelib");
  const client = new lib.NiimbotBluetoothClient();
  avisar({ fase: "conectando", mensaje: "Elige la impresora en la ventana del navegador…" });
  let tarea = "";
  let modelo = "desconocido";
  try {
    const info = await client.connect();
    const meta = client.getModelMetadata();
    modelo = meta?.model ?? info.deviceName ?? "desconocido";
    const protocolo = client.getPrinterInfo()?.protocolVersion;
    tarea = opciones.tareaForzada || (meta ? (lib.findPrintTask(meta.model, protocolo) ?? "") : "");
    if (!tarea) {
      throw new Error(`No sé cómo imprimir en el modelo ${modelo}. Elige el tipo de impresión a mano o usa las etiquetas en PNG.`);
    }
    const direccion = meta?.printDirection ?? "left";
    const densidad = opciones.densidad ?? meta?.densityDefault ?? 2;
    // Recorta al cabezal y usa los DPI reales del modelo detectado.
    const tamanoReal = meta ? tamanoParaImpresora(tamano, meta.model) : tamano;
    const totalPaginas = trabajos.reduce((s, t) => s + t.cantidad, 0);
    avisar({ fase: "imprimiendo", mensaje: `Conectada a ${modelo}. Imprimiendo…`, pagina: 0, total: totalPaginas });

    client.on("printprogress", (e) => {
      avisar({ fase: "imprimiendo", mensaje: `Imprimiendo etiqueta ${e.page} de ${e.pagesTotal} (${e.pagePrintProgress}%)`, pagina: e.page, total: e.pagesTotal });
    });

    const printTask = client.protocol.newPrintTask(tarea as never, {
      totalPages: totalPaginas,
      density: densidad,
      labelType: lib.LabelType.WithGaps,
      pageColor: lib.PageColorType.SingleColor,
    });
    await printTask.printInit();
    const canvas = document.createElement("canvas");
    for (const trabajo of trabajos) {
      dibujarEtiqueta(canvas, trabajo.producto, cfg, tamanoReal);
      const imagen = lib.ImageEncoder.encodeCanvas(canvas, lib.PageColorType.SingleColor, direccion);
      await printTask.printPage(imagen, trabajo.cantidad);
      await printTask.waitForPageFinished();
    }
    await printTask.waitForFinished();
    avisar({ fase: "listo", mensaje: `Listo: ${totalPaginas} etiquetas enviadas a ${modelo}.`, pagina: totalPaginas, total: totalPaginas });
    return { modelo, tarea };
  } finally {
    try {
      await client.protocol.printEnd();
    } catch {}
    try {
      await client.disconnect();
    } catch {}
  }
}

/** Nombres de tarea de impresión que ofrece la biblioteca (para el selector manual). */
export async function tareasDisponibles(): Promise<string[]> {
  const lib = await import("@mmote/niimbluelib");
  return [...lib.printTaskNames];
}
