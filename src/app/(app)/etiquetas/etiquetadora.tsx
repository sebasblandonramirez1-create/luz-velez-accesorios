"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Aviso, Boton, Tarjeta } from "@/components/ui";
import { BuscadorProducto, type ProductoBuscable } from "@/components/buscador-producto";
import { EtiquetaCanvas, dibujarEtiqueta } from "@/components/etiqueta-canvas";
import { cabeEnCabezal, nombreArchivoEtiqueta, tamanoEtiqueta, type ConfiguracionEtiqueta } from "@/lib/etiquetas";
import { bluetoothDisponible, imprimirPorBluetooth, tareasDisponibles, type EstadoImpresion } from "@/lib/niimbot";

type ProductoEtiquetable = ProductoBuscable & { precio_base: number; precio_publico: number };

export function Etiquetadora({
  cfg,
  impresora,
  productos,
  preseleccion,
}: {
  cfg: ConfiguracionEtiqueta;
  impresora: { modelo: string; anchoMm: number; altoMm: number; dpi: number };
  productos: ProductoEtiquetable[];
  preseleccion: string;
}) {
  const [cola, setCola] = useState<{ id: string; cantidad: number }[]>(() => (preseleccion && productos.some((p) => p.id === preseleccion) ? [{ id: preseleccion, cantidad: 1 }] : []));
  const [buscando, setBuscando] = useState(!preseleccion);
  const [estado, setEstado] = useState<EstadoImpresion | null>(null);
  const [tareas, setTareas] = useState<string[]>([]);
  const [tarea, setTarea] = useState("");
  const bt = useSyncExternalStore(
    () => () => {},
    () => bluetoothDisponible(),
    () => false,
  );
  const canvasOculto = useRef<HTMLCanvasElement | null>(null);

  const tamano = useMemo(() => tamanoEtiqueta(impresora.anchoMm, impresora.altoMm, impresora.dpi), [impresora]);
  const cabe = cabeEnCabezal(tamano, impresora.modelo);
  const items = cola.map((c) => ({ producto: productos.find((p) => p.id === c.id)!, cantidad: c.cantidad })).filter((x) => x.producto);
  const total = items.reduce((s, i) => s + i.cantidad, 0);
  const vista = items[0]?.producto ?? productos[0];

  useEffect(() => {
    let vigente = true;
    tareasDisponibles()
      .then((t) => vigente && setTareas(t))
      .catch(() => vigente && setTareas([]));
    return () => {
      vigente = false;
    };
  }, []);

  function agregar(id: string) {
    if (!id) return setBuscando(false);
    setCola((c) => (c.some((x) => x.id === id) ? c.map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + 1 } : x)) : [...c, { id, cantidad: 1 }]));
    setBuscando(false);
  }
  function fijarCantidad(id: string, n: number) {
    setCola((c) => c.map((x) => (x.id === id ? { ...x, cantidad: Math.max(1, Math.min(200, Number.isFinite(n) ? n : 1)) } : x)));
  }

  async function imprimirBluetooth() {
    setEstado({ fase: "conectando", mensaje: "Preparando…" });
    try {
      await imprimirPorBluetooth(
        items.map((i) => ({ producto: i.producto, cantidad: i.cantidad })),
        cfg,
        tamano,
        setEstado,
        { tareaForzada: tarea || undefined },
      );
    } catch (e) {
      const m = (e as Error).message ?? String(e);
      setEstado({ fase: "error", mensaje: /User cancelled|cancel/i.test(m) ? "Se canceló la selección de la impresora." : `No se pudo imprimir: ${m}` });
    }
  }

  function descargarPng(p: ProductoEtiquetable) {
    const canvas = canvasOculto.current ?? document.createElement("canvas");
    canvasOculto.current = canvas;
    dibujarEtiqueta(canvas, p, cfg, tamano);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivoEtiqueta(p.codigo);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, "image/png");
  }

  const consultaPdf = new URLSearchParams(items.map((i) => ["e", `${i.producto.id}:${i.cantidad}`])).toString();

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Vista previa">
        {vista ? (
          <div className="flex flex-wrap items-center gap-4">
            <EtiquetaCanvas producto={vista} cfg={cfg} tamano={tamano} escala={Math.min(2, 320 / tamano.anchoPx)} />
            <div className="text-sm text-texto-suave">
              <p>
                Rollo {impresora.anchoMm} × {impresora.altoMm} mm · {tamano.anchoPx} × {tamano.altoPx} px a {impresora.dpi} dpi
                {impresora.modelo ? ` · ${impresora.modelo}` : ""}
              </p>
              <p>
                <Link href="/ajustes#etiqueta" className="font-semibold text-primario">
                  Cambiar rollo, modelo o líneas
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-texto-suave">Añade productos para ver la etiqueta.</p>
        )}
        {!cabe.cabe && <Aviso tipo="alerta" className="mt-3">{cabe.motivo} Ajusta el tamaño del rollo en Ajustes.</Aviso>}
      </Tarjeta>

      <Tarjeta titulo={`Cola de impresión (${total} ${total === 1 ? "etiqueta" : "etiquetas"})`}>
        {items.length > 0 && (
          <ul className="mb-3 divide-y divide-borde">
            {items.map((i) => (
              <li key={i.producto.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{i.producto.nombre}</span>
                  <span className="block text-sm text-texto-suave">{i.producto.codigo}</span>
                </span>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-texto-suave">Cant.</span>
                  <input type="number" inputMode="numeric" min={1} max={200} value={i.cantidad} onChange={(e) => fijarCantidad(i.producto.id, Number.parseInt(e.target.value || "1", 10))} className="campo !min-h-10 w-20 text-center" aria-label={`Etiquetas de ${i.producto.codigo}`} />
                </label>
                <button type="button" onClick={() => descargarPng(i.producto)} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-primario" title="Descargar PNG para la app NIIMBOT">
                  PNG
                </button>
                <button type="button" onClick={() => setCola((c) => c.filter((x) => x.id !== i.producto.id))} aria-label={`Quitar ${i.producto.codigo}`} className="flex h-9 w-9 items-center justify-center rounded-full text-peligro hover:bg-peligro-claro">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscando ? (
          <BuscadorProducto productos={productos} seleccionado="" onSeleccionar={agregar} />
        ) : (
          <Boton variante="secundario" className="w-full" onClick={() => setBuscando(true)}>
            ➕ Añadir producto
          </Boton>
        )}
      </Tarjeta>

      <Tarjeta titulo="Imprimir">
        {estado && (
          <Aviso tipo={estado.fase === "error" ? "error" : estado.fase === "listo" ? "exito" : "info"} className="mb-3">
            {estado.mensaje}
          </Aviso>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-borde p-3">
            <p className="font-semibold">1. Bluetooth (directo)</p>
            <p className="mb-2 text-sm text-texto-suave">Chrome o Edge en Android o computador. Enciende la impresora y pulsa.</p>
            <Boton className="w-full" onClick={imprimirBluetooth} disabled={!bt || items.length === 0 || !cabe.cabe || estado?.fase === "conectando" || estado?.fase === "imprimiendo"}>
              🖨️ Imprimir por Bluetooth
            </Boton>
            {!bt && <p className="mt-1 text-xs text-alerta">Este navegador no tiene Bluetooth web (iPhone y Safari no lo permiten). Usa las opciones 2 o 3.</p>}
            {tareas.length > 0 && (
              <label className="mt-2 block text-xs text-texto-suave">
                Tipo de impresión (déjalo en automático salvo que falle)
                <select className="campo !min-h-9 mt-1 !py-1 text-sm" value={tarea} onChange={(e) => setTarea(e.target.value)}>
                  <option value="">Automático según el modelo</option>
                  {tareas.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="rounded-xl border border-borde p-3">
            <p className="font-semibold">2. PNG para la app NIIMBOT</p>
            <p className="mb-2 text-sm text-texto-suave">Descarga la imagen de cada etiqueta al tamaño exacto y ábrela desde la app oficial en el celular (funciona en iPhone).</p>
            <Boton variante="secundario" className="w-full" onClick={() => items.forEach((i) => descargarPng(i.producto))} disabled={items.length === 0}>
              ⬇️ Descargar PNG ({items.length})
            </Boton>
          </div>
          <div className="rounded-xl border border-borde p-3">
            <p className="font-semibold">3. Hoja PDF</p>
            <p className="mb-2 text-sm text-texto-suave">Para impresoras convencionales: una hoja con todas las etiquetas repetidas según la cantidad.</p>
            <Link href={`/imprimir/etiquetas?${consultaPdf}`} className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-borde bg-superficie px-4 font-semibold ${items.length === 0 ? "pointer-events-none opacity-50" : "hover:bg-primario-claro"}`}>
              📄 Abrir hoja para imprimir
            </Link>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}
