"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";

const esquemaFila = z.object({
  codigo: z.string().regex(/^[A-Z0-9-]{2,20}$/),
  nombre: z.string().trim().min(1),
  categoria: z.enum(["areta", "collar", "pulsera", "anillo", "otro"]),
  subcategoria: z.string().default(""),
  material: z.string().default(""),
  color: z.string().default(""),
  precio_base: z.number().int().min(0),
  precio_publico: z.number().int().min(0),
  precio_mayorista: z.number().int().min(0).nullable(),
  costo_compra: z.number().int().min(0).nullable(),
  stock_inicial: z.number().int().min(0),
  stock_minimo: z.number().int().min(0).nullable(),
  notas: z.string().default(""),
});

export type FilaImportacion = z.infer<typeof esquemaFila>;

export async function importarProductos(filas: FilaImportacion[]): Promise<{ importados: number; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { importados: 0, error: "Tu sesión venció. Vuelve a entrar." };
  const validas = z.array(esquemaFila).max(2000).safeParse(filas);
  if (!validas.success) return { importados: 0, error: "Alguna fila tiene datos inválidos. Revisa la vista previa." };
  if (validas.data.length === 0) return { importados: 0, error: "No hay filas para importar." };

  const supabase = await clienteServidor();
  const { data: ajustes } = await supabase.from("ajustes").select("stock_minimo_predeterminado").eq("id", 1).single();
  const minimo = ajustes?.stock_minimo_predeterminado ?? 2;

  const { data: creados, error } = await supabase
    .from("productos")
    .insert(
      // stock_inicial no es columna: se registra aparte como movimiento de entrada.
      validas.data.map(({ stock_inicial: _stock, stock_minimo, ...p }) => ({
        ...p,
        stock_minimo: stock_minimo ?? minimo,
        creado_por: sesion.id,
      })),
    )
    .select("id, codigo");
  if (error || !creados) return { importados: 0, error: mensajeDeError(error) };

  const porCodigo = new Map(creados.map((c) => [c.codigo, c.id]));
  const entradas = validas.data
    .filter((f) => f.stock_inicial > 0 && porCodigo.has(f.codigo))
    .map((f) => ({
      tipo: "entrada_compra" as const,
      producto_id: porCodigo.get(f.codigo)!,
      cantidad: f.stock_inicial,
      valor_unitario: f.costo_compra ?? f.precio_base,
      nota: "Inventario inicial (importación)",
      registrado_por: sesion.id,
    }));
  if (entradas.length) {
    const { error: e2 } = await supabase.from("movimientos_inventario").insert(entradas);
    if (e2) return { importados: creados.length, error: `Se crearon los productos, pero falló el inventario inicial: ${mensajeDeError(e2)}` };
  }

  revalidatePath("/productos");
  revalidatePath("/inventario");
  revalidatePath("/");
  return { importados: creados.length };
}
