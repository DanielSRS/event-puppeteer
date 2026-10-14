/**
 * Root layout: fonts, theme, global styles, the top bar and a skip link.
 *
 * @module
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { NavbarContainer } from "@/components/navbar/containers/NavbarContainer";
import { ThemeSync } from "@/components/ui/theme-toggle";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display face for titles and headings. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mural de Eventos",
  description: "Publique e descubra eventos perto de você.",
};

/**
 * Every page: skip link, top bar (hidden on the TV display) and the page itself.
 * `data-theme` and `--org` are set by an inline script before the first paint,
 * so React is told not to warn about the attributes differing from the server.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 button main"
        >
          Pular para o conteúdo
        </a>

        <ThemeSync />

        <QueryProvider>
          <NavbarContainer />

          <div id="conteudo" tabIndex={-1} className="flex-1 flex flex-col outline-none">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
