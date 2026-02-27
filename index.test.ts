import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { db } from "./src/db.ts";

const PORT = 0; // Let OS pick a free port
let baseUrl: string;
let server: ReturnType<typeof Bun.serve>;

beforeAll(async () => {
  // Use in-memory DB for tests by clearing and re-using the imported db
  // The db module already initialised the schema, so tables exist.
  // Clean slate for tests:
  db.run("DELETE FROM votes");
  db.run("DELETE FROM options");
  db.run("DELETE FROM polls");

  // Dynamically import and start the server
  const { createPoll, getPoll, votePoll, getAdminPoll } = await import("./src/routes/polls.ts");
  const { healthCheck } = await import("./src/routes/health.ts");
  const { websocketHandlers } = await import("./src/routes/websocket.ts");
  const { setServer } = await import("./src/server-ref.ts");
  const home = (await import("./frontend/home.html")).default;
  const poll = (await import("./frontend/poll.html")).default;
  const admin = (await import("./frontend/admin.html")).default;

  server = Bun.serve({
    port: PORT,
    routes: {
      "/": home,
      "/poll/:shareId": poll,
      "/admin/:adminId": admin,
      "/health": { GET: healthCheck },
      "/api/polls": { POST: createPoll },
      "/api/polls/:shareId": { GET: getPoll },
      "/api/polls/:shareId/vote": { POST: votePoll },
      "/api/polls/admin/:adminId": { GET: getAdminPoll },
    },
    fetch(req, server) {
      const url = new URL(req.url);
      const wsMatch = url.pathname.match(/^\/ws\/([a-f0-9]+)$/);
      if (wsMatch) {
        const upgraded = server.upgrade(req, { data: { shareId: wsMatch[1]! } });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: websocketHandlers,
  });

  setServer(server);
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server?.stop(true);
});

async function createTestPoll(overrides: Record<string, unknown> = {}) {
  const body = {
    question: "Favourite colour?",
    options: ["Red", "Blue", "Green"],
    ...overrides,
  };
  const res = await fetch(`${baseUrl}/api/polls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { res, data: (await res.json() as any) as any };
}

describe("POST /api/polls", () => {
  test("creates a poll and returns share_id + admin_id", async () => {
    const { res, data } = await createTestPoll();
    expect(res.status).toBe(200);
    expect(data.share_id).toBeString();
    expect(data.share_id).toHaveLength(8);
    expect(data.admin_id).toBeString();
    expect(data.admin_id.length).toBeGreaterThan(8);
  });

  test("rejects missing question", async () => {
    const res = await fetch(`${baseUrl}/api/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "", options: ["A", "B"] }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects fewer than 2 options", async () => {
    const res = await fetch(`${baseUrl}/api/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Test?", options: ["Only one"] }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/polls/:shareId", () => {
  test("returns poll with options and results", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.poll.question).toBe("Favourite colour?");
    expect(data.options).toHaveLength(3);
    expect(data.total_votes).toBe(0);
    expect(data.has_voted).toBe(false);
  });

  test("returns 404 for unknown share_id", async () => {
    const res = await fetch(`${baseUrl}/api/polls/nonexist`);
    expect(res.status).toBe(404);
  });

  test("has_voted reflects voter_token", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = await pollRes.json() as any;
    const optionId = pollData.options[0].id;
    const voterToken = crypto.randomUUID();

    await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });

    const checkRes = await fetch(
      `${baseUrl}/api/polls/${created.share_id}?voter_token=${voterToken}`,
    );
    const checkData = await checkRes.json() as any;
    expect(checkData.has_voted).toBe(true);
  });
});

describe("POST /api/polls/:shareId/vote", () => {
  test("records a vote and returns updated results", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = await pollRes.json() as any;
    const optionId = pollData.options[1].id;
    const voterToken = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.has_voted).toBe(true);
    expect(data.total_votes).toBe(1);
    const voted = data.options.find((o: { id: number }) => o.id === optionId);
    expect(voted.votes).toBe(1);
  });

  test("rejects duplicate vote from same voter_token", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = await pollRes.json() as any;
    const optionId = pollData.options[0].id;
    const voterToken = crypto.randomUUID();

    await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });

    const res2 = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });
    expect(res2.status).toBe(409);
  });

  test("rejects multiple options on single-choice poll", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = await pollRes.json() as any;
    const voterToken = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option_ids: [pollData.options[0].id, pollData.options[1].id],
        voter_token: voterToken,
      }),
    });
    expect(res.status).toBe(400);
  });

  test("allows multiple options on multi-choice poll", async () => {
    const { data: created } = await createTestPoll({ allow_multiple: true });
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = await pollRes.json() as any;
    const voterToken = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option_ids: [pollData.options[0].id, pollData.options[1].id],
        voter_token: voterToken,
      }),
    });
    expect(res.status).toBe(200);
  });

  test("rejects vote on expired poll", async () => {
    const { data: created } = await createTestPoll({ expires_in_minutes: -1 });
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = await pollRes.json() as any;
    const voterToken = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [pollData.options[0].id], voter_token: voterToken }),
    });
    expect(res.status).toBe(410);
  });

  test("rejects invalid option ID", async () => {
    const { data: created } = await createTestPoll();
    const voterToken = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [999999], voter_token: voterToken }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/polls/admin/:adminId", () => {
  test("returns full poll data including admin_id", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}`);
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.poll.admin_id).toBe(created.admin_id);
    expect(data.poll.share_id).toBe(created.share_id);
    expect(data.options).toHaveLength(3);
  });

  test("returns 404 for unknown admin_id", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist`);
    expect(res.status).toBe(404);
  });
});

describe("GET /health", () => {
  test("returns 200 with expected shape", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(typeof data.uptime_seconds).toBe("number");
    expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(typeof data.polls).toBe("number");
    expect(data.database).toBe("ok");
  });

  test("polls count reflects created polls", async () => {
    const before = await fetch(`${baseUrl}/health`).then(r => r.json()) as any;
    await createTestPoll();
    const after = await fetch(`${baseUrl}/health`).then(r => r.json()) as any;
    expect(after.polls).toBe(before.polls + 1);
  });
});

describe("HTML pages", () => {
  test("home page loads", async () => {
    const res = await fetch(baseUrl);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Create a Poll");
  });

  test("poll page loads", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/poll/${created.share_id}`);
    expect(res.status).toBe(200);
  });

  test("admin page loads", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/admin/${created.admin_id}`);
    expect(res.status).toBe(200);
  });
});
