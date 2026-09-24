import type { Metadata } from "next";
import { Archivo, Bodoni_Moda, Geist, Geist_Mono, Silkscreen } from "next/font/google";

import { getTheme } from "@/lib/theme";
import "./globals.css";
import "./stacks.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

// Pixel face for the Bookworm game; only fetched once the game is shown.
const silkscreen = Silkscreen({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Library Reservations",
  description: "Public view of current library reservations synced from Gmail.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();

  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} ${archivo.variable} ${silkscreen.variable}`}
      data-theme={theme}
      lang="en"
    >
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
