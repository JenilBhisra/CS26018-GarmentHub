"use client";

import { useSession, signOut } from "next-auth/react";
import type { Role } from "@prisma/client";

/**
 * useAuth
 *
 * Client-side hook that wraps useSession() and exposes convenient
 * helpers for role checking.
 *
 * Usage:
 *   const { user, isAuthenticated, isLoading, hasRole } = useAuth();
 */
export function useAuth() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const user = session?.user ?? null;

  function hasRole(role: Role): boolean {
    return user?.role === role;
  }

  function hasAnyRole(roles: Role[]): boolean {
    if (!user) return false;
    return roles.includes(user.role as Role);
  }

  async function logout(callbackUrl = "/") {
    await signOut({ callbackUrl });
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    role: user?.role as Role | undefined,
    hasRole,
    hasAnyRole,
    logout,
  };
}
