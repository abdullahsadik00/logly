import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { eventKeys } from '@/lib/queryKeys';
import type { EventRow, Paginated } from '@/types';

const PAGE_SIZE = 50;

const TYPE_OPTIONS = [
  { label: 'All types', value: '' },
  { label: 'Page views', value: 'pageview' },
  { label: 'Custom events', value: 'custom' },
];

function TypeBadge({ type }: { type: EventRow['type'] }) {
  if (type === 'pageview') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-900/60 text-indigo-300">
        pageview
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-300">
      custom
    </span>
  );
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function ActiveFilterBadge({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/60 border border-indigo-700 text-indigo-300">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-white transition ml-0.5"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  );
}

export default function EventsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;

  // Filter state
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Build the filters object for the query key and API call
  const filters: Record<string, string> = {};
  if (type) filters['type'] = type;
  if (from) filters['from'] = from;
  if (to) filters['to'] = to;
  filters['page'] = String(page);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: eventKeys.list(projectId, filters),
    queryFn: () =>
      api.get<Paginated<EventRow>>(`/api/projects/${projectId}/events`, {
        ...filters,
        page,
      }),
    placeholderData: (prev) => prev, // Keep old data while fetching new page
  });

  const events = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetFilters() {
    setType('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  function handleTypeChange(newType: string) {
    setType(newType);
    setPage(1);
  }

  function handleFromChange(newFrom: string) {
    setFrom(newFrom);
    setPage(1);
  }

  function handleToChange(newTo: string) {
    setTo(newTo);
    setPage(1);
  }

  const hasActiveFilters = type || from || to;

  return (
    <div className="space-y-4">
      {isFetching && !isLoading && <p className="text-xs text-fg-muted">Updating…</p>}
        {/* Filters bar */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Type filter */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-600 text-sm text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => handleFromChange(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-600 text-sm text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition [color-scheme:dark]"
            />
          </div>

          {/* To date */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => handleToChange(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-600 text-sm text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition [color-scheme:dark]"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-slate-400 hover:text-white transition pb-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {type && (
              <ActiveFilterBadge
                label={`type: ${type}`}
                onRemove={() => handleTypeChange('')}
              />
            )}
            {from && (
              <ActiveFilterBadge
                label={`from: ${from}`}
                onRemove={() => handleFromChange('')}
              />
            )}
            {to && (
              <ActiveFilterBadge
                label={`to: ${to}`}
                onRemove={() => handleToChange('')}
              />
            )}
          </div>
        )}

        {/* Results summary */}
        {!isLoading && (
          <p className="text-sm text-slate-500">
            {total.toLocaleString()} event{total !== 1 ? 's' : ''}
            {hasActiveFilters ? ' matching filters' : ''}
          </p>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
            Failed to load events. Please try again.
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Page</th>
                  <th className="px-4 py-3 text-left font-medium">Country</th>
                  <th className="px-4 py-3 text-left font-medium">Device</th>
                  <th className="px-4 py-3 text-left font-medium">Event</th>
                  <th className="px-4 py-3 text-left font-medium">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-slate-700 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : events.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm">
                        No events found{hasActiveFilters ? ' for these filters' : ''}
                      </td>
                    </tr>
                  )
                  : events.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-slate-700/30 transition"
                    >
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono text-xs">
                        {formatTimestamp(event.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <TypeBadge type={event.type} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-200 font-mono text-xs max-w-[200px] truncate">
                        {event.page}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {event.country ?? (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {event.deviceType ?? (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {event.eventName ?? (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs max-w-[180px] truncate">
                        {event.referrer ?? (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && total > 0 && (
            <div className="border-t border-slate-700 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages} — {total.toLocaleString()} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-600 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs px-3 py-1.5 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-600 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs px-3 py-1.5 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
