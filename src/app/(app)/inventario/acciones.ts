"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { leerPesos } from "@/lib/formato";
import { tiposManuales, type TipoMovimiento } from "@/lib/inventario";

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
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) ? new Date(`${fechaTexto}T12:00:00-05:00`).toISOString() : new Date().toISOString();

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
