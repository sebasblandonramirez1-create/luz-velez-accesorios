"use client";

import { useActionState, useState } from "react";
import { Aviso, AreaTexto, Campo, Casilla, Selector, Tarjeta, BotonEnviar } from "@/components/ui";
import { pesos } from "@/lib/formato";
import { precioPublicoSugerido, type RedondeoPrecio, type ReglaPrecioPublico } from "@/lib/precios";
import type { Ajustes } from "@/lib/tipos";
import { LINEAS_ETIQUETA, ROLLOS, type LineaEtiqueta } from "@/lib/etiquetas";
import { guardarCatalogo, guardarConsignacion, guardarEtiqueta, guardarNegocio, guardarPerfil, guardarPrecios, guardarRespaldo, type EstadoAjustes } from "./acciones";

function Mensajes({ estado }: { estado: EstadoAjustes }) {
  if (estado.error) return <Aviso tipo="error">{estado.error}</Aviso>;
  if (estado.exito) return <Aviso tipo="exito">{estado.exito}</Aviso>;
  return null;
}

export function FormularioPerfil({ nombre, correo }: { nombre: string; correo: string }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarPerfil, {});
  return (
    <form action={accion} className="space-y-3">
      <Mensajes estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tu nombre" name="nombre" defaultValue={nombre} required />
        <Campo etiqueta="Correo" name="correo" value={correo} readOnly disabled />
      </div>
      <BotonEnviar grande={false} className="sm:w-auto">
        Guardar
      </BotonEnviar>
    </form>
  );
}

export function FormulariosAjustes({ ajustes, urlApp }: { ajustes: Ajustes; urlApp: string }) {
  return (
    <>
      <SeccionNegocio ajustes={ajustes} />
      <SeccionConsignacion ajustes={ajustes} />
      <SeccionPrecios ajustes={ajustes} />
      <SeccionEtiqueta ajustes={ajustes} />
      <SeccionCatalogo ajustes={ajustes} urlApp={urlApp} />
      <SeccionRespaldo ajustes={ajustes} />
    </>
  );
}

function SeccionNegocio({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarNegocio, {});
  return (
    <Tarjeta titulo="Negocio y códigos">
      <form action={accion} className="space-y-3">
        <Mensajes estado={estado} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre del negocio" name="nombre_negocio" defaultValue={ajustes.nombre_negocio} required ayuda="Aparece en la etiqueta y en los comprobantes." />
          <Campo etiqueta="Teléfono del negocio" name="telefono_negocio" type="tel" defaultValue={ajustes.telefono_negocio} />
          <Campo etiqueta="NIT o cédula del negocio" name="documento_negocio" defaultValue={ajustes.documento_negocio} ayuda="Aparece en el recibo de consignación." />
          <Campo etiqueta="Correo del negocio" name="correo_negocio" type="email" defaultValue={ajustes.correo_negocio} />
          <Campo etiqueta="Dirección del negocio" name="direccion_negocio" defaultValue={ajustes.direccion_negocio} />
          <Campo etiqueta="Ciudad" name="ciudad_negocio" defaultValue={ajustes.ciudad_negocio} />
          <Campo etiqueta="Prefijo de códigos (general)" name="prefijo_general" defaultValue={ajustes.prefijo_general} autoCapitalize="characters" ayuda="Ej.: SLA → SLA013" />
          <Campo etiqueta="Prefijo de códigos (pulseras)" name="prefijo_pulsera" defaultValue={ajustes.prefijo_pulsera} autoCapitalize="characters" ayuda="Ej.: SLAP → SLAP026" />
          <Campo etiqueta="Stock mínimo por defecto" name="stock_minimo_predeterminado" type="number" min={0} defaultValue={ajustes.stock_minimo_predeterminado} ayuda="Se usa al crear productos nuevos." />
        </div>
        <BotonEnviar grande={false} className="sm:w-auto">
          Guardar
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}

function SeccionConsignacion({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarConsignacion, {});
  return (
    <Tarjeta titulo="Recibo de consignación">
      <form action={accion} className="space-y-3">
        <Mensajes estado={estado} />
        <Campo
          etiqueta="Plazo para liquidar (días)"
          name="consignacion_dias_plazo"
          type="number"
          min={1}
          max={365}
          defaultValue={ajustes.consignacion_dias_plazo}
          ayuda="La fecha límite de cada entrega se propone sumando estos días; se puede cambiar al crear la entrega."
          className="sm:max-w-xs"
        />
        <AreaTexto
          etiqueta="Condiciones que aparecen en el recibo"
          name="consignacion_condiciones"
          defaultValue={ajustes.consignacion_condiciones}
          rows={9}
          ayuda="Una condición por renglón. Quien recibe las acepta al firmar. Si necesitas un texto con alcance legal específico, revísalo con una abogada o un abogado."
        />
        <BotonEnviar grande={false} className="sm:w-auto">
          Guardar
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}

function SeccionPrecios({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarPrecios, {});
  const [regla, setRegla] = useState<ReglaPrecioPublico>(ajustes.regla_precio_publico);
  const [factor, setFactor] = useState(String(ajustes.factor_precio_publico));
  const [redondeo, setRedondeo] = useState<RedondeoPrecio>(ajustes.redondeo_precio_publico);
  const ejemplo = precioPublicoSugerido(40_000, { regla_precio_publico: regla, factor_precio_publico: Number(factor.replace(",", ".")), redondeo_precio_publico: redondeo });
  return (
    <Tarjeta titulo="Precio al público">
      <form action={accion} className="space-y-3">
        <Mensajes estado={estado} />
        <div className="space-y-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${regla === "manual" ? "border-primario bg-primario-claro" : "border-borde"}`}>
            <input type="radio" name="regla_precio_publico" value="manual" checked={regla === "manual"} onChange={() => setRegla("manual")} className="mt-1 h-5 w-5 accent-primario" />
            <span>
              <span className="block font-semibold">Pieza por pieza</span>
              <span className="block text-sm text-texto-suave">Escribes el precio al público de cada producto a mano.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${regla === "multiplicador" ? "border-primario bg-primario-claro" : "border-borde"}`}>
            <input type="radio" name="regla_precio_publico" value="multiplicador" checked={regla === "multiplicador"} onChange={() => setRegla("multiplicador")} className="mt-1 h-5 w-5 accent-primario" />
            <span>
              <span className="block font-semibold">Regla fija a partir del precio base</span>
              <span className="block text-sm text-texto-suave">La app sugiere el precio al público al crear cada producto; siempre puedes cambiarlo.</span>
            </span>
          </label>
        </div>
        {regla === "multiplicador" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Multiplicar el precio base por" name="factor_precio_publico" inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} ayuda="Ej.: 2,97" />
            <Selector etiqueta="Redondear a" name="redondeo_precio_publico" value={redondeo} onChange={(e) => setRedondeo(e.target.value as RedondeoPrecio)}>
              <option value="terminacion_900">Terminado en 900 (118.900)</option>
              <option value="mil">Al mil (119.000)</option>
              <option value="centena">A la centena (118.800)</option>
              <option value="ninguno">Sin redondeo</option>
            </Selector>
            <p className="text-sm text-texto-suave sm:col-span-2">
              Ejemplo: base 40.000 → público <strong>{ejemplo == null ? "—" : pesos(ejemplo)}</strong>
            </p>
          </div>
        )}
        {regla === "manual" && (
          <>
            <input type="hidden" name="factor_precio_publico" value={ajustes.factor_precio_publico} />
            <input type="hidden" name="redondeo_precio_publico" value={ajustes.redondeo_precio_publico} />
          </>
        )}
        <BotonEnviar grande={false} className="sm:w-auto">
          Guardar
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}

const MODELOS_NIIMBOT = ["D11", "D101", "D110", "D110_M", "B1", "B18", "B21", "B21_PRO", "B3S", "M2", "Otro"];

function SeccionEtiqueta({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarEtiqueta, {});
  const [ancho, setAncho] = useState(String(ajustes.etiqueta_ancho_mm));
  const [alto, setAlto] = useState(String(ajustes.etiqueta_alto_mm));
  const [lineas, setLineas] = useState<LineaEtiqueta[]>((ajustes.etiqueta_lineas as LineaEtiqueta[]) ?? []);
  function alternar(l: LineaEtiqueta) {
    setLineas((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]));
  }
  const orden: LineaEtiqueta[] = ["negocio", "descripcion", "codigo_precio", "precio_publico"];
  return (
    <Tarjeta titulo="Etiqueta e impresora">
      <div id="etiqueta" />
      <form action={accion} className="space-y-3">
        <Mensajes estado={estado} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Modelo de impresora NIIMBOT" name="impresora_modelo" list="modelos-niimbot" defaultValue={ajustes.impresora_modelo} placeholder="Ej.: D110" ayuda="Está en la caja o en la etiqueta trasera del equipo." />
          <datalist id="modelos-niimbot">
            {MODELOS_NIIMBOT.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Campo etiqueta="Puntos por pulgada (DPI)" name="etiqueta_dpi" type="number" min={100} defaultValue={ajustes.etiqueta_dpi} ayuda="D11, D110, B1 y B21 imprimen a 203; B1 Pro y B21 Pro a 300." />
          <Selector
            etiqueta="Rollo cargado"
            name="rollo"
            value=""
            onChange={(e) => {
              const r = ROLLOS[Number(e.target.value)];
              if (r) {
                setAncho(String(r.ancho));
                setAlto(String(r.alto));
              }
            }}
            ayuda="Elige uno o escribe las medidas a mano."
          >
            <option value="">Elegir un rollo habitual…</option>
            {ROLLOS.map((r, i) => (
              <option key={r.nombre} value={i}>
                {r.nombre}
              </option>
            ))}
          </Selector>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Ancho (mm)" name="etiqueta_ancho_mm" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} />
            <Campo etiqueta="Alto (mm)" name="etiqueta_alto_mm" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} />
          </div>
        </div>
        <fieldset className="rounded-xl border border-borde p-3">
          <legend className="px-1 text-sm font-semibold">Líneas de la etiqueta</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {orden.map((l) => (
              <label key={l} className="flex items-center gap-2">
                <input type="checkbox" className="h-5 w-5 accent-primario" checked={lineas.includes(l)} onChange={() => alternar(l)} />
                <span>{LINEAS_ETIQUETA[l]}</span>
              </label>
            ))}
          </div>
          {orden.filter((l) => lineas.includes(l)).map((l) => (
            <input key={l} type="hidden" name="etiqueta_lineas" value={l} />
          ))}
        </fieldset>
        <Casilla etiqueta="Mostrar el precio en miles junto al código" name="etiqueta_mostrar_precio_miles" defaultChecked={ajustes.etiqueta_mostrar_precio_miles} ayuda="Como en las hojas: «SLA013 40». Si se desactiva, la etiqueta solo lleva el código." />
        <p className="text-sm text-texto-suave">
          La vista previa y la impresión están en <a href="/etiquetas" className="font-semibold text-primario">Imprimir etiquetas</a>. Bluetooth directo funciona en Chrome o Edge (Android y computador); en iPhone se usa el PNG con la app NIIMBOT.
        </p>
        <BotonEnviar grande={false} className="sm:w-auto">
          Guardar
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}

function SeccionCatalogo({ ajustes, urlApp }: { ajustes: Ajustes; urlApp: string }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarCatalogo, {});
  const [slug, setSlug] = useState(ajustes.catalogo_slug);
  return (
    <Tarjeta titulo="Catálogo público">
      <form action={accion} className="space-y-3">
        <Mensajes estado={estado} />
        <Casilla etiqueta="Activar el catálogo público" name="catalogo_publico_activo" defaultChecked={ajustes.catalogo_publico_activo} ayuda="Una página con fotos, nombres y precios al público de los productos marcados como visibles. No muestra stock ni precios base." />
        <Campo etiqueta="Dirección del catálogo" name="catalogo_slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} ayuda={`${urlApp || "https://tu-app"}/catalogo/${slug}`} />
        {ajustes.catalogo_publico_activo && (
          <p className="text-sm">
            Comparte este enlace por WhatsApp:{" "}
            <a href={`/catalogo/${ajustes.catalogo_slug}`} target="_blank" rel="noopener" className="font-semibold text-primario break-all">
              {urlApp || ""}/catalogo/{ajustes.catalogo_slug}
            </a>
          </p>
        )}
        <p className="text-sm text-texto-suave">Se muestran solo los productos marcados «Mostrar en el catálogo público», con foto, nombre y precio al público. Nunca el stock ni el precio base.</p>
        <BotonEnviar grande={false} className="sm:w-auto">
          Guardar
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}

function SeccionRespaldo({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarRespaldo, {});
  return (
    <Tarjeta titulo="Copias de seguridad">
      <form action={accion} className="space-y-3">
        <Mensajes estado={estado} />
        <Selector etiqueta="¿Dónde guardar la copia diaria?" name="respaldo_destino" defaultValue={ajustes.respaldo_destino} ayuda="Se guarda fuera de Supabase para no depender de un solo proveedor.">
          <option value="ninguno">Todavía no decidido</option>
          <option value="drive">Mi Google Drive</option>
          <option value="r2">Almacenamiento aparte (Cloudflare R2)</option>
        </Selector>
        <p className="text-sm text-texto-suave">
          Última copia automática: <strong>{ajustes.ultimo_respaldo_en ? new Date(ajustes.ultimo_respaldo_en).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "ninguna todavía"}</strong>. Ver <a href="/ajustes/respaldos" className="font-semibold text-primario">Copias de seguridad</a> para descargar un respaldo completo ahora.
        </p>
        <BotonEnviar grande={false} className="sm:w-auto">
          Guardar
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}
