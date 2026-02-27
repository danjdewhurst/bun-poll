import admin from "./frontend/admin.html";
import home from "./frontend/home.html";
import poll from "./frontend/poll.html";
import { healthCheck } from "./src/routes/health.ts";
import {
  closePollHandler,
  createPoll,
  deletePoll,
  exportPoll,
  getAdminPoll,
  getPoll,
  resetVotes,
  summaryPoll,
  votePoll,
} from "./src/routes/polls.ts";
import { websocketHandlers } from "./src/routes/websocket.ts";
import { setServer } from "./src/server-ref.ts";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const server = Bun.serve({
  port: PORT,
  routes: {
    "/": home,
    "/poll/:shareId": poll,
    "/admin/:adminId": admin,
    "/health": { GET: healthCheck },
    "/api/polls": {
      POST: createPoll,
    },
    "/api/polls/:shareId": {
      GET: getPoll,
    },
    "/api/polls/:shareId/vote": {
      POST: votePoll,
    },
    "/api/polls/admin/:adminId": {
      GET: getAdminPoll,
      DELETE: deletePoll,
    },
    "/api/polls/admin/:adminId/close": {
      POST: closePollHandler,
    },
    "/api/polls/admin/:adminId/reset": {
      POST: resetVotes,
    },
    "/api/polls/admin/:adminId/export": {
      GET: exportPoll,
    },
    "/api/polls/admin/:adminId/summary": {
      GET: summaryPoll,
    },
  },
  fetch(req, server) {
    const url = new URL(req.url);
    const wsMatch = url.pathname.match(/^\/ws\/([a-f0-9]+)$/);
    if (wsMatch) {
      const upgraded = server.upgrade(req, {
        // biome-ignore lint/style/noNonNullAssertion: regex capture group is guaranteed by match
        data: { shareId: wsMatch[1]! },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: websocketHandlers,
});

setServer(server);

console.log(`bun-poll running on http://localhost:${server.port}`);
