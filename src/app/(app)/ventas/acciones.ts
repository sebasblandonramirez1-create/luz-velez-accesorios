"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { hoyIso } from "@/lib/formato";

const esquemaVenta = z.object({
  fecha: z.string().optional(),
  contacto_id: z.string().uuid().nullable(),
  descuento_total: z.number().int().min(0),
  medio_pago: z.enum(["efectivo", "transferencia", "nequi", "daviplata", "tarjeta", "otro"]),
  estado_pago: z.enum(["pagada", "abono", "pendiente"]),
  abono: z.number().int().min(0),
  nota: z.string().default(""),
  lineas: z
    .array(
      z.object({
        producto_id: z.string().uuid(),
        cantidad: z.number().int().positive(),
        precio_unitario: z.number().int().min(0),
        descuento: z.number().int().min(0),
      }),
    )
    .min(1, "Añade al menos un producto."),
});

export type DatosVenta = z.infer<typeof esquemaVenta>;

/** Fecha de un <input type="date">: si es hoy se usa la hora real; si es otro día, el mediodía en Bogotá. */
function fechaDesdeFormulario(texto?: string | null): string | undefined {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return undefined;
  if (texto === hoyIso()) return undefined;
  return new Date(`${texto}T12:00:00-05:00`).toISOString();
}


export async function registrarVenta(datos: DatosVenta): Promise<{ id?: string; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const v = esquemaVenta.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Revisa los datos de la venta." };
  const supabase = await clienteServidor();
  const p = { ...v.data, fecha: fechaDesdeFormulario(v.data.fecha) };
  const { data, error } = await supabase.rpc("registrar_venta", { p });
  if (error) return { error: traducir(error) };
  revalidatePath("/ventas");
  revalidatePath("/productos");
  revalidatePath("/inventario");
  revalidatePath("/cuentas");
  revalidatePath("/");
  return { id: data as string };
}

export async function enviarVentaAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ventas").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/ventas/${id}?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/ventas");
  revalidatePath("/productos");
  revalidatePath("/cuentas");
  revalidatePath("/");
  redirect("/ventas?aviso=" + encodeURIComponent("Venta anulada: el inventario volvió y la cuenta se cerró. Puedes restaurarla desde la papelera."));
}

function traducir(error: unknown): string {
  const m = (error as { message?: string })?.message ?? "";
  if (/VENTA_SIN_LINEAS/.test(m)) return "Añade al menos un producto.";
  if (/VENTA_PENDIENTE_SIN_CONTACTO/.test(m)) return "Para dejar saldo pendiente hay que elegir la clienta.";
  return mensajeDeError(error);
}
