/**
 * Códigos internos de producto: prefijo + tres dígitos (SLA013, SLAP026).
 * Las pulseras usan el prefijo SLAP; el resto, SLA. Ambos son configurables.
 */

export interface PrefijosCodigo {
  prefijo_general: string;
  prefijo_pulsera: string;
}

export function prefijoParaCategoria(categoria: string, prefijos: PrefijosCodigo): string {
  return categoria === "pulsera" ? prefijos.prefijo_pulsera : prefijos.prefijo_general;
}

/** Normaliza lo escrito por la usuaria: mayúsculas, sin espacios ni caracteres raros. */
export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "");
}

export function codigoValido(codigo: string): boolean {
  return /^[A-Z0-9-]{2,20}$/.test(codigo);
}

/**
 * Calcula el siguiente código libre para un prefijo a partir de una lista de
 * códigos existentes. Solo cuenta los que son exactamente prefijo + dígitos,
 * de modo que SLA y SLAP no se mezclan. Espejo en TypeScript de la función
 * SQL siguiente_codigo(), usada cuando no hay conexión.
 */
export function siguienteCodigo(prefijo: string, existentes: Iterable<string>, digitos = 3): string {
  const patron = new RegExp(`^${prefijo}([0-9]+)$`);
  let maximo = 0;
  for (const c of existentes) {
    const m = patron.exec(c);
    if (m) maximo = Math.max(maximo, Number.parseInt(m[1], 10));
  }
  return prefijo + String(maximo + 1).padStart(digitos, "0");
}

/**
 * Interpreta «SLA013 40» tal como aparece en las hojas: el código y, aparte,
 * el precio base en miles. Devuelve el precio en pesos (40 → 40.000).
 */
export function interpretarCodigoDeHoja(texto: string): { codigo: string; precioBase: number | null } {
  const m = /^\s*([A-Za-z]+\d+)\s*(\d+(?:[.,]\d+)?)?\s*$/.exec(texto);
  if (!m) return { codigo: normalizarCodigo(texto), precioBase: null };
  const codigo = normalizarCodigo(m[1]);
  const miles = m[2] ? Number.parseFloat(m[2].replace(",", ".")) : null;
  return { codigo, precioBase: miles == null ? null : Math.round(miles * 1000) };
}
