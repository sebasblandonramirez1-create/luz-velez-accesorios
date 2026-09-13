import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import type { LineaEtiqueta } from "@/lib/etiquetas";
import { Etiquetadora } from "./etiquetadora";

export const metadata = { title: "Imprimir etiquetas" };

export default async function PaginaEtiquetas({ searchParams }: PageProps<"/etiquetas">) {
  const p = await searchParams;
  const preseleccion = typeof p.producto === "string" ? p.producto : "";
  const supabase = await clienteServidor();
  const [{ data: ajustes }, { data: productos }] = await Promise.all([
    supabase.from("ajustes").select("nombre_negocio, impresora_modelo, etiqueta_ancho_mm, etiqueta_alto_mm, etiqueta_dpi, etiqueta_mostrar_precio_miles, etiqueta_lineas").eq("id", 1).single(),
    supabase.from("productos").select("id, codigo, nombre, precio_base, precio_publico, stock_actual, producto_fotos(ruta_miniatura, principal)").is("eliminado_en", null).eq("activo", true).order("codigo"),
  ]);
  if (!ajustes) throw new Error("No se pudieron cargar los ajustes.");

  return (
    <div>
      <Encabezado titulo="Imprimir etiquetas" volver="/" subtitulo="Elige productos y cuántas etiquetas de cada uno. Luego imprime por Bluetooth, descarga PNG para la app NIIMBOT o una hoja PDF." />
      <Etiquetadora
        cfg={{
          nombre_negocio: ajustes.nombre_negocio,
          etiqueta_lineas: (ajustes.etiqueta_lineas as LineaEtiqueta[]) ?? [],
          etiqueta_mostrar_precio_miles: ajustes.etiqueta_mostrar_precio_miles,
        }}
        impresora={{ modelo: ajustes.impresora_modelo, anchoMm: Number(ajustes.etiqueta_ancho_mm), altoMm: Number(ajustes.etiqueta_alto_mm), dpi: ajustes.etiqueta_dpi }}
        productos={(productos ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigo,
          nombre: x.nombre,
          precio_base: x.precio_base,
          precio_publico: x.precio_publico,
          stock_actual: x.stock_actual,
          miniatura: x.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? x.producto_fotos?.[0]?.ruta_miniatura ?? null,
        }))}
        preseleccion={preseleccion}
      />
    </div>
  );
}
