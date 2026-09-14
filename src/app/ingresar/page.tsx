import { entornoConfigurado } from "@/lib/supabase/entorno";
import { Aviso } from "@/components/ui";
import { FormularioIngreso } from "./formulario";
import { Marca } from "@/components/marca";

export const metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  const params = await searchParams;
  const volver = typeof params.volver === "string" ? params.volver : "/";
  const mensaje = typeof params.mensaje === "string" ? params.mensaje : null;
  const configurado = entornoConfigurado();

  return (
    <main className="acuarela flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="sr-only">Luzazul Accesorios</h1>
          <Marca tamano="lg" />
          <p className="mt-3 text-texto-suave">Inventario, ventas y consignaciones</p>
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
