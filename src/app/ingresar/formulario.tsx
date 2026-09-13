"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { mensajeDeError } from "@/lib/errores";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";

type Modo = "contrasena" | "enlace" | "crear";

export function FormularioIngreso({ volver, mensajeInicial }: { volver: string; mensajeInicial: string | null }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("contrasena");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(mensajeInicial);

  function cambiarModo(m: Modo) {
    setModo(m);
    setError(null);
    setAviso(null);
  }

  async function enviar(e: React.FormEvent) {
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
      } else if (modo === "enlace") {
        const { error } = await supabase.auth.signInWithOtp({
          email: correo.trim(),
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?siguiente=${encodeURIComponent(volver)}`, shouldCreateUser: false },
        });
        if (error) throw error;
        setAviso("Te enviamos un enlace al correo. Ábrelo desde este mismo celular o computador para entrar.");
      } else {
        if (contrasena.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email: correo.trim(),
          password: contrasena,
          options: { data: { nombre: nombre.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          if (/Database error|SIN_INVITACION/i.test(error.message)) {
            throw new Error("Ese correo no tiene invitación. Pide a la propietaria que te invite desde Ajustes → Usuarias y usa el mismo correo.");
          }
          throw error;
        }
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setAviso("Cuenta creada. Revisa tu correo y pulsa el enlace de confirmación; después entra con tu contraseña.");
          setModo("contrasena");
        }
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
      <form onSubmit={enviar} className="space-y-4">
        {modo === "crear" && <p className="font-semibold">Crear cuenta con invitación</p>}
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {modo === "crear" && <Campo etiqueta="Tu nombre" name="nombre" autoComplete="name" required value={nombre} onChange={(e) => setNombre(e.target.value)} />}
        <Campo etiqueta="Correo" name="correo" type="email" autoComplete="email" inputMode="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} ayuda={modo === "crear" ? "El mismo correo al que te invitaron." : undefined} />
        {modo !== "enlace" && (
          <Campo
            etiqueta={modo === "crear" ? "Elige una contraseña" : "Contraseña"}
            name="contrasena"
            type="password"
            autoComplete={modo === "crear" ? "new-password" : "current-password"}
            minLength={modo === "crear" ? 8 : undefined}
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            ayuda={modo === "crear" ? "Mínimo 8 caracteres." : undefined}
          />
        )}
        <Boton type="submit" grande className="w-full" disabled={cargando}>
          {cargando ? "Un momento…" : modo === "contrasena" ? "Entrar" : modo === "enlace" ? "Enviarme el enlace" : "Crear mi cuenta"}
        </Boton>
        <div className="flex flex-col gap-2 text-center text-sm">
          {modo !== "contrasena" && (
            <button type="button" className="font-semibold text-primario underline-offset-2 hover:underline" onClick={() => cambiarModo("contrasena")}>
              Ya tengo cuenta: entrar con contraseña
            </button>
          )}
          {modo === "contrasena" && (
            <>
              <button type="button" className="font-semibold text-primario underline-offset-2 hover:underline" onClick={() => cambiarModo("enlace")}>
                Entrar con un enlace al correo (sin contraseña)
              </button>
              <button type="button" className="text-texto-suave underline-offset-2 hover:underline" onClick={recuperar} disabled={cargando}>
                Olvidé mi contraseña
              </button>
              <button type="button" className="text-texto-suave underline-offset-2 hover:underline" onClick={() => cambiarModo("crear")}>
                Me invitaron: crear cuenta con invitación
              </button>
            </>
          )}
        </div>
      </form>
    </Tarjeta>
  );
}
