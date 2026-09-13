import Link from "next/link";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Tarjeta, Etiqueta } from "@/components/ui";
import { horasDesde, haceCuanto, fechaHora, hoyIso, pesos } from "@/lib/formato";
import { nombreMovimiento } from "@/lib/inventario";
import { numeroDocumento } from "@/lib/ventas";
import { MiniaturaProducto } from "@/components/miniatura";

export default async function Tablero() {
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();

  const hoy = hoyIso();
  const inicioMes = `${hoy.slice(0, 7)}-01T00:00:00-05:00`;
  const [{ data: ajustes }, { data: stockBajo }, { count: sinMovimiento }, { data: ultimosMovimientos }, { count: totalProductos }, { data: ventasMes }, { data: saldos }] =
    await Promise.all([
      supabase.from("ajustes").select("*").eq("id", 1).single(),
      supabase
        .from("productos")
        .select("id, codigo, nombre, stock_actual, stock_minimo, producto_fotos(ruta_miniatura, principal)")
        .is("eliminado_en", null)
        .eq("activo", true)
        .order("stock_actual", { ascending: true })
        .limit(50),
      supabase.from("productos_sin_movimiento").select("id", { count: "exact", head: true }),
      supabase
        .from("movimientos_inventario")
        .select("id, tipo, cantidad, fecha, productos(codigo, nombre)")
        .is("eliminado_en", null)
        .order("fecha", { ascending: false })
        .limit(6),
      supabase.from("productos").select("id", { count: "exact", head: true }).is("eliminado_en", null),
      supabase.from("ventas").select("id, numero, fecha, total, contactos(nombre)").is("eliminado_en", null).gte("fecha", inicioMes).order("fecha", { ascending: false }),
      supabase.from("saldos_por_contacto").select("saldo"),
    ]);
  const ventasHoy = (ventasMes ?? []).filter((v) => new Date(v.fecha).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) === hoy);
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0);
  const totalMes = (ventasMes ?? []).reduce((s, v) => s + v.total, 0);
  const porCobrar = (saldos ?? []).reduce((s, x) => s + x.saldo, 0);

  const alertasStock = (stockBajo ?? []).filter((p) => p.stock_actual <= p.stock_minimo);
  const horasRespaldo = horasDesde(ajustes?.ultimo_respaldo_en);
  const respaldoConfigurado = ajustes?.respaldo_destino && ajustes.respaldo_destino !== "ninguno";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-texto-suave">Hola, {sesion.perfil.nombre || sesion.correo}</p>
        <h1 className="text-2xl font-bold">Inicio</h1>
      </header>

      {respaldoConfigurado && (horasRespaldo == null || horasRespaldo > 48) && (
        <Aviso tipo="alerta">
          {horasRespaldo == null
            ? "Todavía no hay ninguna copia de seguridad automática."
            : `La última copia de seguridad tiene más de ${Math.floor(horasRespaldo)} horas.`}{" "}
          Revisa en <Link href="/ajustes/respaldos" className="font-semibold underline">Ajustes → Copias de seguridad</Link>.
        </Aviso>
      )}

      <section aria-label="Accesos directos" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BotonEnlace href="/ventas/nueva" grande className="flex-col py-4">
          <span className="text-2xl" aria-hidden>🛍️</span>
          Registrar venta
        </BotonEnlace>
        <BotonEnlace href="/consignaciones/nueva" grande variante="acento" className="flex-col py-4">
          <span className="text-2xl" aria-hidden>📦</span>
          Entregar en consignación
        </BotonEnlace>
        <BotonEnlace href="/productos/nuevo" grande variante="secundario" className="flex-col py-4">
          <span className="text-2xl" aria-hidden>➕</span>
          Añadir producto
        </BotonEnlace>
        <BotonEnlace href="/etiquetas" grande variante="secundario" className="flex-col py-4">
          <span className="text-2xl" aria-hidden>🏷️</span>
          Imprimir etiquetas
        </BotonEnlace>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Tarjeta>
          <p className="text-sm text-texto-suave">Ventas de hoy</p>
          <p className="text-2xl font-bold">{pesos(totalHoy)}</p>
          <Link href="/ventas" className="text-xs font-semibold text-primario">
            Este mes: {pesos(totalMes)} en {ventasMes?.length ?? 0} ventas
          </Link>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-texto-suave">Cuentas por cobrar</p>
          <p className="text-2xl font-bold">{pesos(porCobrar)}</p>
          <Link href="/cuentas" className="text-xs font-semibold text-primario">
            {(saldos ?? []).length} {(saldos ?? []).length === 1 ? "persona debe" : "personas deben"}
          </Link>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-texto-suave">Productos en catálogo</p>
          <p className="text-2xl font-bold">{totalProductos ?? 0}</p>
          <Link href="/productos?filtro=sin_movimiento" className="text-xs font-semibold text-primario">
            {sinMovimiento ?? 0} sin movimiento en 90 días
          </Link>
        </Tarjeta>
      </section>

      <Tarjeta titulo={`Stock bajo (${alertasStock.length})`}>
        {alertasStock.length === 0 ? (
          <p className="text-texto-suave">Todo el inventario está por encima del mínimo.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {alertasStock.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link href={`/productos/${p.id}`} className="flex items-center gap-3 py-2">
                  <MiniaturaProducto ruta={p.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? p.producto_fotos?.[0]?.ruta_miniatura} nombre={p.nombre} tamano={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.nombre}</span>
                    <span className="block text-sm text-texto-suave">{p.codigo}</span>
                  </span>
                  <Etiqueta tono={p.stock_actual === 0 ? "peligro" : "alerta"}>
                    {p.stock_actual === 0 ? "Agotado" : `Quedan ${p.stock_actual}`}
                  </Etiqueta>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {alertasStock.length > 8 && (
          <Link href="/productos?filtro=stock_bajo" className="mt-2 inline-block font-semibold text-primario">
            Ver todos ({alertasStock.length})
          </Link>
        )}
      </Tarjeta>

      <Tarjeta titulo="Últimas ventas">
        {!ventasMes?.length ? (
          <p className="text-texto-suave">Aún no hay ventas este mes.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {ventasMes.slice(0, 5).map((v) => {
              const c = v.contactos as unknown as { nombre: string } | null;
              return (
                <li key={v.id}>
                  <Link href={`/ventas/${v.id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {numeroDocumento("V", v.numero)} · {c?.nombre ?? "Cliente ocasional"}
                      </span>
                      <span className="block text-xs text-texto-suave">{fechaHora(v.fecha)}</span>
                    </span>
                    <span className="font-bold">{pesos(v.total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Últimos movimientos">
        {!ultimosMovimientos?.length ? (
          <p className="text-texto-suave">Aún no hay movimientos. Empieza por añadir productos y registrar entradas.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {ultimosMovimientos.map((m) => {
              const prod = m.productos as unknown as { codigo: string; nombre: string } | null;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{prod?.nombre ?? "—"}</span>
                    <span className="block text-sm text-texto-suave">
                      {nombreMovimiento(m.tipo)} · {prod?.codigo}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{m.cantidad}</span>
                    <span className="block text-xs text-texto-suave" title={fechaHora(m.fecha)}>
                      {haceCuanto(m.fecha)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/inventario" className="mt-2 inline-block font-semibold text-primario">
          Ver todo el inventario
        </Link>
      </Tarjeta>
    </div>
  );
}
