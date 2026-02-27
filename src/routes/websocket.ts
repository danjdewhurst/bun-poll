import type { ServerWebSocket } from "bun";

export interface WsData {
  shareId: string;
}

const viewerCounts = new Map<string, number>();

export function getViewerCount(shareId: string): number {
  return viewerCounts.get(shareId) ?? 0;
}

function buildViewerMessage(shareId: string): string {
  return JSON.stringify({ type: "viewers", count: getViewerCount(shareId) });
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    const { shareId } = ws.data;
    const topic = `poll-${shareId}`;

    ws.subscribe(topic);

    viewerCounts.set(shareId, (viewerCounts.get(shareId) ?? 0) + 1);

    const message = buildViewerMessage(shareId);
    ws.publish(topic, message);
    ws.send(message);
  },
  message(_ws: ServerWebSocket<WsData>, _message: string | Buffer) {
    // No client-to-server messages needed
  },
  close(ws: ServerWebSocket<WsData>) {
    const { shareId } = ws.data;
    const topic = `poll-${shareId}`;

    const current = viewerCounts.get(shareId) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      viewerCounts.delete(shareId);
    } else {
      viewerCounts.set(shareId, next);
    }

    ws.publish(topic, buildViewerMessage(shareId));
    ws.unsubscribe(topic);
  },
};
