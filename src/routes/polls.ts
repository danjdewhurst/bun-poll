import {
  insertPoll,
  insertOption,
  getPollByShareId,
  getPollByAdminId,
  getResultsByPollId,
  insertVote,
  hasVoted,
  getTotalVotes,
  getOptionIdsByPollId,
} from "../db.ts";
import { getServer } from "../server-ref.ts";
import type { CreatePollRequest, VoteRequest, WsMessage } from "../types.ts";

function generateShareId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildResults(pollId: number, voterToken?: string) {
  const options = getResultsByPollId.all(pollId);
  const total = getTotalVotes.get(pollId)?.cnt ?? 0;
  const voted = voterToken
    ? (hasVoted.get(pollId, voterToken)?.cnt ?? 0) > 0
    : false;
  return { options, total_votes: total, has_voted: voted };
}

function broadcastResults(pollId: number, shareId: string): void {
  const { options, total_votes } = buildResults(pollId);
  const message: WsMessage = { type: "results", options, total_votes };
  getServer().publish(`poll-${shareId}`, JSON.stringify(message));
}

export function createPoll(req: Request): Promise<Response> {
  return (req.json() as Promise<CreatePollRequest>).then((body) => {
    if (!body.question?.trim()) {
      return Response.json({ error: "Question is required" }, { status: 400 });
    }
    if (!Array.isArray(body.options) || body.options.length < 2) {
      return Response.json(
        { error: "At least 2 options required" },
        { status: 400 },
      );
    }

    const shareId = generateShareId();
    const adminId = crypto.randomUUID();
    const allowMultiple = body.allow_multiple ? 1 : 0;
    const expiresAt = body.expires_in_minutes
      ? Date.now() + body.expires_in_minutes * 60_000
      : null;
    const now = Date.now();

    const poll = insertPoll.get(
      shareId,
      adminId,
      body.question.trim(),
      allowMultiple,
      expiresAt,
      now,
    );

    if (!poll) {
      return Response.json(
        { error: "Failed to create poll" },
        { status: 500 },
      );
    }

    for (let i = 0; i < body.options.length; i++) {
      insertOption.run(poll.id, body.options[i]!.trim(), i);
    }

    return Response.json({
      share_id: poll.share_id,
      admin_id: poll.admin_id,
    });
  });
}

export function getPoll(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  const shareId = url.pathname.split("/").pop()!;
  const voterToken = url.searchParams.get("voter_token") ?? undefined;

  const poll = getPollByShareId.get(shareId);
  if (!poll) {
    return Response.json({ error: "Poll not found" }, { status: 404 });
  }

  const { options, total_votes, has_voted } = buildResults(
    poll.id,
    voterToken,
  );

  return Response.json({
    poll: {
      id: poll.id,
      share_id: poll.share_id,
      question: poll.question,
      allow_multiple: poll.allow_multiple,
      expires_at: poll.expires_at,
      created_at: poll.created_at,
    },
    options,
    total_votes,
    has_voted,
  });
}

export function votePoll(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const shareId = parts[parts.length - 2]!;

  const poll = getPollByShareId.get(shareId);
  if (!poll) {
    return Response.json({ error: "Poll not found" }, { status: 404 });
  }

  if (poll.expires_at && Date.now() > poll.expires_at) {
    return Response.json({ error: "Poll has expired" }, { status: 410 });
  }

  return (req.json() as Promise<VoteRequest>).then((body) => {
    if (
      !body.voter_token ||
      !Array.isArray(body.option_ids) ||
      body.option_ids.length === 0
    ) {
      return Response.json({ error: "Invalid vote request" }, { status: 400 });
    }

    if (!poll.allow_multiple && body.option_ids.length !== 1) {
      return Response.json(
        { error: "Only one option allowed" },
        { status: 400 },
      );
    }

    const alreadyVoted =
      (hasVoted.get(poll.id, body.voter_token)?.cnt ?? 0) > 0;
    if (alreadyVoted) {
      return Response.json({ error: "Already voted" }, { status: 409 });
    }

    const validOptionIds = new Set(
      getOptionIdsByPollId.all(poll.id).map((o) => o.id),
    );

    const now = Date.now();
    for (const optionId of body.option_ids) {
      if (!validOptionIds.has(optionId)) {
        return Response.json(
          { error: `Invalid option ID: ${optionId}` },
          { status: 400 },
        );
      }
      insertVote.run(poll.id, optionId, body.voter_token, now);
    }

    broadcastResults(poll.id, shareId);

    const { options, total_votes } = buildResults(poll.id, body.voter_token);
    return Response.json({ options, total_votes, has_voted: true });
  });
}

export function getAdminPoll(req: Request): Response {
  const url = new URL(req.url);
  const adminId = url.pathname.split("/").pop()!;

  const poll = getPollByAdminId.get(adminId);
  if (!poll) {
    return Response.json({ error: "Poll not found" }, { status: 404 });
  }

  const { options, total_votes } = buildResults(poll.id);

  return Response.json({
    poll,
    options,
    total_votes,
  });
}
