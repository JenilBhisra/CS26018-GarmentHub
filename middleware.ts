import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

// Route groups that require authentication
const PROTECTED_PREFIXES = [
  "/account",
  "/seller",
  "/admin",
  "/b2b",
];

// Role-to-route access map
const ROLE_ACCESS: Record<string, string[]> = {
  CUSTOMER: ["/account"],
  SELLER: ["/account", "/seller"],
  B2B_VENDOR: ["/account", "/b2b"],
  ADMIN: ["/account", "/seller", "/admin", "/b2b"],
};

export default auth(function middleware(req: NextAuthRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const session = req.auth;

  // Check if this is a protected route
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!session?.user) {
    console.log(`[Middleware] Protected path ${pathname} requires auth. Redirecting to login.`);
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role as string;
  const allowedPrefixes = ROLE_ACCESS[role] ?? [];

  // Check if user's role has access to this path
  const hasAccess = allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  console.log(`[Middleware] Path: ${pathname}, Role: ${role}, HasAccess: ${hasAccess}`);

  if (!hasAccess) {
    return NextResponse.redirect(new URL("/unauthorized", nextUrl.origin));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    }
  });
});

export const config = {
  // Match all routes except static files, images, and NextAuth API
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)).*)",
  ],
};
