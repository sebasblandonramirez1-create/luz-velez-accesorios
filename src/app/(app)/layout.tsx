import { redirect } from "next/navigation";
import { sesionActual, clienteServidor } from "@/lib/supabase/servidor";
import { BarraInferior, MenuLateral } from "@/components/navegacion";

// Todas las páginas autenticadas dependen de la sesión: se renderizan por petición.
export const dynamic = "force-dynamic";

/**
 * Diseño de las páginas autenticadas. El proxy ya redirige si no hay sesión;
 * aquí se vuelve a comprobar (y que el perfil esté activo) por seguridad.
 */
export default async function DisenoApp({ children }: LayoutProps<"/">) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/ingresar");
  const supabase = await clienteServidor();
  const { data: ajustes } = await supabase.from("ajustes").select("nombre_negocio").eq("id", 1).maybeSingle();

  return (
    <div className="flex min-h-screen">
      <MenuLateral nombreNegocio={ajustes?.nombre_negocio ?? "Luz Vélez Accesorios"} nombreUsuaria={sesion.perfil.nombre || sesion.correo} rol={sesion.perfil.rol} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-imprimir sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-superficie/95 px-4 py-3 backdrop-blur md:hidden">
          <span className="font-bold">{ajustes?.nombre_negocio ?? "Luz Vélez Accesorios"}</span>
          <form action="/auth/salir" method="post">
            <button type="submit" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-texto-suave">
              Salir
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>
      <BarraInferior />
    </div>
  );
}
