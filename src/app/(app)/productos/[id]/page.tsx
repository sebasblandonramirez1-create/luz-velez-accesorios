import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, BotonEnlace, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { enMiles, fecha, fechaHora, pesos } from "@/lib/formato";
import { nombreMovimiento, signoMovimiento } from "@/lib/inventario";
import { CATEGORIA_SINGULAR } from "@/lib/tipos";
import { urlFoto } from "@/lib/urls";
import { borrarFoto, enviarProductoAPapelera, marcarFotoPrincipal } from "../acciones";

export default async function PaginaProducto({ params, searchParams }: PageProps<"/productos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();

  const [{ data: producto }, { data: fotos }, { data: movimientos }, { data: proveedor }, { data: ajustes }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("producto_fotos").select("*").eq("producto_id", id).order("principal", { ascending: false }).order("orden"),
    supabase.from("movimientos_inventario").select("*").eq("producto_id", id).is("eliminado_en", null).order("fecha", { ascending: false }).limit(50),
    supabase.from("productos").select("proveedor_id, contactos:proveedor_id(nombre)").eq("id", id).maybeSingle(),
    supabase.from("ajustes").select("etiqueta_mostrar_precio_miles").eq("id", 1).single(),
  ]);
  if (!producto) notFound();

  const nombreProveedor = (proveedor?.contactos as unknown as { nombre: string } | null)?.nombre;
  const principal = fotos?.[0];
  const bajo = producto.stock_actual <= producto.stock_minimo;
  const esPropietaria = sesion.perfil.rol === "propietaria";

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={producto.nombre}
        subtitulo={`${producto.codigo}${ajustes?.etiqueta_mostrar_precio_miles ? ` ${enMiles(producto.precio_base)}` : ""} · ${CATEGORIA_SINGULAR[producto.categoria]}`}
        volver="/productos"
        acciones={
          <>
            <BotonEnlace href={`/inventario/nuevo?producto=${producto.id}`} variante="secundario">
              Registrar movimiento
            </BotonEnlace>
            <BotonEnlace href={`/productos/${producto.id}/editar`}>Editar</BotonEnlace>
          </>
        }
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!producto.activo && <Aviso tipo="alerta">Este producto está marcado como descontinuado.</Aviso>}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Tarjeta>
          {principal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlFoto(principal.ruta)!} alt={producto.nombre} className="aspect-square w-full rounded-xl border border-borde object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-borde bg-fondo text-texto-suave">
              Sin foto todavía
            </div>
          )}
          {fotos && fotos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {fotos.map((f) => (
                <li key={f.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(f.ruta_miniatura)!} alt="" className={`h-16 w-16 rounded-lg border object-cover ${f.principal ? "border-primario ring-2 ring-primario/40" : "border-borde"}`} />
                  <div className="mt-1 flex gap-1">
                    {!f.principal && (
                      <form action={marcarFotoPrincipal}>
                        <input type="hidden" name="foto_id" value={f.id} />
                        <input type="hidden" name="producto_id" value={producto.id} />
                        <button className="text-xs font-semibold text-primario" type="submit">
                          Principal
                        </button>
                      </form>
                    )}
                    <form action={borrarFoto}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <input type="hidden" name="producto_id" value={producto.id} />
                      <button className="text-xs font-semibold text-peligro" type="submit">
                        Quitar
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="space-y-4">
          <Tarjeta>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-texto-suave">En stock</p>
                <p className={`text-3xl font-bold ${producto.stock_actual === 0 ? "text-peligro" : bajo ? "text-alerta" : ""}`}>{producto.stock_actual}</p>
                {bajo && <Etiqueta tono={producto.stock_actual === 0 ? "peligro" : "alerta"}>{producto.stock_actual === 0 ? "Agotado" : "Stock bajo"}</Etiqueta>}
              </div>
              <div>
                <p className="text-sm text-texto-suave">Precio al público</p>
                <p className="text-3xl font-bold">{pesos(producto.precio_publico)}</p>
              </div>
              <div>
                <p className="text-sm text-texto-suave">Precio base</p>
                <p className="text-xl font-semibold">{pesos(producto.precio_base)}</p>
              </div>
              {producto.precio_mayorista != null && (
                <div>
                  <p className="text-sm text-texto-suave">Mayorista</p>
                  <p className="text-xl font-semibold">{pesos(producto.precio_mayorista)}</p>
                </div>
              )}
              {esPropietaria && producto.costo_compra != null && (
                <div>
                  <p className="text-sm text-texto-suave">Costo de compra</p>
                  <p className="text-xl font-semibold">{pesos(producto.costo_compra)}</p>
                </div>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Detalles">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-texto-suave">Material</dt>
              <dd>{producto.material || "—"}</dd>
              <dt className="text-texto-suave">Color</dt>
              <dd>{producto.color || "—"}</dd>
              <dt className="text-texto-suave">Subcategoría</dt>
              <dd>{producto.subcategoria || "—"}</dd>
              <dt className="text-texto-suave">Proveedor</dt>
              <dd>{nombreProveedor ?? "—"}</dd>
              <dt className="text-texto-suave">Mínimo</dt>
              <dd>{producto.stock_minimo}</dd>
              <dt className="text-texto-suave">Catálogo público</dt>
              <dd>{producto.visible_catalogo ? "Visible" : "Oculto"}</dd>
              <dt className="text-texto-suave">Creado</dt>
              <dd>{fecha(producto.creado_en)}</dd>
              {producto.notas && (
                <>
                  <dt className="text-texto-suave">Notas</dt>
                  <dd className="whitespace-pre-line">{producto.notas}</dd>
                </>
              )}
            </dl>
          </Tarjeta>
        </div>
      </div>

      <Tarjeta titulo="Movimientos de inventario">
        {!movimientos?.length ? (
          <p className="text-texto-suave">Sin movimientos todavía.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block font-semibold">{nombreMovimiento(m.tipo)}</span>
                  <span className="block text-sm text-texto-suave">
                    {fechaHora(m.fecha)}
                    {m.nota ? ` · ${m.nota}` : ""}
                  </span>
                </span>
                <span className={`text-xl font-bold ${signoMovimiento(m.tipo) > 0 ? "text-exito" : "text-peligro"}`}>
                  {signoMovimiento(m.tipo) > 0 ? "+" : "−"}
                  {m.cantidad}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/inventario?producto=${producto.id}`} className="mt-2 inline-block font-semibold text-primario">
          Ver todos
        </Link>
      </Tarjeta>

      {esPropietaria && (
        <div className="flex justify-end">
          <BotonConfirmar
            accion={enviarProductoAPapelera}
            campos={{ id: producto.id }}
            titulo="¿Enviar a la papelera?"
            texto="El producto dejará de aparecer. Podrás restaurarlo desde Ajustes → Papelera durante 30 días."
            confirmar="Sí, enviar a la papelera"
          >
            Enviar a la papelera
          </BotonConfirmar>
        </div>
      )}
    </div>
  );
}
