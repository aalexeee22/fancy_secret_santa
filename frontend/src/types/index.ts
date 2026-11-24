export interface Participant {
  id: number;
  name: string;
  email: string;
  wishlist: string | null;
  joined_at: string;
  assigned_to?: {
    id: number;
    name: string;
    email: string;
    wishlist: string | null;
  };
}

// Ce vede oricine are linkul de invitație
export interface PublicGroup {
  name: string;
  code: string;
  min_budget_ron: number | null;
  is_drawn: boolean;
  participant_count: number;
}

// Ce vede doar organizatorul, prin linkul de admin
export interface SantaGroup extends PublicGroup {
  id: number;
  admin_code: string;
  created_at: string;
  has_email: boolean;
  participants: Participant[];
  emails_sent: number;
  emails_pending: number;
  uncertain_emails: string[];
  failed_emails: string[];
  admin_link_expired: boolean;
  admin_email_sent?: boolean;
}

export interface Stats {
  total_groups: number;
  total_participants: number;
  drawn_groups: number;
  pending_groups: number;
  groups_with_email: number;
  avg_participants_per_group: number;
  budget_distribution: Record<string, number>;
  group_size_distribution: Record<string, number>;
  recent_groups: {
    participant_count: number;
    is_drawn: boolean;
    created_at: string;
  }[];
}

// Calendarul de advent: filmul vine doar pentru ușițele deschise și cea de azi.
export interface AdventMovie {
  title: string;
  url_IMDB?: string;
  trailer_link?: string;
  movie_link?: string;
  has_poster: boolean;
}

export interface AdventDoor {
  day: number;
  state: 'open' | 'today' | 'locked';
  bonus: boolean;
  movie?: AdventMovie;
}

export interface AdventCalendar {
  today: number;
  days_until_start: number;
  doors: AdventDoor[];
}

// --- Dirty Santa ---

export type DirtyStatus = 'lobby' | 'playing' | 'finished';
export type DirtyMoveKind = 'open' | 'steal' | 'final_swap' | 'keep';

export interface DirtyPlayer {
  id: number;
  nickname: string;
  turn_order: number | null;
  gift_id: number | null;
  /** Adăugat de organizator, fără telefon: joacă organizatorul pentru el, de pe ecranul mare. */
  local: boolean;
}

export interface DirtyGift {
  id: number;
  number: number; // al câtelea cadou desfăcut: #1, #2…
  opened_by: number;
  holder_id: number;
  steals: number;
  locked: boolean;
  /** furat runda asta: nu mai poate fi furat până nu se desface un cadou nou */
  /** jucătorul de la rând îl poate lua acum */
  can_take: boolean;
}

export interface DirtyMove {
  seq: number;
  kind: DirtyMoveKind;
  actor_id: number;
  gift_id: number | null;
  victim_id: number | null;
  by_host: boolean;
  at: string;
}

export interface DirtyGameState {
  code: string;
  status: DirtyStatus;
  version: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  settings: { steal_limit: number; final_round: boolean; budget: number | null };
  is_host: boolean;
  me: number | null;
  players: DirtyPlayer[];
  gifts: DirtyGift[];
  moves: DirtyMove[];
  turn: { player_id: number; phase: 'main' | 'final'; round: number; rounds: number } | null;
  unopened: number;
  awards: { biggest_thief: number[] | null; most_wanted_gift: number[] | null; unlucky: number[] | null } | null;
}

export interface DirtyGameInfo {
  code: string;
  status: DirtyStatus;
  started_at: string | null;
  player_count: number;
  budget: number | null;
  steal_limit: number;
}

export interface DirtyJoinResult {
  player_id: number;
  nickname: string;
  token: string;
  code: string;
}
