import { NextResponse, type NextRequest } from "next/server";

// Optional password lock for test deployments.
// Set SITE_PASSWORD in your host's environment variables to turn it on.
export function proxy(req: NextRequest) {
  const pass = process.env.SITE_PASSWORD;
  if (!pass) return NextResponse.next();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [, pwd] = atob(auth.slice(6)).split(":");
    if (pwd === pass) return NextResponse.next();
  }
  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Nonstop", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
