import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (antes «middleware»): refresca la sesión de Supabase en cada petición
 * y redirige a /ingresar si no hay sesión. Las rutas públicas (ingreso,
 * callback de correo, catálogo público, manifest, iconos) quedan fuera.
 */
const RUTAS_PUBLICAS = [/^\/ingresar/, /^\/auth\//, /^\/catalogo(\/|$)/, /^\/manifest/, /^\/iconos\//, /^\/sin-conexion/, /^\/reactivar(\/|$)/, /^\/firmar\//];

// Rutas que no necesitan sesión ni refrescarla: ni siquiera se consulta a Supabase.
// Importa cuando el proyecto está dormido: la consulta tardaría ~25 s en fallar.
const RUTAS_SIN_SESION = [/^\/reactivar(\/|$)/, /^\/firmar\//, /^\/sin-conexion/, /^\/manifest/, /^\/iconos\//];

/** Espera la promesa como máximo `milisegundos`; si vence, devuelve `siVence`. */
async function conTiempo<T>(promesa: Promise<T>, milisegundos: number, siVence: T): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencimiento = new Promise<T>((resolver) => {
    temporizador = setTimeout(() => resolver(siVence), milisegundos);
  });
  try {
    return await Promise.race([promesa, vencimiento]);
  } finally {
    clearTimeout(temporizador);
  }
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const esPublica = RUTAS_PUBLICAS.some((r) => r.test(request.nextUrl.pathname));
  if (RUTAS_SIN_SESION.some((r) => r.test(request.nextUrl.pathname))) return NextResponse.next({ request });

  // Sin configuración todavía: dejar pasar para que la página de ingreso explique qué falta.
  if (!url || !clave) return NextResponse.next({ request });

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });

  // getUser() valida el token contra Supabase y refresca la sesión si hace falta.
  // Si Supabase no responde (proyecto dormido), no se espera más de 4 s: se
  // trata como «sin sesión» y la pantalla de ingreso explica cómo reactivarlo.
  const user = await conTiempo(
    supabase.auth.getUser().then((r) => r.data.user).catch(() => null),
    4000,
    null,
  );

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/ingresar";
    destino.search = request.nextUrl.pathname === "/" ? "" : `?volver=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(destino);
  }
  if (user && request.nextUrl.pathname.startsWith("/ingresar")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export const config = {
  // Todo salvo archivos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|pdf)$).*)"],
};
