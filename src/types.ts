export interface Poll {
  id: number;
  share_id: string;
  admin_id: string;
  question: string;
  allow_multiple: number;
  starts_at: number | null;
  expires_at: number | null;
  created_at: number;
}

export interface Option {
  id: number;
  poll_id: number;
  text: string;
  position: number;
}

export interface Vote {
  id: number;
  poll_id: number;
  option_id: number;
  voter_token: string;
  created_at: number;
}

export interface OptionResult extends Option {
  votes: number;
}

export interface PollWithResults {
  poll: Poll;
  options: OptionResult[];
  total_votes: number;
  has_voted: boolean;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
  allow_multiple?: boolean;
  expires_in_minutes?: number;
  starts_at?: string;
}

export interface VoteRequest {
  option_ids: number[];
  voter_token: string;
}

export type WsMessage =
  | { type: "results"; options: OptionResult[]; total_votes: number }
  | { type: "closed"; options: OptionResult[]; total_votes: number }
  | { type: "viewers"; count: number };

export interface WsData {
  shareId: string;
}
