import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Destino de los enlaces de correo (enlace mágico, invitación, cambio de
 * contraseña). Intercambia el código por una sesión y redirige.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get("code");
  const siguiente = searchParams.get("siguiente") ?? "/";
  const destino = siguiente.startsWith("/") ? siguiente : "/";

  if (codigo) {
    const supabase = await clienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(
    `${origin}/ingresar?mensaje=${encodeURIComponent("El enlace no es válido o ya venció. Pide uno nuevo.")}`,
  );
}
