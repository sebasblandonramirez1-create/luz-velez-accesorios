import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, Tarjeta } from "@/components/ui";
import { fechaHora, horasDesde } from "@/lib/formato";
import { DescargarRespaldo } from "./descargar";

export const metadata = { title: "Copias de seguridad" };

export default async function PaginaRespaldos() {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/ajustes");
  const supabase = await clienteServidor();
  const { data: ajustes } = await supabase.from("ajustes").select("respaldo_destino, ultimo_respaldo_en, ultimo_respaldo_detalle").eq("id", 1).single();
  const horas = horasDesde(ajustes?.ultimo_respaldo_en);
  const destino = ajustes?.respaldo_destino ?? "ninguno";

  return (
    <div className="space-y-4">
      <Encabezado titulo="Copias de seguridad" volver="/ajustes" subtitulo="Una copia completa y legible de todos los datos y las fotos." />

      <Tarjeta titulo="Copia automática diaria">
        {horas == null ? (
          <Aviso tipo="alerta">Todavía no se ha hecho ninguna copia automática.</Aviso>
        ) : horas > 48 ? (
          <Aviso tipo="alerta">La última copia automática tiene más de {Math.floor(horas)} horas ({fechaHora(ajustes!.ultimo_respaldo_en)}).</Aviso>
        ) : (
          <Aviso tipo="exito">Última copia automática: {fechaHora(ajustes!.ultimo_respaldo_en)}.</Aviso>
        )}
        {ajustes?.ultimo_respaldo_detalle && <p className="mt-2 text-sm text-texto-suave">{ajustes.ultimo_respaldo_detalle}</p>}
        <p className="mt-3 text-sm text-texto-suave">
          Destino elegido: <strong>{destino === "drive" ? "Google Drive" : destino === "r2" ? "Cloudflare R2" : "todavía no decidido"}</strong>. La copia la hace GitHub cada día a las 3:30 de la mañana
          y conserva 30 copias diarias y una por mes durante un año. Cómo configurar el destino: README, sección «Copias de seguridad».
        </p>
      </Tarjeta>

      <Tarjeta titulo="Descargar un respaldo completo ahora">
        <p className="mb-3 text-sm text-texto-suave">
          Se descarga un archivo .zip con todas las tablas en JSON y CSV (se abren en Excel) y todas las fotos. Guárdalo en tu computador o en tu nube. Con este archivo se puede reconstruir la app entera (README, «Cómo restaurar un respaldo»).
        </p>
        <DescargarRespaldo />
      </Tarjeta>
    </div>
  );
}
