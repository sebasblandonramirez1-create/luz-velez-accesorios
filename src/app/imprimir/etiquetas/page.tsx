import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonImprimir } from "@/components/copiar";
import type { LineaEtiqueta } from "@/lib/etiquetas";
import { HojaEtiquetas } from "./hoja";

/** Hoja de etiquetas para impresoras convencionales (se imprime o se guarda como PDF). */
export default async function ImprimirEtiquetas({ searchParams }: PageProps<"/imprimir/etiquetas">) {
  const sp = await searchParams;
  const entradas = (Array.isArray(sp.e) ? sp.e : sp.e ? [sp.e] : []).map((x) => {
    const [id, cant] = String(x).split(":");
    return { id, cantidad: Math.max(1, Math.min(200, Number.parseInt(cant ?? "1", 10) || 1)) };
  });
  const supabase = await clienteServidor();
  const [{ data: ajustes }, { data: productos }] = await Promise.all([
    supabase.from("ajustes").select("nombre_negocio, etiqueta_ancho_mm, etiqueta_alto_mm, etiqueta_dpi, etiqueta_mostrar_precio_miles, etiqueta_lineas").eq("id", 1).single(),
    entradas.length
      ? supabase.from("productos").select("id, codigo, nombre, precio_base, precio_publico").in("id", entradas.map((e) => e.id))
      : Promise.resolve({ data: [] as { id: string; codigo: string; nombre: string; precio_base: number; precio_publico: number }[] }),
  ]);
  if (!ajustes) return null;
  const items = entradas.flatMap((e) => {
    const p = (productos ?? []).find((x) => x.id === e.id);
    return p ? [{ producto: p, cantidad: e.cantidad }] : [];
  });

  return (
    <div>
      <div className="no-imprimir mb-4 flex items-center justify-between gap-2">
        <Link href="/etiquetas" className="font-semibold text-primario">
          ← Volver
        </Link>
        <BotonImprimir etiqueta="Imprimir o guardar PDF" />
      </div>
      <p className="no-imprimir mb-4 text-sm text-gray-600">Al imprimir, desactiva «Ajustar a la página» y usa escala 100% para que las etiquetas midan lo indicado. Puedes usar hojas adhesivas y recortar.</p>
      <HojaEtiquetas
        items={items}
        cfg={{ nombre_negocio: ajustes.nombre_negocio, etiqueta_lineas: (ajustes.etiqueta_lineas as LineaEtiqueta[]) ?? [], etiqueta_mostrar_precio_miles: ajustes.etiqueta_mostrar_precio_miles }}
        tamanoMm={{ ancho: Number(ajustes.etiqueta_ancho_mm), alto: Number(ajustes.etiqueta_alto_mm) }}
        dpi={ajustes.etiqueta_dpi}
      />
    </div>
  );
}
