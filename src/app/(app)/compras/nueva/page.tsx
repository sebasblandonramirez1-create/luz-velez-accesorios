import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/ui";
import { FormularioCompra } from "./formulario-compra";

export const metadata = { title: "Registrar compra" };

export default async function PaginaNuevaCompra() {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/");
  const supabase = await clienteServidor();
  const [{ data: productos }, { data: proveedores }] = await Promise.all([
    supabase.from("productos").select("id, codigo, nombre, stock_actual, costo_compra, precio_base, producto_fotos(ruta_miniatura, principal)").is("eliminado_en", null).order("codigo"),
    supabase.from("contactos").select("id, nombre").eq("tipo", "proveedor").is("eliminado_en", null).order("nombre"),
  ]);
  return (
    <div>
      <Encabezado titulo="Registrar compra" volver="/compras" subtitulo="Elige los productos, la cantidad y lo que pagaste por cada uno. Si el producto es nuevo, créalo primero en Productos." />
      <FormularioCompra
        productos={(productos ?? []).map((x) => ({
          id: x.id,
          codigo: x.codigo,
          nombre: x.nombre,
          stock_actual: x.stock_actual,
          costo: x.costo_compra ?? 0,
          miniatura: x.producto_fotos?.find((f) => f.principal)?.ruta_miniatura ?? x.producto_fotos?.[0]?.ruta_miniatura ?? null,
        }))}
        proveedores={proveedores ?? []}
      />
    </div>
  );
}
