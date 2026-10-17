"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { hoyIso, leerPesos } from "@/lib/formato";
import { tiposManuales, type TipoMovimiento } from "@/lib/inventario";
import { z } from "zod";
import { TIPOS_ENTRADA } from "@/lib/entradas";

export interface EstadoMovimiento {
  error?: string;
}

export async function registrarMovimiento(_estado: EstadoMovimiento, fd: FormData): Promise<EstadoMovimiento> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };

  const productoId = String(fd.get("producto_id") ?? "");
  const tipo = String(fd.get("tipo") ?? "") as TipoMovimiento;
  const cantidad = Number.parseInt(String(fd.get("cantidad") ?? ""), 10);
  const valorUnitario = leerPesos(String(fd.get("valor_unitario") ?? "")) ?? 0;
  const fechaTexto = String(fd.get("fecha") ?? "");
  const nota = String(fd.get("nota") ?? "").trim();

  if (!productoId) return { error: "Elige un producto." };
  if (!tiposManuales().includes(tipo)) return { error: "Elige el tipo de movimiento." };
  if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: "La cantidad debe ser un número entero mayor que cero." };

  // La fecha del formulario es del día (aaaa-mm-dd) en Bogotá; se guarda al mediodía local para evitar saltos de día.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) && fechaTexto !== hoyIso() ? new Date(`${fechaTexto}T12:00:00-05:00`).toISOString() : new Date().toISOString();

  const supabase = await clienteServidor();
  const { error } = await supabase.from("movimientos_inventario").insert({
    tipo,
    producto_id: productoId,
    cantidad,
    valor_unitario: valorUnitario,
    fecha,
    nota,
    registrado_por: sesion.id,
  });
  if (error) return { error: mensajeDeError(error) };

  // Si es una compra con costo, actualizar el costo de compra del producto.
  if (tipo === "entrada_compra" && valorUnitario > 0) {
    await supabase.from("productos").update({ costo_compra: valorUnitario }).eq("id", productoId);
  }

  revalidatePath("/inventario");
  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos");
  revalidatePath("/");
  redirect(`/productos/${productoId}`);
}

const esquemaEntradas = z.object({
  tipo: z.enum(Object.keys(TIPOS_ENTRADA) as [string, ...string[]]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisa la fecha.").optional().or(z.literal("")),
  nota: z.string().trim().max(500).default(""),
  lineas: z
    .array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive().max(100000), valor_unitario: z.number().int().min(0) }))
    .min(1, "Escribe la cantidad que entra de al menos un producto.")
    .max(500, "Son demasiados productos para una sola entrada: hazla en dos partes."),
});
export type DatosEntradas = z.input<typeof esquemaEntradas>;

/**
 * Registra la entrada de varios productos al stock en una sola inserción (una
 * transacción): si falla uno, no entra ninguno. Con «entrada por compra», el
 * costo de cada producto se actualiza con el costo por unidad indicado.
 */
export async function registrarEntradas(datos: DatosEntradas): Promise<{ registrados?: number; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const v = esquemaEntradas.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Revisa los datos." };
  const ids = v.data.lineas.map((l) => l.producto_id);
  if (new Set(ids).size !== ids.length) return { error: "Un producto aparece dos veces." };
  const tipo = v.data.tipo as TipoMovimiento;
  const fecha = v.data.fecha && v.data.fecha !== hoyIso() ? new Date(`${v.data.fecha}T12:00:00-05:00`).toISOString() : new Date().toISOString();
  const nota = v.data.nota || (tipo === "entrada_compra" ? "Entrada de varios productos" : "Ajuste de varios productos");

  const supabase = await clienteServidor();
  const { error, data } = await supabase
    .from("movimientos_inventario")
    .insert(v.data.lineas.map((l) => ({ tipo, producto_id: l.producto_id, cantidad: l.cantidad, valor_unitario: l.valor_unitario, fecha, nota, registrado_por: sesion.id })))
    .select("id");
  if (error) return { error: mensajeDeError(error) };

  if (tipo === "entrada_compra") {
    await Promise.all(v.data.lineas.filter((l) => l.valor_unitario > 0).map((l) => supabase.from("productos").update({ costo_compra: l.valor_unitario }).eq("id", l.producto_id)));
  }
  revalidatePath("/inventario");
  revalidatePath("/productos");
  revalidatePath("/");
  for (const id of ids) revalidatePath(`/productos/${id}`);
  return { registrados: data?.length ?? ids.length };
}

export async function enviarMovimientoAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { data: mov } = await supabase.from("movimientos_inventario").select("producto_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("movimientos_inventario").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/inventario?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/inventario");
  if (mov) revalidatePath(`/productos/${mov.producto_id}`);
  revalidatePath("/");
  redirect("/inventario?aviso=" + encodeURIComponent("Movimiento enviado a la papelera. El stock se recalculó."));
}
