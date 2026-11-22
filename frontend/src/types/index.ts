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
