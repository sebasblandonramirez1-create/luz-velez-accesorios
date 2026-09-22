import { Marca } from "@/components/marca";
import { informeProyecto } from "@/lib/supabase/proyecto";
import { Reactivador } from "./reactivador";

export const metadata = { title: "Reactivar la aplicación" };
export const dynamic = "force-dynamic";

/**
 * Pantalla pública para despertar el proyecto de Supabase cuando el plan
 * gratuito lo pausa por falta de uso. Se enlaza desde la pantalla de ingreso.
 */
export default async function PaginaReactivar() {
  const informe = await informeProyecto();
  return (
    <main className="acuarela flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Marca tamano="lg" />
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
          <Reactivador estadoInicial={informe.estado} puedeReactivar={informe.puedeReactivar} enlacePanel={informe.enlacePanel} />
        </div>
      </div>
    </main>
  );
}
