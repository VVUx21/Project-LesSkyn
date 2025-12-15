import type { Context, MiddlewareHandler } from "hono";
import { Client, Account } from "node-appwrite";

const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};

  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValParts] = part.trim().split("=");
    if (!rawKey) continue;
    const rawVal = rawValParts.join("=");
    out[rawKey] = decodeURIComponent(rawVal ?? "");
  }
  return out;
};

const getAppwriteSessionSecret = (c: Context): string | null => {
  const cookieHeader = c.req.raw.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies["appwrite-session"] || null;
};

export type AuthInfo = {
  userId: string;
  email?: string;
  name?: string;
};

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const sessionSecret = getAppwriteSessionSecret(c);

  if (!sessionSecret) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;

  if (!endpoint || !project) {
    return c.json({ success: false, error: "Server misconfigured" }, 500);
  }

  try {
    const client = new Client().setEndpoint(endpoint).setProject(project).setSession(sessionSecret);
    const account = new Account(client);
    const me = await account.get();

    const auth: AuthInfo = {
      userId: me.$id,
      email: me.email,
      name: me.name,
    };

    c.set("auth", auth);
    await next();
  } catch (err) {
    console.error("Auth check failed:", err);
    return c.json({ success: false, error: "Invalid session" }, 401);
  }
};
