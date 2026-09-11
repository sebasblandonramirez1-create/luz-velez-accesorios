import { entornoConfigurado } from "@/lib/supabase/entorno";
import { Aviso } from "@/components/ui";
import { FormularioIngreso } from "./formulario";

export const metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  const params = await searchParams;
  const volver = typeof params.volver === "string" ? params.volver : "/";
  const mensaje = typeof params.mensaje === "string" ? params.mensaje : null;
  const configurado = entornoConfigurado();

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primario text-3xl text-white shadow">
            ✦
          </div>
          <h1 className="text-2xl font-bold">Luz Vélez Accesorios</h1>
          <p className="text-texto-suave">Inventario, ventas y consignaciones</p>
        </div>
        {!configurado ? (
          <Aviso tipo="alerta">
            La aplicación todavía no está conectada a la base de datos. Falta configurar las variables de entorno de Supabase
            (ver el README, sección «Desplegar desde cero»).
          </Aviso>
        ) : (
          <FormularioIngreso volver={volver} mensajeInicial={mensaje} />
        )}
      </div>
    </main>
  );
}
