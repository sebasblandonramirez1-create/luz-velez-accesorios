"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { hoyIso } from "@/lib/formato";

const esquema = z.object({
  proveedor_id: z.string().uuid().nullable(),
  fecha: z.string().optional(),
  medio_pago: z.enum(["efectivo", "transferencia", "nequi", "daviplata", "tarjeta", "otro"]),
  nota: z.string().default(""),
  lineas: z.array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive(), costo_unitario: z.number().int().min(0) })).min(1, "Añade al menos un producto."),
});
export type DatosCompra = z.infer<typeof esquema>;

function revalidar(id?: string) {
  revalidatePath("/compras");
  if (id) revalidatePath(`/compras/${id}`);
  revalidatePath("/gastos");
  revalidatePath("/productos");
  revalidatePath("/inventario");
  revalidatePath("/caja");
  revalidatePath("/reportes");
  revalidatePath("/");
}

export async function registrarCompra(datos: DatosCompra): Promise<{ id?: string; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const v = esquema.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Revisa los datos." };
  const fecha = v.data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(v.data.fecha) && v.data.fecha !== hoyIso() ? new Date(`${v.data.fecha}T12:00:00-05:00`).toISOString() : undefined;
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("registrar_compra", { p: { ...v.data, fecha } });
  if (error) return { error: traducir(error) };
  revalidar();
  return { id: data as string };
}

export async function enviarCompraAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("compras").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/compras/${id}?error=${encodeURIComponent(traducir(error))}`);
  revalidar(id);
  redirect("/compras?aviso=" + encodeURIComponent("Compra anulada: las entradas de inventario y el gasto se anularon."));
}

function traducir(error: unknown): string {
  const m = (error as { message?: string })?.message ?? "";
  if (/COMPRA_SIN_LINEAS/.test(m)) return "Añade al menos un producto.";
  if (/SIN_PERMISO/.test(m)) return "Solo la propietaria registra compras.";
  const x = /COMPRA_YA_VENDIDA: de (\S+) quedan (\d+) en inventario y la compra trajo (\d+)/.exec(m);
  if (x) return `No se puede anular: de ${x[1]} ya se vendieron o entregaron piezas de esta compra (quedan ${x[2]} y la compra trajo ${x[3]}).`;
  return mensajeDeError(error);
}
