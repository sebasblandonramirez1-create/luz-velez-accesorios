import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Database } from "@/lib/tipos";
import { CATEGORIAS, type CategoriaProducto } from "@/lib/tipos";
import { pesos } from "@/lib/formato";
import { urlFoto } from "@/lib/urls";
import { enlaceWhatsApp } from "@/lib/ventas";
import { entornoSupabase } from "@/lib/supabase/entorno";
import { Marca } from "@/components/marca";

export const dynamic = "force-dynamic";

/** Cliente anónimo: el catálogo es público y solo lee la vista catalogo_publico. */
function clienteAnonimo() {
  const { url, clave } = entornoSupabase();
  return createClient<Database>(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cargar(slug: string) {
  const supabase = clienteAnonimo();
  const [{ data: productos, error }, { data: ajustes }] = await Promise.all([
    supabase.from("catalogo_publico").select("*").order("categoria").order("nombre"),
    // Solo lo público del negocio: nombre, teléfono y la dirección del catálogo.
    supabase.rpc("datos_publicos_negocio").maybeSingle(),
  ]);
  const negocio = ajustes as { nombre_negocio: string; telefono_negocio: string; catalogo_slug: string; catalogo_publico_activo: boolean } | null;
  if (error || !negocio || !negocio.catalogo_publico_activo || negocio.catalogo_slug !== slug) return null;
  return { productos: productos ?? [], negocio };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const datos = await cargar(slug);
  return { title: datos ? `Catálogo · ${datos.negocio.nombre_negocio}` : "Catálogo", robots: { index: false } };
}

export default async function PaginaCatalogo({ params }: PageProps<"/catalogo/[slug]">) {
  const { slug } = await params;
  const datos = await cargar(slug);
  if (!datos) notFound();
  const { productos, negocio } = datos;
  const porCategoria = new Map<CategoriaProducto, typeof productos>();
  for (const p of productos) porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), p]);

  return (
    <main className="min-h-screen bg-fondo">
      <header className="acuarela border-b border-borde px-4 py-8 text-center">
        <h1 className="sr-only">{negocio.nombre_negocio}</h1>
        <Marca tamano="lg" />
        <p className="mt-2 text-texto-suave">Catálogo</p>
        {negocio.telefono_negocio && (
          <a href={enlaceWhatsApp(negocio.telefono_negocio, `Hola, vi el catálogo de ${negocio.nombre_negocio} y me interesa una pieza.`)} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primario px-5 font-semibold text-white" target="_blank" rel="noopener">
            Escribir por WhatsApp
          </a>
        )}
      </header>
      <div className="mx-auto max-w-5xl p-4">
        {productos.length === 0 && <p className="py-12 text-center text-texto-suave">Pronto habrá novedades.</p>}
        {[...porCategoria.entries()].map(([cat, lista]) => (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 text-xl font-bold">{CATEGORIAS[cat]}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {lista.map((p) => {
                const url = urlFoto(p.foto);
                const texto = `Hola, me interesa ${p.nombre} (${p.codigo}) que vi en el catálogo.`;
                return (
                  <li key={p.id} className="overflow-hidden rounded-2xl border border-borde bg-superficie">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={p.nombre} className="aspect-square w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-fondo text-4xl text-texto-suave/40">◈</div>
                    )}
                    <div className="p-3">
                      <p className="font-semibold leading-tight">{p.nombre}</p>
                      <p className="text-sm text-texto-suave">
                        {p.material}
                        {p.material && p.color ? " · " : ""}
                        {p.color}
                      </p>
                      <p className="mt-1 text-lg font-bold">$ {pesos(p.precio_publico)}</p>
                      {negocio.telefono_negocio && (
                        <a href={enlaceWhatsApp(negocio.telefono_negocio, texto)} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-acento px-3 text-sm font-semibold text-white">
                          Pedir
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="py-6 text-center text-xs text-texto-suave">Precios en pesos colombianos. Disponibilidad sujeta a confirmación.</p>
      </div>
    </main>
  );
}
