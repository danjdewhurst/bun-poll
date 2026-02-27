import type { ServerWebSocket } from "bun";
import { getPollByShareId } from "../db.ts";
import type { WsData } from "../types.ts";

const viewerCounts = new Map<string, number>();

function buildViewerMessage(shareId: string): string {
  return JSON.stringify({ type: "viewers", count: viewerCounts.get(shareId) ?? 0 });
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    const { shareId } = ws.data;

    // Validate poll exists before subscribing
    const poll = getPollByShareId.get(shareId);
    if (!poll) {
      ws.close(4004, "Poll not found");
      return;
    }

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
