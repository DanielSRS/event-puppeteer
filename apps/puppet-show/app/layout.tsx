/* app/layout.tsx */

import type { Metadata } from "next";
import { NavbarContainer } from "@/components/navbar/containers/NavbarContainer";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-screen flex flex-col">
        <NavbarContainer />

        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
};