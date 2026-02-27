import { getPollCount } from "../db.ts";

const startedAt = Date.now();

export function healthCheck(): Response {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  try {
    const row = getPollCount.get();
    return Response.json({
      status: "ok",
      uptime_seconds: uptimeSeconds,
      polls: row?.count ?? 0,
      database: "ok",
    });
  } catch {
    return Response.json(
      {
        status: "degraded",
        uptime_seconds: uptimeSeconds,
        polls: null,
        database: "error",
      },
      { status: 503 },
    );
  }
}
