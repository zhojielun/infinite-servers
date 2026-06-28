import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { invalidateToken, clearAuthCookie } from "../auth.js";

const logout = new Hono<AppEnv>();

logout.get("/logout", async (c) => {
  const dataDir = c.get("dataDir");

  // Get token from header or cookie
  let token = "";
  const auth = c.req.header("authorization");
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
  }

  if (!token) {
    const cookie = c.req.header("cookie");
    const match = cookie?.match(/is_auth=([^;]+)/);
    if (match) token = match[1];
  }

  if (token) {
    invalidateToken(dataDir, token);
  }

  c.header("Set-Cookie", clearAuthCookie());
  return c.redirect("/");
});

export default logout;
