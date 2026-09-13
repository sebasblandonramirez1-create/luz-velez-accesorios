"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { leerPesos } from "@/lib/formato";

export interface EstadoAbono {
  error?: string;
}

export async function registrarAbonoAccion(_e: EstadoAbono, fd: FormData): Promise<EstadoAbono> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const cuentaId = String(fd.get("cuenta_id") ?? "");
  const valor = leerPesos(String(fd.get("valor") ?? ""));
  const medio = String(fd.get("medio_pago") ?? "efectivo");
  const fechaTexto = String(fd.get("fecha") ?? "");
  const nota = String(fd.get("nota") ?? "").trim();
  const volver = String(fd.get("volver") ?? "/cuentas");
  if (!cuentaId) return { error: "Falta la cuenta." };
  if (!valor || valor <= 0) return { error: "Escribe un valor mayor que cero." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("registrar_abono", {
    p: {
      cuenta_id: cuentaId,
      valor,
      medio_pago: medio,
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) ? new Date(`${fechaTexto}T12:00:00-05:00`).toISOString() : undefined,
      nota,
    },
  });
  if (error) {
    const m = error.message ?? "";
    const x = /ABONO_EXCEDE: el saldo es (\d+)/.exec(m);
    return { error: x ? `El abono supera el saldo (${Number(x[1]).toLocaleString("es-CO")}).` : mensajeDeError(error) };
  }
  revalidatePath("/cuentas");
  revalidatePath("/ventas");
  revalidatePath("/consignaciones");
  revalidatePath("/");
  redirect(volver.startsWith("/") ? `${volver}${volver.includes("?") ? "&" : "?"}aviso=${encodeURIComponent("Abono registrado.")}` : "/cuentas");
}

export async function anularAbono(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const volver = String(fd.get("volver") ?? "/cuentas");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("abonos").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`${volver}?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/cuentas");
  revalidatePath("/ventas");
  revalidatePath("/consignaciones");
  redirect(`${volver}?aviso=${encodeURIComponent("Abono anulado. Puedes restaurarlo desde la papelera.")}`);
}
