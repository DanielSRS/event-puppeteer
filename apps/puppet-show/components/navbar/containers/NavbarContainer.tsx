/* components/navbar/containers/NavbarContainer.tsx */

"use client";

import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "../Navbar";

export function NavbarContainer() {
  const { user, loading, logout } = useAuth();

  return <Navbar user={user} loading={loading} onLogout={logout} />;
};
