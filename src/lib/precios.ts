/**
 * Regla de precio al público, configurable desde Ajustes.
 *
 * - «manual»: la propietaria escribe el precio al público pieza por pieza.
 * - «multiplicador»: precio al público = precio base × factor, redondeado.
 *
 * Redondeos:
 * - «ninguno»: al peso.
 * - «centena»: al múltiplo de 100 más cercano.
 * - «mil»: al múltiplo de 1.000 más cercano.
 * - «terminacion_900»: al múltiplo de 1.000 superior menos 100 (39.900, 118.900…).
 */

export type ReglaPrecioPublico = "manual" | "multiplicador";
export type RedondeoPrecio = "ninguno" | "centena" | "mil" | "terminacion_900";

export interface ConfiguracionPrecios {
  regla_precio_publico: ReglaPrecioPublico;
  factor_precio_publico: number;
  redondeo_precio_publico: RedondeoPrecio;
}

export function redondearPrecio(valor: number, redondeo: RedondeoPrecio): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  switch (redondeo) {
    case "centena":
      return Math.round(valor / 100) * 100;
    case "mil":
      return Math.round(valor / 1000) * 1000;
    case "terminacion_900": {
      const arriba = Math.ceil(valor / 1000) * 1000;
      return Math.max(900, arriba - 100);
    }
    default:
      return Math.round(valor);
  }
}

/**
 * Calcula el precio al público sugerido a partir del precio base.
 * Con la regla «manual» devuelve null: no hay sugerencia automática.
 */
export function precioPublicoSugerido(precioBase: number, cfg: ConfiguracionPrecios): number | null {
  if (cfg.regla_precio_publico !== "multiplicador") return null;
  const factor = Number(cfg.factor_precio_publico);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return redondearPrecio(precioBase * factor, cfg.redondeo_precio_publico);
}

/** Texto que explica la regla a la usuaria en Ajustes. */
export function describirRegla(cfg: ConfiguracionPrecios): string {
  if (cfg.regla_precio_publico === "manual") {
    return "Cada pieza tiene su precio al público escrito a mano.";
  }
  const ejemplo = precioPublicoSugerido(40_000, cfg);
  return `Precio al público = precio base × ${cfg.factor_precio_publico}. Ejemplo: base 40.000 → ${ejemplo?.toLocaleString("es-CO")}.`;
}
