import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, EstadoVacio, Etiqueta } from "@/components/ui";
import { fecha, pesos } from "@/lib/formato";
import { antiguedad } from "@/lib/ventas";
import { TIPOS_CONTACTO } from "@/lib/tipos";

export const metadata = { title: "Cuentas por cobrar" };

export default async function PaginaCuentas({ searchParams }: PageProps<"/cuentas">) {
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const supabase = await clienteServidor();
  const { data: saldos } = await supabase.from("saldos_por_contacto").select("*").order("saldo", { ascending: false });
  const total = (saldos ?? []).reduce((s, x) => s + x.saldo, 0);

  return (
    <div>
      <Encabezado titulo="Cuentas por cobrar" subtitulo={`Te deben en total ${pesos(total)}`} />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      {!saldos?.length ? (
        <EstadoVacio titulo="Nadie te debe" texto="Cuando una venta quede pendiente o una vendedora venda en consignación, aparecerá aquí." />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {saldos.map((s) => (
            <li key={s.contacto_id}>
              <Link href={`/cuentas/${s.contacto_id}`} className="flex items-center gap-3 p-3 hover:bg-fondo">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-alerta-claro font-bold text-alerta">{s.nombre.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.nombre}</span>
                  <span className="block text-sm text-texto-suave">
                    {TIPOS_CONTACTO[s.tipo]} · {s.cuentas_abiertas} {s.cuentas_abiertas === 1 ? "cuenta" : "cuentas"} · desde {fecha(s.desde)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold">{pesos(s.saldo)}</span>
                  <Etiqueta tono={s.dias > 30 ? "peligro" : s.dias > 15 ? "alerta" : "neutro"}>{antiguedad(s.dias)}</Etiqueta>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
