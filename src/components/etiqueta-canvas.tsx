"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ajustarLineas, lineasDeEtiqueta, type ConfiguracionEtiqueta, type ProductoEtiqueta, type TamanoEtiqueta } from "@/lib/etiquetas";

export interface EtiquetaCanvasRef {
  canvas: () => HTMLCanvasElement | null;
}

/** Dibuja la etiqueta en negro sobre blanco al tamaño exacto en píxeles. */
export function dibujarEtiqueta(canvas: HTMLCanvasElement, producto: ProductoEtiqueta, cfg: ConfiguracionEtiqueta, t: TamanoEtiqueta) {
  canvas.width = t.anchoPx;
  canvas.height = t.altoPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, t.anchoPx, t.altoPx);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const margen = Math.max(2, Math.round(t.anchoPx * 0.03));
  const anchoUtil = t.anchoPx - margen * 2;
  const altoUtil = t.altoPx - margen * 2;
  const marca = typeof document !== "undefined" && document.fonts?.check?.("12px Cinzel");
  const fuente = (l: { negrita: boolean; monoespaciada: boolean; tipo?: string }, tam: number) => {
    if (l.tipo === "negocio" && marca) return `600 ${tam}px Cinzel, Georgia, serif`;
    return `${l.negrita ? "bold " : ""}${tam}px ${l.monoespaciada ? "ui-monospace, Menlo, Consolas, monospace" : "Arial, Helvetica, sans-serif"}`;
  };
  const lineas = lineasDeEtiqueta(producto, cfg).map((l) => (l.tipo === "negocio" ? { ...l, texto: l.texto.toUpperCase() } : l));
  const ajuste = ajustarLineas(lineas, anchoUtil, altoUtil, (l, tam) => {
    ctx.font = fuente(l, tam);
    return ctx.measureText(l.texto).width;
  });
  for (const a of ajuste) {
    ctx.font = fuente(a.linea, a.tamano);
    ctx.fillText(a.linea.texto, t.anchoPx / 2, margen + a.y);
  }
}

export const EtiquetaCanvas = forwardRef<EtiquetaCanvasRef, { producto: ProductoEtiqueta; cfg: ConfiguracionEtiqueta; tamano: TamanoEtiqueta; escala?: number; className?: string }>(
  function EtiquetaCanvas({ producto, cfg, tamano, escala = 1, className = "" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useImperativeHandle(ref, () => ({ canvas: () => canvasRef.current }));
    useEffect(() => {
      if (canvasRef.current) dibujarEtiqueta(canvasRef.current, producto, cfg, tamano);
    }, [producto, cfg, tamano]);
    return (
      <canvas
        ref={canvasRef}
        width={tamano.anchoPx}
        height={tamano.altoPx}
        className={`border border-borde bg-white ${className}`}
        style={{ width: tamano.anchoPx * escala, height: tamano.altoPx * escala, imageRendering: "pixelated" }}
        aria-label={`Etiqueta de ${producto.codigo}`}
      />
    );
  },
);
