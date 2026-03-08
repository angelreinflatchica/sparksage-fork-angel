import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname, search } = req.nextUrl;

  const isAuthPage = pathname === "/login" || pathname.startsWith("/api/auth");
  const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/wizard");

  if (isAuthPage) {
    // Avoid showing login to already authenticated users.
    if (pathname === "/login" && isLoggedIn) {
      return Response.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
    return;
  }

  // Redirect unauthenticated users to login for protected app routes.
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search || ""}`);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/wizard/:path*", "/login", "/api/auth/:path*"],
};
