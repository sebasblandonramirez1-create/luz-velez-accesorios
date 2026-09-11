/**
 * Traduce errores de Postgres/Supabase a mensajes en español que dicen qué hacer.
 */
export function mensajeDeError(error: unknown): string {
  const e = error as { code?: string; message?: string; details?: string } | null;
  const texto = `${e?.message ?? ""} ${e?.details ?? ""}`;

  if (/STOCK_INSUFICIENTE/.test(texto)) {
    const m = /tiene (\d+) unidades y se intentan sacar (\d+)/.exec(texto);
    return m
      ? `No hay suficiente inventario: hay ${m[1]} y se intentan sacar ${m[2]}. Revisa la cantidad o registra primero una entrada.`
      : "No hay suficiente inventario para esa salida. Revisa la cantidad.";
  }
  if (/SIN_PERMISO/.test(texto)) return "Solo la propietaria puede hacer esto.";
  if (e?.code === "23505" || /duplicate key|productos_codigo_unico/.test(texto)) {
    return "Ya existe un producto con ese código. Elige otro o usa el que sugiere la app.";
  }
  if (e?.code === "23503") return "No se puede completar porque otro registro depende de este.";
  if (e?.code === "23514" || /check constraint/.test(texto)) return "Algún valor no es válido (revisa que los números no sean negativos y el código tenga el formato correcto).";
  if (e?.code === "42501" || /row-level security/.test(texto)) return "No tienes permiso para esta acción. Si crees que deberías tenerlo, pídele a la propietaria que revise tu cuenta en Ajustes.";
  if (/Invalid login credentials/.test(texto)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/.test(texto)) return "Falta confirmar el correo. Revisa la bandeja de entrada y la carpeta de no deseados.";
  if (/rate limit|too many requests/i.test(texto)) return "Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(texto)) return "Sin conexión. Revisa el internet e inténtalo de nuevo.";
  if (e?.message) return `Ocurrió un error: ${e.message}`;
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
