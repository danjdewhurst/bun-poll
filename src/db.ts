import { Database } from "bun:sqlite";

const DB_PATH = process.env.DB_PATH ?? "bun-poll.sqlite";

const db = new Database(DB_PATH);

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

db.run(`
  CREATE TABLE IF NOT EXISTS polls (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id       TEXT NOT NULL UNIQUE,
    admin_id       TEXT NOT NULL UNIQUE,
    question       TEXT NOT NULL,
    allow_multiple INTEGER NOT NULL DEFAULT 0,
    expires_at     INTEGER,
    created_at     INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS options (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id  INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS votes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id     INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id   INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    voter_token TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    UNIQUE(poll_id, option_id, voter_token)
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_votes_option_id ON votes(option_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_votes_poll_voter ON votes(poll_id, voter_token)`);

export const insertPoll = db.prepare<
  { id: number; share_id: string; admin_id: string },
  [string, string, string, number, number | null, number]
>(
  `INSERT INTO polls (share_id, admin_id, question, allow_multiple, expires_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?) RETURNING id, share_id, admin_id`,
);

export const insertOption = db.prepare<void, [number, string, number]>(
  `INSERT INTO options (poll_id, text, position) VALUES (?, ?, ?)`,
);

export const getPollByShareId = db.prepare<
  {
    id: number;
    share_id: string;
    admin_id: string;
    question: string;
    allow_multiple: number;
    expires_at: number | null;
    created_at: number;
  },
  [string]
>(`SELECT * FROM polls WHERE share_id = ?`);

export const getPollByAdminId = db.prepare<
  {
    id: number;
    share_id: string;
    admin_id: string;
    question: string;
    allow_multiple: number;
    expires_at: number | null;
    created_at: number;
  },
  [string]
>(`SELECT * FROM polls WHERE admin_id = ?`);

export const getOptionsByPollId = db.prepare<
  { id: number; poll_id: number; text: string; position: number },
  [number]
>(`SELECT * FROM options WHERE poll_id = ? ORDER BY position`);

export const getResultsByPollId = db.prepare<
  { id: number; poll_id: number; text: string; position: number; votes: number },
  [number]
>(
  `SELECT o.*, COALESCE(v.cnt, 0) AS votes
   FROM options o
   LEFT JOIN (SELECT option_id, COUNT(*) AS cnt FROM votes GROUP BY option_id) v
     ON v.option_id = o.id
   WHERE o.poll_id = ?
   ORDER BY o.position`,
);

export const insertVote = db.prepare<void, [number, number, string, number]>(
  `INSERT OR IGNORE INTO votes (poll_id, option_id, voter_token, created_at) VALUES (?, ?, ?, ?)`,
);

export const hasVoted = db.prepare<{ cnt: number }, [number, string]>(
  `SELECT COUNT(*) AS cnt FROM votes WHERE poll_id = ? AND voter_token = ?`,
);

export const getTotalVotes = db.prepare<{ cnt: number }, [number]>(
  `SELECT COUNT(DISTINCT voter_token) AS cnt FROM votes WHERE poll_id = ?`,
);

export const getOptionIdsByPollId = db.prepare<{ id: number }, [number]>(
  `SELECT id FROM options WHERE poll_id = ?`,
);

export const getPollCount = db.prepare<{ count: number }, []>(
  `SELECT COUNT(*) AS count FROM polls`,
);

export const closePollStmt = db.prepare<
  {
    id: number;
    share_id: string;
    admin_id: string;
    question: string;
    allow_multiple: number;
    expires_at: number | null;
    created_at: number;
  },
  [number, string]
>(`UPDATE polls SET expires_at = ? WHERE admin_id = ? RETURNING *`);

export const deletePollStmt = db.prepare<void, [string]>(`DELETE FROM polls WHERE admin_id = ?`);

export const resetVotesStmt = db.prepare<void, [number]>(`DELETE FROM votes WHERE poll_id = ?`);

export { db };
