export const metadata = { title: "Sin conexión" };

/** Se muestra desde el service worker cuando no hay red y la página no está guardada. */
export default function PaginaSinConexion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <p className="text-5xl">📡</p>
      <h1 className="mt-3 text-2xl font-bold">Sin conexión</h1>
      <p className="mt-2 max-w-sm text-texto-suave">
        No hay internet ahora mismo. Puedes ver las pantallas que abriste antes. Las ventas y movimientos que registres se guardan en el celular y se envían solos cuando vuelva la conexión.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa a propósito: sin red no hay navegación interna */}
      <a href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primario px-6 font-semibold text-white">
        Volver a intentar
      </a>
    </main>
  );
}
