import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { diasRestantesEnPapelera, fechaHora } from "@/lib/formato";
import { restaurarDePapelera } from "../acciones";

export const metadata = { title: "Papelera" };

const NOMBRES: Record<string, string> = {
  productos: "Producto",
  contactos: "Contacto",
  movimientos_inventario: "Movimiento",
  ventas: "Venta",
  consignaciones: "Consignación",
  liquidaciones: "Liquidación",
  abonos: "Abono",
};

export default async function PaginaPapelera({ searchParams }: PageProps<"/ajustes/papelera">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/ajustes");
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const error = typeof p.error === "string" ? p.error : null;
  const supabase = await clienteServidor();
  const { data: filas } = await supabase.from("papelera").select("*").order("eliminado_en", { ascending: false });

  return (
    <div className="space-y-4">
      <Encabezado titulo="Papelera" volver="/ajustes" subtitulo="Lo borrado se conserva 30 días y luego se elimina definitivamente." />
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!filas?.length ? (
        <EstadoVacio titulo="La papelera está vacía" />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {filas.map((f) => {
            const dias = diasRestantesEnPapelera(f.eliminado_en);
            return (
              <li key={`${f.tabla}-${f.id}`} className="flex items-center gap-3 p-3">
                <Etiqueta>{NOMBRES[f.tabla] ?? f.tabla}</Etiqueta>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.descripcion}</span>
                  <span className="block text-sm text-texto-suave">
                    Borrado el {fechaHora(f.eliminado_en)} · se elimina en {dias} {dias === 1 ? "día" : "días"}
                  </span>
                </span>
                <form action={restaurarDePapelera}>
                  <input type="hidden" name="tabla" value={f.tabla} />
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="min-h-10 rounded-lg bg-primario px-3 text-sm font-semibold text-white">
                    Restaurar
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
