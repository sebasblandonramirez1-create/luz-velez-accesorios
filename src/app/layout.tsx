import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Luz Vélez Accesorios", template: "%s · Luz Vélez Accesorios" },
  description: "Inventario, ventas y consignaciones de Luz Vélez Accesorios",
  applicationName: "Luz Vélez Accesorios",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Luz Vélez" },
};

export const viewport: Viewport = {
  themeColor: "#8f2f5a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Aplica el tamaño de letra guardado antes de pintar, para evitar saltos. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tamano-letra');if(t)document.documentElement.dataset.tamano=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
