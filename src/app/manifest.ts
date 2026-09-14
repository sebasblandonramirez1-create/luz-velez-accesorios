import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Luzazul Accesorios",
    short_name: "Luzazul",
    description: "Inventario, ventas y consignaciones",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ede2",
    theme_color: "#8a6a2d",
    lang: "es-CO",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/icono-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
