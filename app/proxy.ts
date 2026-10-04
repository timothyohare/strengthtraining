import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { publicUrl } from "@/lib/redirect";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime behavior,
// new file/export name) -- see node_modules/next/dist/docs/.../proxy.md.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE.name)?.value;
  const session = await getSession(token);

  if (!session) {
    return NextResponse.redirect(publicUrl(request, "/login"));
  }

  return NextResponse.next();
}

// Excludes login, the login/logout API routes, and static assets. Everything
// else requires a valid session. Per Next's own guidance, this is a
// convenience gate, not the only check -- protected pages/routes also verify
// the session themselves (see app/today/page.tsx) rather than trusting Proxy
// alone.
export const config = {
  matcher: [
    "/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon.svg).*)",
  ],
};
