/**
 * Root layout: fonts, global styles, the top bar and a skip link.
 *
 * @module
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { NavbarContainer } from "@/components/navbar/containers/NavbarContainer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mural de Eventos",
  description: "Publique e descubra eventos perto de você.",
};

/** Every page: skip link, top bar (hidden on the TV display) and the page itself. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-screen flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 button main"
        >
          Pular para o conteúdo
        </a>

        <NavbarContainer />

        <div id="conteudo" tabIndex={-1} className="flex-1 flex flex-col outline-none">
          {children}
        </div>
      </body>
    </html>
  );
}
