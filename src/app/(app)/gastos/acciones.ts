"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { hoyIso, leerPesos } from "@/lib/formato";

export interface EstadoGasto {
  error?: string;
}

const esquema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  categoria: z.enum(["compra_mercancia", "empaques", "transporte", "comisiones", "publicidad", "otros"]),
  valor: z.number().int().positive("Escribe el valor del gasto."),
  medio_pago: z.enum(["efectivo", "transferencia", "nequi", "daviplata", "tarjeta", "otro"]),
  proveedor_id: z.string().uuid().nullable(),
  foto_soporte: z.string().nullable(),
  nota: z.string().trim().default(""),
});

function revalidar() {
  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/reportes");
  revalidatePath("/");
}

export async function guardarGasto(_e: EstadoGasto, fd: FormData): Promise<EstadoGasto> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  if (sesion.perfil.rol !== "propietaria") return { error: "Solo la propietaria registra gastos." };
  const t = (k: string) => String(fd.get(k) ?? "");
  const datos = esquema.safeParse({
    fecha: t("fecha"),
    categoria: t("categoria"),
    valor: leerPesos(t("valor")) ?? 0,
    medio_pago: t("medio_pago") || "efectivo",
    proveedor_id: t("proveedor_id") || null,
    foto_soporte: t("foto_ruta") || t("foto_actual") || null,
    nota: t("nota"),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const id = t("id");
  const fecha = datos.data.fecha === hoyIso() && !id ? new Date().toISOString() : new Date(`${datos.data.fecha}T12:00:00-05:00`).toISOString();
  const supabase = await clienteServidor();
  const fila = { ...datos.data, fecha };
  const { error } = id
    ? await supabase.from("gastos").update(fila).eq("id", id)
    : await supabase.from("gastos").insert({ ...fila, registrado_por: sesion.id });
  if (error) return { error: mensajeDeError(error) };
  revalidar();
  redirect("/gastos?aviso=" + encodeURIComponent(id ? "Gasto actualizado." : "Gasto registrado."));
}

export async function enviarGastoAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("gastos").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/gastos/${id}?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidar();
  redirect("/gastos?aviso=" + encodeURIComponent("Gasto enviado a la papelera."));
}
