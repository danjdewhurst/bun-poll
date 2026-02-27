// biome-ignore-all lint/suspicious/noExplicitAny: test helpers use loose typing for API response assertions
// biome-ignore-all lint/style/noNonNullAssertion: test assertions where index access is known-safe
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { db } from "./src/db.ts";
import { _overrideFeaturesForTest, getFeatures } from "./src/features.ts";
import { resetRateLimitStore } from "./src/rate-limit.ts";

const PORT = 0; // Let OS pick a free port
let baseUrl: string;
let server: ReturnType<typeof Bun.serve>;

beforeAll(async () => {
  db.run("DELETE FROM votes");
  db.run("DELETE FROM options");
  db.run("DELETE FROM polls");

  const {
    createPoll,
    getPoll,
    votePoll,
    getAdminPoll,
    exportPoll,
    summaryPoll,
    closePollHandler,
    deletePoll,
    resetVotes,
  } = await import("./src/routes/polls.ts");
  const { getFeatureFlags } = await import("./src/routes/features.ts");
  const { healthCheck } = await import("./src/routes/health.ts");
  const { websocketHandlers } = await import("./src/routes/websocket.ts");
  const { setServer } = await import("./src/server-ref.ts");
  const home = (await import("./frontend/home.html")).default;
  const poll = (await import("./frontend/poll.html")).default;
  const embed = (await import("./frontend/embed.html")).default;
  const admin = (await import("./frontend/admin.html")).default;

  server = Bun.serve({
    port: PORT,
    routes: {
      "/": home,
      "/poll/:shareId": poll,
      "/embed/:shareId": embed,
      "/admin/:adminId": admin,
      "/health": { GET: healthCheck },
      "/api/features": { GET: getFeatureFlags },
      "/api/polls": { POST: createPoll },
      "/api/polls/:shareId": { GET: getPoll },
      "/api/polls/:shareId/vote": { POST: votePoll },
      "/api/polls/admin/:adminId": { GET: getAdminPoll, DELETE: deletePoll },
      "/api/polls/admin/:adminId/close": { POST: closePollHandler },
      "/api/polls/admin/:adminId/reset": { POST: resetVotes },
      "/api/polls/admin/:adminId/export": { GET: exportPoll },
      "/api/polls/admin/:adminId/summary": { GET: summaryPoll },
    },
    fetch(req, server) {
      const url = new URL(req.url);
      const wsMatch = url.pathname.match(/^\/ws\/([a-f0-9]+)$/);
      if (wsMatch) {
        if (!getFeatures().websocket) {
          return new Response("WebSocket disabled", { status: 403 });
        }
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

beforeEach(() => {
  resetRateLimitStore();
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
  return { res, data: (await res.json()) as any };
}

/** Create a poll that is already expired by closing it immediately */
async function createExpiredPoll() {
  const { data: created } = await createTestPoll();
  await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/close`, { method: "POST" });
  return created;
}

describe("POST /api/polls", () => {
  test("creates a poll and returns share_id + admin_id", async () => {
    const { res, data } = await createTestPoll();
    expect(res.status).toBe(200);
    expect(data.share_id).toBeString();
    expect(data.share_id).toHaveLength(16);
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

  test("rejects invalid expires_in_minutes", async () => {
    const { res, data } = await createTestPoll({ expires_in_minutes: -1 });
    expect(res.status).toBe(400);
    expect(data.error).toContain("Expiry must be");
  });

  test("rejects zero expires_in_minutes", async () => {
    const { res } = await createTestPoll({ expires_in_minutes: 0 });
    expect(res.status).toBe(400);
  });

  test("rejects non-integer expires_in_minutes", async () => {
    const { res } = await createTestPoll({ expires_in_minutes: 1.5 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/polls/:shareId", () => {
  test("returns poll with options and results", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.poll.question).toBe("Favourite colour?");
    expect(data.options).toHaveLength(3);
    expect(data.total_votes).toBe(0);
    expect(data.has_voted).toBe(false);
  });

  test("does not expose admin_id in public response", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const data = (await res.json()) as any;
    expect(data.poll.admin_id).toBeUndefined();
  });

  test("returns 404 for unknown share_id", async () => {
    const res = await fetch(`${baseUrl}/api/polls/nonexist`);
    expect(res.status).toBe(404);
  });

  test("has_voted reflects voter_token", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
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
    const checkData = (await checkRes.json()) as any;
    expect(checkData.has_voted).toBe(true);
  });
});

describe("POST /api/polls/:shareId/vote", () => {
  test("records a vote and returns updated results", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
    const optionId = pollData.options[1].id;
    const voterToken = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });
    const data = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(data.has_voted).toBe(true);
    expect(data.total_votes).toBe(1);
    const voted = data.options.find((o: { id: number }) => o.id === optionId);
    expect(voted.votes).toBe(1);
  });

  test("rejects duplicate vote from same voter_token", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
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
    const pollData = (await pollRes.json()) as any;
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
    const pollData = (await pollRes.json()) as any;
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

  test("rejects vote on closed poll", async () => {
    const created = await createExpiredPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
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

  test("rejects missing voter_token", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [pollData.options[0].id] }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects empty option_ids", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [], voter_token: crypto.randomUUID() }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects invalid voter_token format", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [pollData.options[0].id], voter_token: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Invalid voter token");
  });

  test("rejects vote on nonexistent poll", async () => {
    const res = await fetch(`${baseUrl}/api/polls/0000000000000000/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [1], voter_token: crypto.randomUUID() }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/polls/admin/:adminId", () => {
  test("returns poll data without admin_id", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}`);
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.poll.share_id).toBe(created.share_id);
    expect(data.poll.admin_id).toBeUndefined();
    expect(data.options).toHaveLength(3);
  });

  test("returns 404 for unknown admin_id", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/polls/admin/:adminId/export", () => {
  test("returns CSV with correct Content-Type", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/export?format=csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("Option,Votes,Percentage");
    expect(text).toContain("Red,");
    expect(text).toContain("Blue,");
    expect(text).toContain("Green,");
  });

  test("returns structured JSON export", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/export?format=json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const data = (await res.json()) as any;
    expect(data.question).toBe("Favourite colour?");
    expect(data.options).toHaveLength(3);
    expect(data.total_votes).toBe(0);
    expect(data.exported_at).toBeString();
    expect(data.options[0].text).toBe("Red");
    expect(data.options[0].percentage).toBe("0%");
  });

  test("CSV export with votes shows percentages", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;

    // Cast 2 votes on first option, 1 on second
    for (let i = 0; i < 2; i++) {
      await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_ids: [pollData.options[0].id],
          voter_token: crypto.randomUUID(),
        }),
      });
    }
    await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option_ids: [pollData.options[1].id],
        voter_token: crypto.randomUUID(),
      }),
    });

    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/export?format=csv`);
    const text = await res.text();
    expect(text).toContain("Red,2,66.7%");
    expect(text).toContain("Blue,1,33.3%");
    expect(text).toContain("Green,0,0%");
  });

  test("defaults to JSON when format not specified", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/export`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const data = (await res.json()) as any;
    expect(data.question).toBeDefined();
    expect(data.exported_at).toBeDefined();
  });

  test("returns 404 for invalid admin ID", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist/export`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/polls/admin/:adminId/summary", () => {
  test("returns plain text summary", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/summary`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("Poll: Favourite colour?");
    expect(text).toContain("Red: 0 votes (0%)");
    expect(text).toContain("Total: 0 votes");
  });

  test("returns 404 for invalid admin ID", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist/summary`);
    expect(res.status).toBe(404);
  });
});

describe("GET /health", () => {
  test("returns 200 with expected shape", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(typeof data.uptime_seconds).toBe("number");
    expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(typeof data.polls).toBe("number");
    expect(data.database).toBe("ok");
  });
});

describe("POST /api/polls/admin/:adminId/close", () => {
  test("closes a poll and returns updated data with expires_at set", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/close`, {
      method: "POST",
    });
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.poll.expires_at).toBeNumber();
    expect(data.poll.expires_at).toBeLessThanOrEqual(Date.now());
    expect(data.poll.admin_id).toBeUndefined();
    expect(data.options).toHaveLength(3);
  });

  test("returns 409 if poll is already closed", async () => {
    const created = await createExpiredPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/close`, {
      method: "POST",
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Poll is already closed");
  });

  test("returns 404 for invalid admin ID", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist/close`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/polls/admin/:adminId", () => {
  test("deletes a poll and returns deleted true", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);

    // Verify poll is no longer accessible
    const checkRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    expect(checkRes.status).toBe(404);
  });

  test("returns 404 for invalid admin ID", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/polls/admin/:adminId/reset", () => {
  test("resets votes and returns zeroed results", async () => {
    const { data: created } = await createTestPoll();
    // Cast a vote first
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
    const optionId = pollData.options[0].id;
    await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: crypto.randomUUID() }),
    });

    // Reset votes
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/reset`, {
      method: "POST",
    });
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.total_votes).toBe(0);
    expect(data.poll.admin_id).toBeUndefined();
    for (const opt of data.options) {
      expect(opt.votes).toBe(0);
    }
  });

  test("allows voting after reset", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
    const optionId = pollData.options[0].id;
    const voterToken = crypto.randomUUID();

    // Vote
    await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });

    // Reset
    await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/reset`, { method: "POST" });

    // Same voter can vote again after reset
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: voterToken }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 404 for invalid admin ID", async () => {
    const res = await fetch(`${baseUrl}/api/polls/admin/nonexist/reset`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("Input guardrails", () => {
  test("rejects question exceeding max length", async () => {
    const longQuestion = "x".repeat(501);
    const { res, data } = await createTestPoll({ question: longQuestion });
    expect(res.status).toBe(400);
    expect(data.error).toContain("500 characters");
  });

  test("rejects option exceeding max length", async () => {
    const longOption = "y".repeat(201);
    const { res, data } = await createTestPoll({ options: ["Valid", longOption] });
    expect(res.status).toBe(400);
    expect(data.error).toContain("200 characters");
  });

  test("rejects too many options", async () => {
    const options = Array.from({ length: 21 }, (_, i) => `Option ${i + 1}`);
    const { res, data } = await createTestPoll({ options });
    expect(res.status).toBe(400);
    expect(data.error).toContain("20");
  });

  test("rejects empty option string", async () => {
    const { res, data } = await createTestPoll({ options: ["Valid", "  "] });
    expect(res.status).toBe(400);
    expect(data.error).toContain("cannot be empty");
  });

  test("rate limiting returns 429 after too many votes", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
    const optionId = pollData.options[0].id;

    // Send 11 vote requests (limit is 10 per window)
    const results: Response[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_ids: [optionId],
          voter_token: crypto.randomUUID(),
        }),
      });
      results.push(res);
    }

    const lastRes = results[results.length - 1]!;
    expect(lastRes.status).toBe(429);
    expect(lastRes.headers.get("Retry-After")).toBeDefined();
    const body = (await lastRes.json()) as any;
    expect(body.error).toBe("Too many requests");
    expect(body.retry_after).toBeNumber();
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

  test("embed page loads", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/embed/${created.share_id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("embed-view");
  });
});

describe("WebSocket viewer count", () => {
  test("broadcasts viewer count on connect", async () => {
    const { data: created } = await createTestPoll();
    const wsUrl = baseUrl.replace("http", "ws");
    const ws = new WebSocket(`${wsUrl}/ws/${created.share_id}`);

    const message = await new Promise<{ type: string; count: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Timed out waiting for viewers message"));
      }, 5000);
      ws.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string);
        if (data.type === "viewers") {
          clearTimeout(timeout);
          resolve(data);
        }
      });
    });

    expect(message.type).toBe("viewers");
    expect(message.count).toBeGreaterThanOrEqual(1);
    ws.close();
  });

  test("viewer count increments with multiple connections", async () => {
    const { data: created } = await createTestPoll();
    const wsUrl = baseUrl.replace("http", "ws");

    const ws1 = new WebSocket(`${wsUrl}/ws/${created.share_id}`);
    await new Promise<void>((resolve) => {
      ws1.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string);
        if (data.type === "viewers") resolve();
      });
    });

    const ws2 = new WebSocket(`${wsUrl}/ws/${created.share_id}`);
    const message = await new Promise<{ type: string; count: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws2.close();
        reject(new Error("Timed out waiting for viewers message"));
      }, 5000);
      ws2.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string);
        if (data.type === "viewers") {
          clearTimeout(timeout);
          resolve(data);
        }
      });
    });

    expect(message.count).toBe(2);

    ws1.close();
    ws2.close();
  });

  test("viewer count decrements on disconnect", async () => {
    const { data: created } = await createTestPoll();
    const wsUrl = baseUrl.replace("http", "ws");

    const ws1 = new WebSocket(`${wsUrl}/ws/${created.share_id}`);
    await new Promise<void>((resolve) => {
      ws1.addEventListener("open", () => resolve());
    });
    await new Promise<void>((resolve) => {
      ws1.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string);
        if (data.type === "viewers") resolve();
      });
    });

    const ws2 = new WebSocket(`${wsUrl}/ws/${created.share_id}`);
    await new Promise<void>((resolve) => {
      ws2.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string);
        if (data.type === "viewers") resolve();
      });
    });

    const decremented = new Promise<{ type: string; count: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for decremented viewers message"));
      }, 5000);
      ws1.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string);
        if (data.type === "viewers" && data.count < 2) {
          clearTimeout(timeout);
          resolve(data);
        }
      });
    });

    ws2.close();
    const result = await decremented;
    expect(result.count).toBe(1);

    ws1.close();
  });
});

describe("GET /api/features", () => {
  test("returns all features as true by default", async () => {
    const res = await fetch(`${baseUrl}/api/features`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.exports).toBe(true);
    expect(data.websocket).toBe(true);
    expect(data.adminManagement).toBe(true);
  });

  test("reflects overridden features", async () => {
    _overrideFeaturesForTest({ exports: false });
    const res = await fetch(`${baseUrl}/api/features`);
    const data = (await res.json()) as any;
    expect(data.exports).toBe(false);
    expect(data.websocket).toBe(true);
    _overrideFeaturesForTest(null);
  });
});

describe("Feature flags — exports disabled", () => {
  beforeEach(() => _overrideFeaturesForTest({ exports: false }));
  afterEach(() => _overrideFeaturesForTest(null));

  test("export endpoint returns 403", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/export`);
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Feature disabled");
  });

  test("summary endpoint returns 403", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/summary`);
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Feature disabled");
  });
});

describe("Feature flags — admin management disabled", () => {
  beforeEach(() => _overrideFeaturesForTest({ adminManagement: false }));
  afterEach(() => _overrideFeaturesForTest(null));

  test("close endpoint returns 403", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/close`, {
      method: "POST",
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Feature disabled");
  });

  test("reset endpoint returns 403", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}/reset`, {
      method: "POST",
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Feature disabled");
  });

  test("delete endpoint returns 403", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Feature disabled");
  });
});

describe("Feature flags — websocket disabled", () => {
  beforeEach(() => _overrideFeaturesForTest({ websocket: false }));
  afterEach(() => _overrideFeaturesForTest(null));

  test("WS upgrade returns 403", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/ws/${created.share_id}`);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe("WebSocket disabled");
  });

  test("voting still works without websocket", async () => {
    const { data: created } = await createTestPoll();
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
    const optionId = pollData.options[0].id;

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: crypto.randomUUID() }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.total_votes).toBe(1);
  });
});

describe("Scheduled polls", () => {
  test("creates poll with valid future starts_at", async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const { res, data } = await createTestPoll({ starts_at: futureDate });
    expect(res.status).toBe(200);
    expect(data.share_id).toBeString();
  });

  test("rejects starts_at in the past", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const { res, data } = await createTestPoll({ starts_at: pastDate });
    expect(res.status).toBe(400);
    expect(data.error).toContain("future");
  });

  test("rejects invalid starts_at string", async () => {
    const { res, data } = await createTestPoll({ starts_at: "not-a-date" });
    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid starts_at");
  });

  test("rejects starts_at >= expires_at", async () => {
    const startsAt = new Date(Date.now() + 7_200_000).toISOString(); // +2h
    const { res, data } = await createTestPoll({
      starts_at: startsAt,
      expires_in_minutes: 60, // +1h — before starts_at
    });
    expect(res.status).toBe(400);
    expect(data.error).toContain("before expires_at");
  });

  test("vote before start time returns 403", async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const { data: created } = await createTestPoll({ starts_at: futureDate });
    const pollRes = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const pollData = (await pollRes.json()) as any;
    const optionId = pollData.options[0].id;

    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: [optionId], voter_token: crypto.randomUUID() }),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toContain("not started");
  });

  test("GET poll returns starts_at field", async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const { data: created } = await createTestPoll({ starts_at: futureDate });
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.poll.starts_at).toBeNumber();
    expect(data.poll.starts_at).toBeGreaterThan(Date.now());
  });

  test("GET admin poll returns starts_at field", async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const { data: created } = await createTestPoll({ starts_at: futureDate });
    const res = await fetch(`${baseUrl}/api/polls/admin/${created.admin_id}`);
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.poll.starts_at).toBeNumber();
  });

  test("create without starts_at returns null (backwards compat)", async () => {
    const { data: created } = await createTestPoll();
    const res = await fetch(`${baseUrl}/api/polls/${created.share_id}`);
    const data = (await res.json()) as any;
    expect(data.poll.starts_at).toBeNull();
  });
});
