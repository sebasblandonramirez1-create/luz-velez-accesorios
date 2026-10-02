"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Boton, Campo } from "@/components/ui";
import { LienzoFirma } from "@/components/lienzo-firma";
import { validarDatosFirma, type PersonaRecibo } from "@/lib/recibo";
import { firmarRecibo } from "./acciones";

/** Datos de quien recibe y firma con el dedo. Parte de la ficha del contacto. */
export function FormularioFirma({ token, inicial }: { token: string; inicial: PersonaRecibo }) {
  const router = useRouter();
  const [datos, setDatos] = useState<PersonaRecibo>(inicial);
  const [firma, setFirma] = useState<string | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (clave: keyof PersonaRecibo) => (e: React.ChangeEvent<HTMLInputElement>) => setDatos((d) => ({ ...d, [clave]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const paquete = { ...datos, firma: firma ?? "", acepta };
    const problema = validarDatosFirma(paquete);
    if (problema) return setError(problema);
    setEnviando(true);
    setError(null);
    let r: { ok?: true; error?: string };
    try {
      r = await firmarRecibo(token, paquete);
    } catch {
      r = { error: "Sin conexión. Revisa el internet e inténtalo de nuevo." };
    }
    setEnviando(false);
    if (r.error) return setError(r.error);
    router.refresh();
    window.scrollTo({ top: 0 });
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo" name="nombre" autoComplete="name" required value={datos.nombre} onChange={cambiar("nombre")} className="sm:col-span-2" />
        <Campo etiqueta="Cédula o NIT" name="documento" inputMode="numeric" required value={datos.documento} onChange={cambiar("documento")} />
        <Campo etiqueta="Celular / WhatsApp" name="telefono" type="tel" inputMode="tel" autoComplete="tel" value={datos.telefono} onChange={cambiar("telefono")} />
        <Campo etiqueta="Correo electrónico (opcional)" name="correo" type="email" inputMode="email" autoComplete="email" value={datos.correo} onChange={cambiar("correo")} className="sm:col-span-2" />
        <Campo etiqueta="Dirección" name="direccion" autoComplete="street-address" value={datos.direccion} onChange={cambiar("direccion")} />
        <Campo etiqueta="Ciudad y barrio" name="ciudad" autoComplete="address-level2" value={datos.ciudad} onChange={cambiar("ciudad")} />
      </div>

      <div>
        <p className="mb-1 font-semibold">Tu firma</p>
        <LienzoFirma onCambio={setFirma} deshabilitado={enviando} />
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie p-3">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[var(--primario)]" />
        <span>Recibí la mercancía relacionada en este recibo, mis datos son correctos y acepto las condiciones de la consignación.</span>
      </label>

      {error && <Aviso tipo="error">{error}</Aviso>}
      <Boton type="submit" grande variante="acento" className="w-full" disabled={enviando}>
        {enviando ? "Guardando la firma…" : "Firmar el recibo"}
      </Boton>
      <p className="text-center text-xs text-texto-suave">Al firmar se guardan la fecha, la hora y los datos de este dispositivo como constancia.</p>
    </form>
  );
}
