"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Boton, Campo, Selector } from "@/components/ui";
import { CampoPesos } from "@/components/campo-pesos";
import { hoyIso, pesos } from "@/lib/formato";
import { MEDIOS_PAGO, type MedioPago } from "@/lib/tipos";
import { registrarLiquidacion } from "../acciones";

interface LineaPendiente {
  id: string;
  codigo: string;
  nombre: string;
  valor_unitario: number;
  pendiente: number;
}

export function FormularioLiquidacion({ consignacionId, lineas, saldoActual }: { consignacionId: string; lineas: LineaPendiente[]; saldoActual: number }) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, { vendida: number; devuelta: number }>>(() => Object.fromEntries(lineas.map((l) => [l.id, { vendida: 0, devuelta: 0 }])));
  const [abono, setAbono] = useState<number | null>(null);
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const vendidoAhora = lineas.reduce((s, l) => s + (valores[l.id]?.vendida ?? 0) * l.valor_unitario, 0);
  const devueltas = lineas.reduce((s, l) => s + (valores[l.id]?.devuelta ?? 0), 0);
  const vendidas = lineas.reduce((s, l) => s + (valores[l.id]?.vendida ?? 0), 0);
  const nuevoSaldo = saldoActual + vendidoAhora - (abono ?? 0);

  function fijar(id: string, campo: "vendida" | "devuelta", valor: number, max: number) {
    setValores((v) => {
      const actual = v[id] ?? { vendida: 0, devuelta: 0 };
      const n = Math.max(0, Math.min(Number.isFinite(valor) ? valor : 0, max));
      const otro = campo === "vendida" ? actual.devuelta : actual.vendida;
      return { ...v, [id]: { ...actual, [campo]: Math.min(n, max - otro) } };
    });
  }

  function todoDevuelto() {
    setValores(Object.fromEntries(lineas.map((l) => [l.id, { vendida: 0, devuelta: l.pendiente }])));
  }

  async function confirmar() {
    if (vendidas + devueltas === 0 && !(abono && abono > 0)) return setError("Marca al menos una pieza vendida o devuelta, o registra un abono.");
    if (abono && abono > saldoActual + vendidoAhora) return setError(`El abono (${pesos(abono)}) supera lo que debe (${pesos(saldoActual + vendidoAhora)}).`);
    setEnviando(true);
    setError(null);
    const r = await registrarLiquidacion({
      consignacion_id: consignacionId,
      fecha,
      nota,
      abono: abono ?? 0,
      medio_pago: medio,
      lineas: lineas.map((l) => ({ consignacion_linea_id: l.id, cantidad_vendida: valores[l.id]?.vendida ?? 0, cantidad_devuelta: valores[l.id]?.devuelta ?? 0 })),
    });
    setEnviando(false);
    if (r.error) return setError(r.error);
    router.push(`/consignaciones/${consignacionId}?aviso=${encodeURIComponent("Liquidación registrada.")}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex justify-end">
        <button type="button" onClick={todoDevuelto} className="text-sm font-semibold text-primario">
          Marcar todo lo pendiente como devuelto
        </button>
      </div>
      <ul className="divide-y divide-borde">
        {lineas.map((l) => {
          const v = valores[l.id] ?? { vendida: 0, devuelta: 0 };
          const queda = l.pendiente - v.vendida - v.devuelta;
          return (
            <li key={l.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{l.nombre}</span>
                <span className="block text-xs text-texto-suave">
                  {l.codigo} · {pesos(l.valor_unitario)} · pendientes {l.pendiente} → quedan {queda}
                </span>
              </span>
              <label className="block text-center">
                <span className="block text-xs font-semibold text-exito">Vendió</span>
                <input type="number" inputMode="numeric" min={0} max={l.pendiente} value={v.vendida} onChange={(e) => fijar(l.id, "vendida", Number.parseInt(e.target.value || "0", 10), l.pendiente)} className="campo !min-h-11 w-20 text-center" aria-label={`Vendidas de ${l.codigo}`} />
              </label>
              <label className="block text-center">
                <span className="block text-xs font-semibold text-primario">Devuelve</span>
                <input type="number" inputMode="numeric" min={0} max={l.pendiente} value={v.devuelta} onChange={(e) => fijar(l.id, "devuelta", Number.parseInt(e.target.value || "0", 10), l.pendiente)} className="campo !min-h-11 w-20 text-center" aria-label={`Devueltas de ${l.codigo}`} />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="rounded-xl bg-fondo p-3 text-sm">
        Vendido en esta visita: <strong>{pesos(vendidoAhora)}</strong> · saldo anterior {pesos(saldoActual)} · <strong>debe {pesos(saldoActual + vendidoAhora)}</strong>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CampoPesos etiqueta="¿Cuánto paga hoy? (opcional)" name="abono" onCambio={setAbono} />
        <Selector etiqueta="Medio de pago" name="medio_pago" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
          {Object.entries(MEDIOS_PAGO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Fecha" name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <Campo etiqueta="Nota (opcional)" name="nota" value={nota} onChange={(e) => setNota(e.target.value)} />
      <p className="text-sm text-texto-suave">Después de esta liquidación quedará debiendo {pesos(Math.max(0, nuevoSaldo))}.</p>
      <Boton grande className="w-full" onClick={confirmar} disabled={enviando}>
        {enviando ? "Guardando…" : "Registrar liquidación"}
      </Boton>
    </div>
  );
}
