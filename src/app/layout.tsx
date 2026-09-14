import type { Metadata, Viewport } from "next";
import { Cinzel, Geist, Josefin_Sans } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Tipografía del logo: LUZAZUL en Cinzel (serif de mayúsculas) y «accesorios» en Josefin Sans fina.
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["600", "700"] });
const josefin = Josefin_Sans({ variable: "--font-josefin", subsets: ["latin"], weight: ["300", "400"] });

export const metadata: Metadata = {
  title: { default: "Luzazul Accesorios", template: "%s · Luzazul Accesorios" },
  description: "Inventario, ventas y consignaciones de Luzazul Accesorios",
  applicationName: "Luzazul Accesorios",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Luzazul" },
};

export const viewport: Viewport = {
  themeColor: "#8a6a2d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${geist.variable} ${cinzel.variable} ${josefin.variable} h-full antialiased`} suppressHydrationWarning>
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
