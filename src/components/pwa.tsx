"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { esErrorDeRed, leerPendientes, marcarErrorPendiente, quitarPendiente, suscribirPendientes, type OperacionPendiente } from "@/lib/pendientes";
import { registrarVenta, type DatosVenta } from "@/app/(app)/ventas/acciones";
import { registrarConsignacion, registrarLiquidacion, type DatosConsignacion, type DatosLiquidacion } from "@/app/(app)/consignaciones/acciones";
import { registrarCompra, type DatosCompra } from "@/app/(app)/compras/acciones";

/** Registra el service worker (solo en producción o si se fuerza). */
export function RegistroServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !location.search.includes("sw=1")) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

function useEnLinea() {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener("online", avisar);
      window.addEventListener("offline", avisar);
      return () => {
        window.removeEventListener("online", avisar);
        window.removeEventListener("offline", avisar);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

const vacio: OperacionPendiente[] = [];
let cacheSerializada = "";
let cacheLista: OperacionPendiente[] = vacio;
function leerEstable(): OperacionPendiente[] {
  const s = localStorage.getItem("operaciones-pendientes") ?? "[]";
  if (s !== cacheSerializada) {
    cacheSerializada = s;
    cacheLista = leerPendientes();
  }
  return cacheLista;
}

async function ejecutar(op: OperacionPendiente): Promise<{ error?: string }> {
  switch (op.tipo) {
    case "venta":
      return registrarVenta(op.carga as DatosVenta);
    case "consignacion":
      return registrarConsignacion(op.carga as DatosConsignacion);
    case "liquidacion":
      return registrarLiquidacion(op.carga as DatosLiquidacion);
    case "compra":
      return registrarCompra(op.carga as DatosCompra);
    default:
      return { error: "Operación desconocida." };
  }
}

/**
 * Aviso de conexión y cola de operaciones pendientes: las reintenta al volver
 * la red y permite descartarlas.
 */
export function SincronizarPendientes() {
  const router = useRouter();
  const enLinea = useEnLinea();
  const pendientes = useSyncExternalStore(suscribirPendientes, leerEstable, () => vacio);
  const [sincronizando, setSincronizando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!enLinea || sincronizando) return;
    const lista = leerPendientes().filter((o) => !o.error);
    if (lista.length === 0) return;
    let cancelado = false;
    (async () => {
      setSincronizando(true);
      try {
        for (const op of lista) {
          if (cancelado) break;
          const r = await ejecutar(op);
          if (!r.error) quitarPendiente(op.id);
          else if (!esErrorDeRed(r.error)) marcarErrorPendiente(op.id, r.error);
          else break;
        }
        router.refresh();
      } finally {
        setSincronizando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea, pendientes.length]);

  if (enLinea && pendientes.length === 0) return null;

  return (
    <div className="no-imprimir fixed inset-x-0 top-0 z-30 flex justify-center px-3 pt-2 md:top-auto md:bottom-4 md:justify-end md:pr-4">
      <div className={`w-full max-w-md rounded-xl border px-4 py-2 text-sm shadow-lg ${enLinea ? "border-alerta/30 bg-alerta-claro text-alerta" : "border-peligro/30 bg-peligro-claro text-peligro"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">
            {!enLinea ? "Sin conexión" : sincronizando ? "Enviando lo pendiente…" : `${pendientes.length} ${pendientes.length === 1 ? "operación pendiente" : "operaciones pendientes"}`}
            {!enLinea && pendientes.length > 0 ? ` · ${pendientes.length} por enviar` : ""}
          </span>
          {pendientes.length > 0 && (
            <button type="button" onClick={() => setAbierto((a) => !a)} className="font-semibold underline">
              {abierto ? "Ocultar" : "Ver"}
            </button>
          )}
        </div>
        {abierto && (
          <ul className="mt-2 divide-y divide-current/20">
            {pendientes.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  {o.descripcion}
                  {o.error && <span className="block text-xs">No se pudo enviar: {o.error}</span>}
                </span>
                <button type="button" onClick={() => quitarPendiente(o.id)} className="text-xs font-semibold underline">
                  Descartar
                </button>
              </li>
            ))}
          </ul>
        )}
        {!enLinea && (
          <p className="mt-1 text-xs">
            Puedes seguir consultando lo que ya abriste. <Link href="/sin-conexion" className="underline">Más información</Link>
          </p>
        )}
      </div>
    </div>
  );
}
