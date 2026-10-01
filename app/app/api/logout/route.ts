import { redirectTo } from "@/lib/redirect";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const response = redirectTo("/login", 303);
  response.cookies.delete(SESSION_COOKIE.name);
  return response;
}
