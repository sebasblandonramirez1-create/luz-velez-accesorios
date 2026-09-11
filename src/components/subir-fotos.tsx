"use client";

import { useRef, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { prepararFoto, rutasDeFoto } from "@/lib/fotos";
import { mensajeDeError } from "@/lib/errores";
import { Aviso } from "./ui";

interface FotoSubida {
  ruta: string;
  rutaMiniatura: string;
  vista: string;
}

/**
 * Toma o elige fotos, las comprime y las sube al bucket «fotos» antes de
 * guardar el producto. Deja las rutas en inputs ocultos (foto_ruta / foto_miniatura).
 */
export function SubirFotos({ productoId, maximo = 6 }: { productoId: string; maximo?: number }) {
  const [fotos, setFotos] = useState<FotoSubida[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entradaCamara = useRef<HTMLInputElement>(null);
  const entradaGaleria = useRef<HTMLInputElement>(null);

  async function procesar(lista: FileList | null) {
    if (!lista?.length) return;
    setError(null);
    setOcupado(true);
    try {
      const supabase = clienteNavegador();
      const nuevas: FotoSubida[] = [];
      for (const archivo of Array.from(lista).slice(0, maximo - fotos.length)) {
        const prep = await prepararFoto(archivo);
        const { ruta, rutaMiniatura } = rutasDeFoto(productoId);
        const [r1, r2] = await Promise.all([
          supabase.storage.from("fotos").upload(ruta, prep.archivo, { contentType: "image/jpeg", upsert: false }),
          supabase.storage.from("fotos").upload(rutaMiniatura, prep.miniatura, { contentType: "image/jpeg", upsert: false }),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
        nuevas.push({ ruta, rutaMiniatura, vista: URL.createObjectURL(prep.miniatura) });
      }
      setFotos((f) => [...f, ...nuevas]);
    } catch (e) {
      setError(`No se pudo subir la foto. ${mensajeDeError(e)}`);
    } finally {
      setOcupado(false);
      if (entradaCamara.current) entradaCamara.current.value = "";
      if (entradaGaleria.current) entradaGaleria.current.value = "";
    }
  }

  async function quitar(i: number) {
    const f = fotos[i];
    setFotos((lista) => lista.filter((_, j) => j !== i));
    await clienteNavegador().storage.from("fotos").remove([f.ruta, f.rutaMiniatura]);
  }

  return (
    <div className="space-y-3">
      <span className="block text-sm font-semibold">Fotos</span>
      <div className="flex flex-wrap gap-3">
        {fotos.map((f, i) => (
          <div key={f.ruta} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.vista} alt={`Foto ${i + 1}`} className="h-24 w-24 rounded-xl border border-borde object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-primario px-1.5 text-xs font-semibold text-white">Principal</span>}
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-peligro text-white shadow"
            >
              ×
            </button>
            <input type="hidden" name="foto_ruta" value={f.ruta} />
            <input type="hidden" name="foto_miniatura" value={f.rutaMiniatura} />
          </div>
        ))}
        {fotos.length < maximo && (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => entradaCamara.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primario/40 bg-primario-claro text-sm font-semibold text-primario-oscuro disabled:opacity-60"
            >
              <span className="text-2xl" aria-hidden>
                📷
              </span>
              {ocupado ? "Subiendo…" : "Cámara"}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => entradaGaleria.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-borde bg-superficie text-sm font-semibold text-texto-suave disabled:opacity-60"
            >
              <span className="text-2xl" aria-hidden>
                🖼️
              </span>
              Galería
            </button>
          </>
        )}
      </div>
      <input ref={entradaCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => procesar(e.target.files)} />
      <input ref={entradaGaleria} type="file" accept="image/*" multiple className="hidden" onChange={(e) => procesar(e.target.files)} />
      <p className="text-sm text-texto-suave">Las fotos se reducen automáticamente antes de subirse. La primera es la principal.</p>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  );
}
