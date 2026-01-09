import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("x-forwarded-for", 
    request.headers.get("x-forwarded-for") || 
    request.headers.get("x-real-ip") || 
    "anonymous"
  );

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
