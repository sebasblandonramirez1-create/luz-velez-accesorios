import Link from "next/link";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, EstadoVacio } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { fechaHora, pesos } from "@/lib/formato";
import { TIPOS_MOVIMIENTO, nombreMovimiento, signoMovimiento, type TipoMovimiento } from "@/lib/inventario";
import { enviarMovimientoAPapelera } from "./acciones";

export const metadata = { title: "Inventario" };

export default async function PaginaInventario({ searchParams }: PageProps<"/inventario">) {
  const p = await searchParams;
  const productoId = typeof p.producto === "string" ? p.producto : "";
  const tipo = typeof p.tipo === "string" && p.tipo in TIPOS_MOVIMIENTO ? (p.tipo as TipoMovimiento) : "";
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const error = typeof p.error === "string" ? p.error : null;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("movimientos_inventario")
    .select("id, tipo, cantidad, valor_unitario, fecha, nota, productos(id, codigo, nombre)")
    .is("eliminado_en", null)
    .order("fecha", { ascending: false })
    .limit(200);
  if (productoId) consulta = consulta.eq("producto_id", productoId);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  const { data: movimientos } = await consulta;

  const { data: resumen } = await supabase.from("productos").select("stock_actual, precio_base, precio_publico").is("eliminado_en", null).eq("activo", true);
  const unidades = (resumen ?? []).reduce((s, x) => s + x.stock_actual, 0);
  const valorBase = (resumen ?? []).reduce((s, x) => s + x.stock_actual * x.precio_base, 0);
  const valorPublico = (resumen ?? []).reduce((s, x) => s + x.stock_actual * x.precio_publico, 0);

  return (
    <div>
      <Encabezado
        titulo="Inventario"
        subtitulo="Cada entrada y salida queda registrada. El stock se calcula solo."
        acciones={
          <>
            <a href="/inventario/exportar" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-borde bg-superficie px-5 font-semibold hover:bg-primario-claro">
              Exportar
            </a>
            <BotonEnlace href="/inventario/nuevo">➕ Registrar movimiento</BotonEnlace>
          </>
        }
      />
      {aviso && (
        <Aviso tipo="exito" className="mb-4">
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" className="mb-4">
          {error}
        </Aviso>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-borde bg-superficie p-3">
          <p className="text-xs text-texto-suave">Unidades</p>
          <p className="text-xl font-bold">{unidades}</p>
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-3">
          <p className="text-xs text-texto-suave">Valor a precio base</p>
          <p className="text-xl font-bold">{pesos(valorBase)}</p>
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-3">
          <p className="text-xs text-texto-suave">Valor al público</p>
          <p className="text-xl font-bold">{pesos(valorPublico)}</p>
        </div>
      </div>

      <form className="mb-4 flex gap-2" method="get">
        {productoId && <input type="hidden" name="producto" value={productoId} />}
        <select name="tipo" defaultValue={tipo} className="campo" aria-label="Tipo de movimiento">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-12 rounded-xl border border-borde bg-superficie px-4 font-semibold">
          Filtrar
        </button>
      </form>
      {productoId && (
        <p className="mb-3 text-sm">
          Mostrando solo un producto.{" "}
          <Link href="/inventario" className="font-semibold text-primario">
            Ver todos
          </Link>
        </p>
      )}

      {!movimientos?.length ? (
        <EstadoVacio titulo="Sin movimientos" texto="Registra una entrada por compra o un ajuste para empezar." accion={<BotonEnlace href="/inventario/nuevo">Registrar movimiento</BotonEnlace>} />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {movimientos.map((m) => {
            const prod = m.productos as unknown as { id: string; codigo: string; nombre: string } | null;
            const positivo = signoMovimiento(m.tipo) > 0;
            return (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${positivo ? "bg-exito-claro text-exito" : "bg-peligro-claro text-peligro"}`}>
                  {positivo ? "+" : "−"}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/productos/${prod?.id}`} className="block truncate font-semibold hover:underline">
                    {prod?.nombre ?? "—"} <span className="font-normal text-texto-suave">{prod?.codigo}</span>
                  </Link>
                  <span className="block text-sm text-texto-suave">
                    {nombreMovimiento(m.tipo)} · {fechaHora(m.fecha)}
                    {m.valor_unitario ? ` · ${pesos(m.valor_unitario)} c/u` : ""}
                    {m.nota ? ` · ${m.nota}` : ""}
                  </span>
                </span>
                <span className="text-xl font-bold">{m.cantidad}</span>
                {sesion.perfil.rol === "propietaria" && (
                  <BotonConfirmar
                    accion={enviarMovimientoAPapelera}
                    campos={{ id: m.id }}
                    titulo="¿Anular este movimiento?"
                    texto="Se enviará a la papelera y el stock se recalculará. Podrás restaurarlo durante 30 días."
                    confirmar="Sí, anular"
                    className="!min-h-10 !px-3 text-sm"
                  >
                    Anular
                  </BotonConfirmar>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
