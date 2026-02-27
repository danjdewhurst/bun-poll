import type { ServerWebSocket } from "bun";

export interface WsData {
  shareId: string;
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    ws.subscribe(`poll-${ws.data.shareId}`);
  },
  message(_ws: ServerWebSocket<WsData>, _message: string | Buffer) {
    // No client-to-server messages needed
  },
  close(ws: ServerWebSocket<WsData>) {
    ws.unsubscribe(`poll-${ws.data.shareId}`);
  },
};
