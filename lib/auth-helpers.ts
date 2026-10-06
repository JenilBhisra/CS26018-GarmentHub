/**
 * auth-helpers.ts
 *
 * Server-side helpers for authentication and authorization.
 * Use these in Server Components and Server Actions.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

// ---------------------------------------------------------------------------
// getSession
// Returns the session or null. Safe to call from any Server Component.
// ---------------------------------------------------------------------------
export async function getSession() {
  return await auth();
}

// ---------------------------------------------------------------------------
// requireAuth
// Redirects to /login if not authenticated.
// Returns the session user object if authenticated.
// ---------------------------------------------------------------------------
export async function requireAuth(callbackUrl?: string) {
  const session = await auth();
  if (!session?.user) {
    const loginUrl = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    redirect(loginUrl);
  }
  return session.user;
}

// ---------------------------------------------------------------------------
// requireRole
// Redirects to /unauthorized if authenticated but lacks required role.
// Redirects to /login if not authenticated.
// ---------------------------------------------------------------------------
export async function requireRole(
  allowedRoles: Role[],
  options?: { callbackUrl?: string }
) {
  const session = await auth();

  if (!session?.user) {
    const loginUrl = options?.callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(options.callbackUrl)}`
      : "/login";
    redirect(loginUrl);
  }

  if (!allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized");
  }

  return session.user;
}

// ---------------------------------------------------------------------------
// getUser
// Returns the current user or null without redirecting.
// ---------------------------------------------------------------------------
export async function getUser() {
  const session = await auth();
  return session?.user ?? null;
}

// ---------------------------------------------------------------------------
// isAuthenticated
// Returns boolean — does not redirect.
// ---------------------------------------------------------------------------
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

// ---------------------------------------------------------------------------
// hasRole
// Returns boolean — does not redirect.
// ---------------------------------------------------------------------------
export async function hasRole(role: Role): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === role;
}

// ---------------------------------------------------------------------------
// hasAnyRole
// Returns boolean — does not redirect.
// ---------------------------------------------------------------------------
export async function hasAnyRole(roles: Role[]): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  return roles.includes(session.user.role);
}
