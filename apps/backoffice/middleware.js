// Auth HTTP Basic — barrière simple pour empêcher l'accès non autorisé en local
// ET en prod si jamais on déploie. Le mot de passe vient de ADMIN_PASSWORD (.env.local).
import { NextResponse } from "next/server";

export function middleware(req) {
  const auth = req.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD || "changeme";

  if (!auth) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LesGriotsxStudio Back Office"' },
    });
  }
  const [, b64] = auth.split(" ");
  let decoded = "";
  try { decoded = Buffer.from(b64, "base64").toString(); } catch { /* ignore */ }
  const [, password] = decoded.split(":");
  if (password !== expected) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LesGriotsxStudio Back Office"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Protège tout sauf les fichiers statiques de Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
