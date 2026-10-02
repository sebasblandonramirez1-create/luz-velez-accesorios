"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { clienteAnonimo } from "@/lib/supabase/anonimo";
import { mensajeErrorFirma, validarDatosFirma, type DatosFirma } from "@/lib/recibo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Firma el recibo con el enlace. No requiere cuenta: el enlace (token) es la
 * llave, y la base de datos solo deja firmar una vez mientras esté vigente.
 * Se guardan la IP y el navegador como evidencia de la firma.
 */
export async function firmarRecibo(token: string, datos: DatosFirma): Promise<{ ok?: true; error?: string }> {
  if (!UUID.test(token)) return { error: "El enlace no es válido." };
  const problema = validarDatosFirma(datos);
  if (problema) return { error: problema };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const agente = h.get("user-agent") ?? "";
  try {
    const { error } = await clienteAnonimo().rpc("firmar_recibo_consignacion", {
      p_token: token,
      p: { ...datos, nombre: datos.nombre.trim(), documento: datos.documento.trim(), ip, agente },
    });
    if (error) return { error: mensajeErrorFirma(error.message) };
  } catch (e) {
    return { error: mensajeErrorFirma((e as Error).message) };
  }
  revalidatePath(`/firmar/${token}`);
  return { ok: true };
}
