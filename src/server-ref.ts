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

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  if (server) {
    const addr = server.requestIP(req);
    if (addr) return addr.address;
  }
  return "unknown";
}
