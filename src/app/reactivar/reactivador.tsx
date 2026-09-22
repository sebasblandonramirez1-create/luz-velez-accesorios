"use client";

import { useEffect, useState, useTransition } from "react";
import { Aviso, Boton, BotonEnlace } from "@/components/ui";
import type { EstadoProyecto } from "@/lib/supabase/proyecto";
import { reactivarAplicacion } from "./acciones";

const TEXTO: Record<EstadoProyecto, { titulo: string; detalle: string }> = {
  activa: { titulo: "La aplicación está activa", detalle: "Ya puedes ingresar con normalidad." },
  dormida: {
    titulo: "La aplicación está dormida",
    detalle: "Supabase la pausa cuando pasa una semana sin uso. Toda la información (productos, ventas, fotos, cuentas) sigue guardada y vuelve intacta al reactivarla.",
  },
  despertando: { titulo: "Reactivando…", detalle: "Supabase está encendiendo la base de datos. Suele tardar entre uno y tres minutos. Esta pantalla se actualiza sola." },
  desconocido: { titulo: "No se pudo comprobar el estado", detalle: "Revisa el internet. Si la app sigue sin responder, reactívala desde el panel de Supabase." },
};

export function Reactivador({ estadoInicial, puedeReactivar, enlacePanel }: { estadoInicial: EstadoProyecto; puedeReactivar: boolean; enlacePanel: string | null }) {
  const [estado, setEstado] = useState<EstadoProyecto>(estadoInicial);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  // Mientras no esté activa, consulta el estado cada 10 segundos.
  useEffect(() => {
    if (estado === "activa") return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/reactivar/estado", { cache: "no-store" });
        if (!r.ok) return;
        const datos = (await r.json()) as { estado: EstadoProyecto };
        setEstado(datos.estado);
      } catch {
        // sin red: se vuelve a intentar en el siguiente ciclo
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [estado]);

  function reactivar() {
    iniciar(async () => {
      const r = await reactivarAplicacion();
      setMensaje({ ok: r.ok, texto: r.mensaje });
      if (r.ok && estado === "dormida") setEstado("despertando");
    });
  }

  const t = TEXTO[estado];
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-5xl" aria-hidden>
          {estado === "activa" ? "✅" : estado === "despertando" ? "⏳" : "😴"}
        </p>
        <h1 className="mt-3 text-2xl font-bold">{t.titulo}</h1>
        <p className="mt-2 text-texto-suave">{t.detalle}</p>
      </div>

      {mensaje && <Aviso tipo={mensaje.ok ? "exito" : "error"}>{mensaje.texto}</Aviso>}

      {estado === "activa" && (
        <BotonEnlace href="/ingresar" grande className="w-full">
          Ingresar
        </BotonEnlace>
      )}

      {estado === "dormida" && puedeReactivar && (
        <Boton grande className="w-full" onClick={reactivar} disabled={enviando}>
          {enviando ? "Pidiendo la reactivación…" : "Reactivar la aplicación"}
        </Boton>
      )}

      {estado !== "activa" && (
        <div className="rounded-xl border border-borde bg-superficie p-4 text-sm">
          <p className="font-semibold">{puedeReactivar ? "Si el botón no funciona, reactívala a mano:" : "Cómo reactivarla:"}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Abre{" "}
              {enlacePanel ? (
                <a href={enlacePanel} target="_blank" rel="noopener" className="font-semibold text-primario underline">
                  el proyecto en Supabase
                </a>
              ) : (
                "el proyecto en supabase.com"
              )}{" "}
              con la cuenta de la propietaria.
            </li>
            <li>
              Pulsa <strong>Restore project</strong> (o «Resume project») y confirma.
            </li>
            <li>Espera uno a tres minutos y vuelve a esta pantalla o a la de ingreso.</li>
          </ol>
          {!puedeReactivar && (
            <p className="mt-3 text-texto-suave">
              Para que este botón lo haga solo, la propietaria puede guardar un token de gestión de Supabase en Vercel (variable <code>SUPABASE_ACCESS_TOKEN</code>). El README explica cómo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
