"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Aviso, AreaTexto, Campo, Casilla, Selector, Tarjeta, BotonEnviar, BotonEnlace } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { SubirFotos } from "@/components/subir-fotos";
import { CATEGORIA_SINGULAR, MATERIALES_SUGERIDOS, type Ajustes, type Contacto, type Producto, type CategoriaProducto } from "@/lib/tipos";
import { normalizarCodigo, prefijoParaCategoria } from "@/lib/codigos";
import { precioPublicoSugerido } from "@/lib/precios";
import { enMiles, pesos } from "@/lib/formato";
import { crearProducto, editarProducto, siguienteCodigoLibre, type EstadoFormulario } from "./acciones";

export function FormularioProducto({
  ajustes,
  proveedores,
  producto,
}: {
  ajustes: Ajustes;
  proveedores: Pick<Contacto, "id" | "nombre">[];
  producto?: Producto;
}) {
  const esEdicion = Boolean(producto);
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(esEdicion ? editarProducto : crearProducto, {});
  const [idNuevo] = useState(() => producto?.id ?? crypto.randomUUID());

  const [categoria, setCategoria] = useState<CategoriaProducto>(producto?.categoria ?? "areta");
  const [codigo, setCodigo] = useState(producto?.codigo ?? "");
  const [codigoManual, setCodigoManual] = useState(esEdicion);
  const [precioBase, setPrecioBase] = useState<number | null>(producto?.precio_base ?? null);
  const [publicoManual, setPublicoManual] = useState(esEdicion);

  const sugerido = useMemo(() => (precioBase == null ? null : precioPublicoSugerido(precioBase, ajustes)), [precioBase, ajustes]);

  // Sugerir el siguiente código libre cuando cambia la categoría (si no se escribió a mano).
  useEffect(() => {
    if (codigoManual) return;
    let vigente = true;
    siguienteCodigoLibre(prefijoParaCategoria(categoria, ajustes)).then((c) => {
      if (vigente) setCodigo(c);
    });
    return () => {
      vigente = false;
    };
  }, [categoria, codigoManual, ajustes]);

  return (
    <form action={accion} className="space-y-4">
      {!esEdicion && <input type="hidden" name="id" value={idNuevo} />}
      {esEdicion && <input type="hidden" name="id" value={producto!.id} />}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <Tarjeta>
        <SubirFotos productoId={idNuevo} />
      </Tarjeta>

      <Tarjeta titulo="Datos básicos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Categoría" name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaProducto)}>
            {Object.entries(CATEGORIA_SINGULAR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Campo
            etiqueta="Código"
            name="codigo"
            value={codigo}
            onChange={(e) => {
              setCodigoManual(true);
              setCodigo(normalizarCodigo(e.target.value));
            }}
            autoCapitalize="characters"
            autoComplete="off"
            required
            ayuda={codigoManual ? "Escrito a mano." : "Sugerido automáticamente; puedes cambiarlo."}
          />
        </div>
        <Campo
          etiqueta="Nombre o descripción"
          name="nombre"
          defaultValue={producto?.nombre ?? ""}
          placeholder="Ej.: Aretas perla de Mallorca topo gancho"
          required
          className="mt-4"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Material o línea" name="material" list="materiales" defaultValue={producto?.material ?? ""} placeholder="Mallorca, perla, coral…" />
          <datalist id="materiales">
            {MATERIALES_SUGERIDOS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Campo etiqueta="Color" name="color" defaultValue={producto?.color ?? ""} placeholder="Dorado, plateado…" />
          <Campo etiqueta="Subcategoría" name="subcategoria" defaultValue={producto?.subcategoria ?? ""} placeholder="Topo gancho, topo presión…" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Precios">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoPesos etiqueta="Precio base" name="precio_base" valorInicial={producto?.precio_base ?? null} requerido onCambio={setPrecioBase} ayuda={precioBase ? `En la etiqueta: ${codigo} ${enMiles(precioBase)}` : "El de las hojas de ventas (ej.: 40.000)."} />
          <CampoPesos
            etiqueta="Precio al público"
            name="precio_publico"
            valorInicial={producto?.precio_publico ?? null}
            valorControlado={publicoManual || sugerido == null ? undefined : sugerido}
            requerido
            onCambio={() => setPublicoManual(true)}
            ayuda={
              ajustes.regla_precio_publico === "multiplicador" && sugerido != null
                ? `Regla de Ajustes: base × ${ajustes.factor_precio_publico} = ${pesos(sugerido)}${publicoManual ? " (cambiado a mano)" : ""}`
                : "El de la etiqueta (ej.: 118.900)."
            }
          />
          <CampoPesos etiqueta="Precio mayorista (opcional)" name="precio_mayorista" valorInicial={producto?.precio_mayorista ?? null} />
          <CampoPesos etiqueta="Costo de compra (opcional)" name="costo_compra" valorInicial={producto?.costo_compra ?? null} ayuda="Lo que te costó la pieza. Sirve para calcular la ganancia." />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Inventario">
        <div className="grid gap-4 sm:grid-cols-2">
          {!esEdicion && (
            <Campo etiqueta="Cantidad inicial" name="stock_inicial" type="number" inputMode="numeric" min={0} defaultValue={0} ayuda="Cuántas tienes ahora. Se registra como entrada." />
          )}
          <Campo etiqueta="Avisar cuando queden" name="stock_minimo" type="number" inputMode="numeric" min={0} defaultValue={producto?.stock_minimo ?? ajustes.stock_minimo_predeterminado} ayuda="Mínimo para la alerta de stock bajo." />
          <Selector etiqueta="Proveedor (opcional)" name="proveedor_id" defaultValue={producto?.proveedor_id ?? ""}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </div>
        <div className="mt-4 space-y-2">
          <Casilla etiqueta="Mostrar en el catálogo público" name="visible_catalogo" defaultChecked={producto?.visible_catalogo ?? false} ayuda="Solo aplica si el catálogo está activado en Ajustes." />
          {esEdicion && (
            <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie p-3">
              <input type="checkbox" name="activo" value="false" className="mt-1 h-5 w-5 accent-primario" defaultChecked={!producto!.activo} />
              <span>
                <span className="block font-semibold">Descontinuado</span>
                <span className="block text-sm text-texto-suave">Se deja de mostrar en las listas normales, pero conserva su historial.</span>
              </span>
            </label>
          )}
        </div>
        <AreaTexto etiqueta="Notas (opcional)" name="notas" defaultValue={producto?.notas ?? ""} className="mt-4" />
      </Tarjeta>

      <div className="flex flex-col gap-2 sm:flex-row">
        <BotonEnviar>{esEdicion ? "Guardar cambios" : "Guardar producto"}</BotonEnviar>
        {!esEdicion && (
          <button
            type="submit"
            name="seguir"
            value="si"
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border border-borde bg-superficie px-5 text-lg font-semibold hover:bg-primario-claro"
          >
            Guardar y añadir otro
          </button>
        )}
        <BotonEnlace href={esEdicion ? `/productos/${producto!.id}` : "/productos"} variante="fantasma" grande>
          Cancelar
        </BotonEnlace>
      </div>
    </form>
  );
}
