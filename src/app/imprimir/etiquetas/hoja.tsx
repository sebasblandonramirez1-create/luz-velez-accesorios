"use client";

import { EtiquetaCanvas } from "@/components/etiqueta-canvas";
import { tamanoEtiqueta, type ConfiguracionEtiqueta, type ProductoEtiqueta } from "@/lib/etiquetas";

/** Cuadrícula de etiquetas al tamaño físico (mm) para imprimir en hoja. */
export function HojaEtiquetas({ items, cfg, tamanoMm, dpi }: { items: { producto: ProductoEtiqueta; cantidad: number }[]; cfg: ConfiguracionEtiqueta; tamanoMm: { ancho: number; alto: number }; dpi: number }) {
  // Se dibuja a resolución doble para que se vea nítida en papel.
  const t = tamanoEtiqueta(tamanoMm.ancho, tamanoMm.alto, Math.max(dpi, 300));
  const lista = items.flatMap((i) => Array.from({ length: i.cantidad }, (_, k) => ({ key: `${i.producto.codigo}-${k}`, producto: i.producto })));
  if (lista.length === 0) return <p className="text-gray-600">No hay etiquetas para imprimir.</p>;
  return (
    <div className="flex flex-wrap gap-[2mm]">
      {lista.map((x) => (
        <div key={x.key} style={{ width: `${tamanoMm.ancho}mm`, height: `${tamanoMm.alto}mm` }} className="break-inside-avoid">
          <EtiquetaCanvas producto={x.producto} cfg={cfg} tamano={t} className="!h-full !w-full" />
        </div>
      ))}
    </div>
  );
}
