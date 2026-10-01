import { NextResponse } from "next/server";

// Don't build redirect URLs from request.url: behind Amplify Hosting's proxy
// it reports the internal host (localhost:3000), which sends the browser to
// the wrong origin.

// Route handlers: a relative Location header keeps the browser on its host.
export function redirectTo(path: string, status: 303 | 307 = 307) {
  return new NextResponse(null, { status, headers: { Location: path } });
}

// Proxy (middleware) redirects must be absolute, so rebuild the public origin
// from the headers the hosting proxy forwards.
export function publicUrl(request: Request, path: string) {
  const internal = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    internal.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    internal.protocol.replace(":", "");
  return new URL(path, `${proto}://${host}`);
}
