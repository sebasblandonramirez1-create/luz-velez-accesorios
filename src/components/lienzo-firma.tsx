"use client";

import { useEffect, useRef, useState } from "react";

const ANCHO = 640;
const ALTO = 220;

/**
 * Recuadro para firmar con el dedo, el lápiz o el ratón. Entrega la firma como
 * PNG (data URL) con fondo transparente, o null si está vacío.
 */
export function LienzoFirma({ onCambio, deshabilitado = false }: { onCambio: (firma: string | null) => void; deshabilitado?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const trazos = useRef(0);
  const [vacio, setVacio] = useState(true);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a2433";
  }, []);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const lienzo = ref.current!;
    const r = lienzo.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ANCHO, y: ((e.clientY - r.top) / r.height) * ALTO };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (deshabilitado) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    dibujando.current = true;
    ultimo.current = punto(e);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || !ultimo.current) return;
    e.preventDefault();
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    trazos.current += Math.hypot(p.x - ultimo.current.x, p.y - ultimo.current.y);
    ultimo.current = p;
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    ultimo.current = null;
    // Un punto suelto o un toque accidental no cuenta como firma.
    if (trazos.current > 60 && ref.current) {
      setVacio(false);
      onCambio(ref.current.toDataURL("image/png"));
    }
  }

  function borrar() {
    const lienzo = ref.current;
    lienzo?.getContext("2d")?.clearRect(0, 0, ANCHO, ALTO);
    trazos.current = 0;
    setVacio(true);
    onCambio(null);
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-borde bg-white">
        <canvas
          ref={ref}
          width={ANCHO}
          height={ALTO}
          className="block w-full touch-none rounded-xl"
          style={{ aspectRatio: `${ANCHO} / ${ALTO}` }}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          onPointerLeave={terminar}
          role="img"
          aria-label="Recuadro para dibujar la firma"
        />
        {vacio && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-400">Firma aquí con el dedo</p>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-gray-300" aria-hidden />
      </div>
      <div className="mt-1 flex justify-end">
        <button type="button" onClick={borrar} disabled={vacio || deshabilitado} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-primario disabled:opacity-40">
          Borrar y firmar de nuevo
        </button>
      </div>
    </div>
  );
}
