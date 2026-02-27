import type { Server } from "bun";

let server: Server<{ shareId: string }> | null = null;

export function setServer(s: Server<{ shareId: string }>): void {
  server = s;
}

export function getServer(): Server<{ shareId: string }> {
  if (!server) {
    throw new Error("Server not initialised");
  }
  return server;
}
