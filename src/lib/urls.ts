/** URL pública de un archivo del bucket «fotos» (bucket público de solo lectura). */
export function urlFoto(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/fotos/${ruta}`;
}
