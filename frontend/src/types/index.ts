export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  trackingId: string;
  createdAt: string;
}

export interface TodayMetrics {
  views: number;
  visitors: number;
  sessions: number;
  bounceRate: number;
  /**
   * Percentage change vs yesterday. Positive = growth. Omitted by the API when
   * there is no prior-day baseline, so the UI hides the delta badge.
   */
  viewsDelta?: number;
  visitorsDelta?: number;
}

export interface TrendPoint {
  date: string; // ISO date string, e.g. "2025-06-15"
  views: number;
  visitors: number;
}

export interface PageStat {
  page: string;
  views: number;
  visitors: number;
  bounceRate: number;
}

export interface EventStat {
  name: string;
  count: number;
  uniqueUsers: number;
}

export interface EventRow {
  id: string;
  type: 'pageview' | 'custom';
  page: string;
  referrer?: string;
  country?: string;
  deviceType?: string;
  eventName?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'spike' | 'drop';
  thresholdPct: number;
  emails: string[];
}

/** Generic paginated response wrapper */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API error shape returned by the backend */
export interface ApiError {
  message: string;
  code?: string;
}

export type DateRange = 'today' | '7d' | '30d';
