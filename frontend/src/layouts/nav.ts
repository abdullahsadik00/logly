import {
  LayoutDashboard,
  Activity,
  Filter,
  Target,
  Bell,
  FileText,
  Rss,
  Globe,
  Monitor,
  type LucideIcon,
} from 'lucide-react';

export type NavGroup = 'overview' | 'explore';
export type NavBadge = 'live' | 'alerts';

export interface NavItem {
  /** Path relative to the project root (`/projects/:id`). '' = index/Dashboard. */
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  badge?: NavBadge;
  /** False → renders the "coming in a later cycle" placeholder. */
  implemented: boolean;
}

/** Sidebar navigation, per the Dashboard V2 IA. */
export const NAV_ITEMS: NavItem[] = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, group: 'overview', implemented: true },
  { to: 'realtime', label: 'Realtime', icon: Activity, group: 'overview', badge: 'live', implemented: false },
  { to: 'events', label: 'Events', icon: Filter, group: 'overview', implemented: true },
  { to: 'goals', label: 'Goals & funnels', icon: Target, group: 'overview', implemented: false },
  { to: 'alerts', label: 'Alerts', icon: Bell, group: 'overview', badge: 'alerts', implemented: false },
  { to: 'pages', label: 'Pages', icon: FileText, group: 'explore', implemented: false },
  { to: 'sources', label: 'Sources', icon: Rss, group: 'explore', implemented: false },
  { to: 'locations', label: 'Locations', icon: Globe, group: 'explore', implemented: false },
  { to: 'devices', label: 'Devices', icon: Monitor, group: 'explore', implemented: false },
];

/** Resolve the page title for a project-relative path segment. */
export function titleForSegment(segment: string): string {
  if (segment === 'settings') return 'Settings';
  if (segment === 'setup') return 'Setup guide';
  const item = NAV_ITEMS.find((n) => n.to === segment);
  return item?.label ?? 'Dashboard';
}
