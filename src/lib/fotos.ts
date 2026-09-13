"use client";

/**
 * Compresión de fotos en el navegador antes de subirlas: máximo 1.200 px de
 * lado y menos de 300 KB, más una miniatura de 320 px. Todo en JPEG.
 */
import imageCompression from "browser-image-compression";

export interface FotoPreparada {
  archivo: File;
  miniatura: File;
  ancho: number;
  alto: number;
}

async function dimensiones(archivo: File): Promise<{ ancho: number; alto: number }> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const i = new Image();
      i.onload = () => resolver(i);
      i.onerror = () => rechazar(new Error("No se pudo leer la imagen"));
      i.src = url;
    });
    return { ancho: img.naturalWidth, alto: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepararFoto(original: File): Promise<FotoPreparada> {
  const archivo = await imageCompression(original, {
    maxSizeMB: 0.29,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });
  const miniatura = await imageCompression(original, {
    maxSizeMB: 0.05,
    maxWidthOrHeight: 320,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  });
  const { ancho, alto } = await dimensiones(archivo);
  return {
    archivo: new File([archivo], "foto.jpg", { type: "image/jpeg" }),
    miniatura: new File([miniatura], "miniatura.jpg", { type: "image/jpeg" }),
    ancho,
    alto,
  };
}

/** Rutas en el bucket «fotos»: <carpeta>/<id>/<marca>.jpg y …_mini.jpg */
export function rutasDeFoto(id: string, carpeta: "productos" | "gastos" = "productos"): { ruta: string; rutaMiniatura: string } {
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ruta: `${carpeta}/${id}/${marca}.jpg`,
    rutaMiniatura: `${carpeta}/${id}/${marca}_mini.jpg`,
  };
}
