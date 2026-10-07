/* components/navbar/Navbar.tsx */

"use client";

import Link from "next/link";
import { MdAdd, MdLogout } from "react-icons/md";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-muted bg-background/90 backdrop-blur">
      <nav className="between gap-3 max-w-6xl mx-auto px-4 h-14">
        <Link href="/" className="subtitle shrink-0">
          Mural de Eventos
        </Link>

        {loading ? null : user ? (
          <div className="row gap-2">
            <Link href="/eventos/novo" className="button main">
              <MdAdd className="icon" />
              <span className="hidden sm:inline">Publicar</span>
            </Link>

            <button type="button" onClick={logout} className="button clean" title="Sair">
              <MdLogout className="icon" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        ) : (
          <div className="row gap-2">
            <Link href="/entrar" className="button clean">
              Entrar
            </Link>

            <Link href="/cadastro" className="button main">
              Criar conta
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
};
