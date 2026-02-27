import type { Server } from "bun";
import type { WsData } from "./types.ts";

let server: Server<WsData> | null = null;

export function setServer(s: Server<WsData>): void {
  server = s;
}

export function getServer(): Server<WsData> {
  if (!server) {
    throw new Error("Server not initialised");
  }
  return server;
}

const TRUSTED_PROXY_PREFIXES = ["10.", "172.16.", "192.168.", "127.", "::1", "::ffff:10.", "::ffff:172.16.", "::ffff:192.168.", "::ffff:127."];

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXY_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

export function getClientIp(req: Request): string {
  const connectionIp = server ? server.requestIP(req)?.address : null;

  // Only trust proxy headers when the direct connection is from a known proxy
  if (connectionIp && isTrustedProxy(connectionIp)) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }

  return connectionIp ?? "unknown";
}
