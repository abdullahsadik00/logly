export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, id] as const,
};

export const metricsKeys = {
  today: (projectId: string) => ['metrics', projectId, 'today'] as const,
  trend: (projectId: string, days: number) =>
    ['metrics', projectId, 'trend', days] as const,
  pages: (projectId: string) => ['metrics', projectId, 'pages'] as const,
  events: (projectId: string) => ['metrics', projectId, 'events'] as const,
  revenueBySource: (projectId: string) => ['metrics', projectId, 'revenue-by-source'] as const,
};

export const eventKeys = {
  list: (projectId: string, filters: Record<string, string>) =>
    ['events', projectId, filters] as const,
};

export const alertKeys = {
  list: (projectId: string) => ['alerts', projectId] as const,
};
