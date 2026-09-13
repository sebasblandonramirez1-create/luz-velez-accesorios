import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

/** Vistas de impresión: sin menús, fondo blanco, tipografía sobria. */
export default async function DisenoImpresion({ children }: LayoutProps<"/imprimir">) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/ingresar");
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl p-4 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
