"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { hoyIso } from "@/lib/formato";
import { mensajeErrorModificacion } from "@/lib/modificaciones";

const esquemaConsignacion = z.object({
  contacto_id: z.string().uuid("Elige la vendedora."),
  fecha_entrega: z.string().optional(),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisa la fecha límite.").optional().or(z.literal("")),
  nota: z.string().default(""),
  lineas: z.array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive(), valor_unitario: z.number().int().min(0) })).min(1, "Añade al menos un producto."),
});
export type DatosConsignacion = z.infer<typeof esquemaConsignacion>;

const esquemaLiquidacion = z.object({
  consignacion_id: z.string().uuid(),
  fecha: z.string().optional(),
  nota: z.string().default(""),
  abono: z.number().int().min(0),
  medio_pago: z.enum(["efectivo", "transferencia", "nequi", "daviplata", "tarjeta", "otro"]),
  lineas: z.array(z.object({ consignacion_linea_id: z.string().uuid(), cantidad_vendida: z.number().int().min(0), cantidad_devuelta: z.number().int().min(0) })),
});
export type DatosLiquidacion = z.infer<typeof esquemaLiquidacion>;

const esquemaModificacion = z.object({
  consignacion_id: z.string().uuid(),
  motivo: z.string().trim().max(500, "El motivo es demasiado largo.").default(""),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisa la fecha límite.").optional().or(z.literal("")),
  nota: z.string().default(""),
  lineas: z.array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive("Las cantidades deben ser enteros mayores que cero."), valor_unitario: z.number().int().min(0) })).min(1, "La entrega debe quedar con al menos una pieza."),
});
export type DatosModificacion = z.input<typeof esquemaModificacion>;

/** Fecha de un <input type="date">: si es hoy se usa la hora real; si es otro día, el mediodía en Bogotá. */
function fechaIso(texto?: string) {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return undefined;
  if (texto === hoyIso()) return undefined;
  return new Date(`${texto}T12:00:00-05:00`).toISOString();
}

function revalidar(id?: string) {
  revalidatePath("/consignaciones");
  if (id) revalidatePath(`/consignaciones/${id}`);
  revalidatePath("/productos");
  revalidatePath("/inventario");
  revalidatePath("/cuentas");
  revalidatePath("/contactos");
  revalidatePath("/");
}

export async function registrarConsignacion(datos: DatosConsignacion): Promise<{ id?: string; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const v = esquemaConsignacion.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("registrar_consignacion", { p: { ...v.data, fecha_entrega: fechaIso(v.data.fecha_entrega), fecha_limite: v.data.fecha_limite || undefined } });
  if (error) return { error: traducir(error) };
  revalidar();
  return { id: data as string };
}

export async function registrarLiquidacion(datos: DatosLiquidacion): Promise<{ id?: string; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const v = esquemaLiquidacion.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("registrar_liquidacion", { p: { ...v.data, fecha: fechaIso(v.data.fecha) } });
  if (error) return { error: traducir(error) };
  revalidar(v.data.consignacion_id);
  return { id: data as string };
}

export async function enviarConsignacionAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("consignaciones").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/consignaciones/${id}?error=${encodeURIComponent(traducir(error))}`);
  revalidar(id);
  redirect("/consignaciones?aviso=" + encodeURIComponent("Entrega anulada: los productos volvieron al inventario."));
}

export async function anularLiquidacion(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const consignacionId = String(fd.get("consignacion_id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("liquidaciones").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/consignaciones/${consignacionId}?error=${encodeURIComponent(traducir(error))}`);
  revalidar(consignacionId);
  redirect(`/consignaciones/${consignacionId}?aviso=${encodeURIComponent("Liquidación anulada: las cantidades y las devoluciones se deshicieron.")}`);
}

/**
 * Modifica una entrega sin liquidarla: añade o retira piezas, cambia cantidades,
 * valores, la fecha límite y la nota. La base de datos ajusta el inventario y
 * escribe el registro de la modificación en la misma transacción.
 */
export async function modificarConsignacion(datos: DatosModificacion): Promise<{ ok?: true; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const v = esquemaModificacion.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await clienteServidor();
  const { fecha_limite, ...resto } = v.data;
  const { error } = await supabase.rpc("modificar_consignacion", { p: fecha_limite ? { ...resto, fecha_limite } : resto });
  if (error) return { error: traducir(error) };
  revalidar(v.data.consignacion_id);
  return { ok: true };
}

/** Genera (o renueva) el enlace para que quien recibe firme el recibo. */
export async function pedirFirmaConsignacion(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("preparar_firma_consignacion", { p_consignacion: id });
  if (error) redirect(`/consignaciones/${id}?error=${encodeURIComponent(traducir(error))}#recibo`);
  revalidatePath(`/consignaciones/${id}`);
  redirect(`/consignaciones/${id}?aviso=${encodeURIComponent("Enlace de firma listo. Envíalo por WhatsApp o por correo.")}#recibo`);
}

/** Anula la firma o el enlace pendiente (solo la propietaria). */
export async function anularFirmaConsignacion(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("anular_firma_consignacion", { p_consignacion: id });
  if (error) redirect(`/consignaciones/${id}?error=${encodeURIComponent(traducir(error))}#recibo`);
  revalidatePath(`/consignaciones/${id}`);
  redirect(`/consignaciones/${id}?aviso=${encodeURIComponent("Firma anulada. Puedes pedirla de nuevo.")}#recibo`);
}

function traducir(error: unknown): string {
  const m = (error as { message?: string })?.message ?? "";
  const deModificacion = mensajeErrorModificacion(m);
  if (deModificacion) return deModificacion;
  if (/FECHA_LIMITE_INVALIDA/.test(m)) return "La fecha límite no puede ser anterior a la fecha de entrega.";
  if (/RECIBO_YA_FIRMADO/.test(m)) return "Este recibo ya está firmado. Para pedir otra firma, la propietaria debe anular la actual.";
  if (/RECIBO_NO_ENCONTRADO/.test(m)) return "La entrega no existe o fue anulada.";
  if (/CONSIGNACION_SIN_LINEAS/.test(m)) return "Añade al menos un producto.";
  if (/LIQUIDACION_VACIA/.test(m)) return "Marca al menos una pieza vendida o devuelta, o registra un abono.";
  if (/CONSIGNACION_CON_LIQUIDACIONES/.test(m)) return "Esta entrega ya tiene liquidaciones. Anula primero las liquidaciones.";
  const x = /LIQUIDACION_EXCEDE: quedan (\d+) pendientes y se intentan liquidar (\d+)/.exec(m);
  if (x) return `Solo quedan ${x[1]} piezas pendientes y se intentan liquidar ${x[2]}.`;
  return mensajeDeError(error);
}
