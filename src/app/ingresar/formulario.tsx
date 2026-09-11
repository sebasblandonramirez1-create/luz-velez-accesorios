"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { mensajeDeError } from "@/lib/errores";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";

export function FormularioIngreso({ volver, mensajeInicial }: { volver: string; mensajeInicial: string | null }) {
  const router = useRouter();
  const [modo, setModo] = useState<"contrasena" | "enlace">("contrasena");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(mensajeInicial);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);
    const supabase = clienteNavegador();
    try {
      if (modo === "contrasena") {
        const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena });
        if (error) throw error;
        router.replace(volver.startsWith("/") ? volver : "/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: correo.trim(),
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?siguiente=${encodeURIComponent(volver)}`, shouldCreateUser: false },
        });
        if (error) throw error;
        setAviso("Te enviamos un enlace al correo. Ábrelo desde este mismo celular o computador para entrar.");
      }
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function recuperar() {
    if (!correo.trim()) {
      setError("Escribe tu correo primero.");
      return;
    }
    setError(null);
    setCargando(true);
    try {
      const { error } = await clienteNavegador().auth.resetPasswordForEmail(correo.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?siguiente=${encodeURIComponent("/ajustes/contrasena")}`,
      });
      if (error) throw error;
      setAviso("Te enviamos un correo para cambiar la contraseña.");
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta>
      <form onSubmit={ingresar} className="space-y-4">
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo
          etiqueta="Correo"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        {modo === "contrasena" && (
          <Campo
            etiqueta="Contraseña"
            name="contrasena"
            type="password"
            autoComplete="current-password"
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        )}
        <Boton type="submit" grande className="w-full" disabled={cargando}>
          {cargando ? "Un momento…" : modo === "contrasena" ? "Entrar" : "Enviarme el enlace"}
        </Boton>
        <div className="flex flex-col gap-2 text-center text-sm">
          <button
            type="button"
            className="font-semibold text-primario underline-offset-2 hover:underline"
            onClick={() => {
              setModo(modo === "contrasena" ? "enlace" : "contrasena");
              setError(null);
            }}
          >
            {modo === "contrasena" ? "Entrar con un enlace al correo (sin contraseña)" : "Entrar con contraseña"}
          </button>
          {modo === "contrasena" && (
            <button type="button" className="text-texto-suave underline-offset-2 hover:underline" onClick={recuperar} disabled={cargando}>
              Olvidé mi contraseña
            </button>
          )}
        </div>
      </form>
    </Tarjeta>
  );
}
