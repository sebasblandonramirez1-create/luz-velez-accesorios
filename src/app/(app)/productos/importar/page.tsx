import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado, Tarjeta } from "@/components/ui";
import { Importador } from "./importador";

export const metadata = { title: "Importar productos" };

export default async function PaginaImportar() {
  const supabase = await clienteServidor();
  const [{ data }, { data: clasificaciones }] = await Promise.all([
    supabase.from("productos").select("codigo").is("eliminado_en", null),
    supabase.from("clasificaciones_producto").select("codigo").eq("activa", true),
  ]);
  return (
    <div className="space-y-4">
      <Encabezado titulo="Importar productos" volver="/productos" subtitulo="Carga tu catálogo desde un archivo CSV exportado de Excel." />
      <Tarjeta titulo="Cómo preparar el archivo">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            En Excel, deja una fila de encabezados con columnas como <strong>Clasificación, Código, Descripción, Categoría, Material, Color, Precio base, Precio público, Cantidad</strong>. Solo Código y Descripción son obligatorias. En Clasificación va el código corto (CP, CM, CCH, PL, PLM…); si falta o no existe, el producto queda sin clasificar.
          </li>
          <li>
            Guarda como <strong>CSV</strong> («CSV UTF-8 (delimitado por comas)» o «CSV (delimitado por punto y coma)»). Ambos sirven.
          </li>
          <li>Súbelo aquí, revisa la vista previa y confirma. Los códigos repetidos se marcan y no se importan.</li>
        </ol>
        <p className="mt-2 text-sm text-texto-suave">
          Si el código viene como en las hojas («SLA013 40»), el 40 se toma como precio base en miles cuando no hay columna de precio base.
        </p>
      </Tarjeta>
      <Importador codigosExistentes={(data ?? []).map((x) => x.codigo)} clasificaciones={(clasificaciones ?? []).map((k) => k.codigo)} />
    </div>
  );
}
