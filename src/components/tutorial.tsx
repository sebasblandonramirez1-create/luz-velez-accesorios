"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { Boton } from "./ui";

const CLAVE = "tutorial-visto";
const EVENTO = "tutorial-cambiado";

const PASOS = [
  { titulo: "Bienvenida", texto: "Esta app reemplaza las hojas de Excel. Todo lo que registres queda guardado en la nube y se ve desde el celular y el computador.", enlace: null },
  { titulo: "1. Tus productos", texto: "En «Productos» añades cada pieza con foto, código y precios. También puedes importar tu catálogo desde Excel.", enlace: { href: "/productos", texto: "Ir a productos" } },
  { titulo: "2. Ventas en tres toques", texto: "En «Ventas» buscas el producto, pones la cantidad y confirmas. El inventario se descuenta solo y puedes enviar el comprobante por WhatsApp.", enlace: { href: "/ventas/nueva", texto: "Registrar una venta" } },
  { titulo: "3. Consignación como tus hojas", texto: "En «Consignación» registras lo que se lleva cada vendedora y, cuando te trae la cuenta, marcas lo vendido y lo devuelto. Las hojas VENTAS, DEVOLUCIONES y PENDIENTE DE PAGO se imprimen igual que hoy.", enlace: { href: "/consignaciones", texto: "Ver consignaciones" } },
  { titulo: "4. Todo lo demás en «Más»", texto: "Inventario, contactos, cuentas por cobrar, compras, gastos, caja del día, reportes, etiquetas y ajustes. Si borras algo por error, está en la papelera 30 días.", enlace: { href: "/ajustes", texto: "Abrir «Más»" } },
];

function leer() {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return true;
  }
}
function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
}
function marcarVisto() {
  try {
    localStorage.setItem(CLAVE, "1");
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}
export function reiniciarTutorial() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

/** Tutorial breve de primer uso (se muestra una vez por navegador). */
export function Tutorial() {
  const visto = useSyncExternalStore(suscribir, leer, () => true);
  const [paso, setPaso] = useState(0);
  if (visto) return null;
  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
      <div className="w-full max-w-md rounded-2xl bg-superficie p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <h2 id="tutorial-titulo" className="mt-1 text-xl font-bold">
          {p.titulo}
        </h2>
        <p className="mt-2 text-texto-suave">{p.texto}</p>
        {p.enlace && (
          <Link href={p.enlace.href} onClick={marcarVisto} className="mt-2 inline-block font-semibold text-primario">
            {p.enlace.texto} →
          </Link>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={marcarVisto} className="min-h-11 px-2 text-sm font-semibold text-texto-suave">
            Saltar
          </button>
          <div className="flex gap-2">
            {paso > 0 && (
              <Boton variante="secundario" onClick={() => setPaso(paso - 1)}>
                Atrás
              </Boton>
            )}
            <Boton onClick={() => (ultimo ? marcarVisto() : setPaso(paso + 1))}>{ultimo ? "¡Listo!" : "Siguiente"}</Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BotonVerTutorial() {
  return (
    <button type="button" onClick={reiniciarTutorial} className="min-h-12 rounded-xl border border-borde bg-superficie px-4 font-semibold">
      Ver el tutorial otra vez
    </button>
  );
}
