import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Luz Vélez Accesorios",
    short_name: "Luz Vélez",
    description: "Inventario, ventas y consignaciones",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f5",
    theme_color: "#8f2f5a",
    lang: "es-CO",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/icono-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
