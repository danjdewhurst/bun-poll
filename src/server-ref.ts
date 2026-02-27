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
  if (server) {
    const addr = server.requestIP(req);
    if (addr) return addr.address;
  }
  return "unknown";
}
