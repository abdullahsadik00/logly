import type { ApiError } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Build request headers, attaching the Bearer token when the user is authenticated. */
function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'HttpError';
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  // Try to parse JSON regardless of content-type — our API always returns JSON
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response (e.g. 204 No Content)
    body = null;
  }

  if (!res.ok) {
    // An expired/invalid token should drop the session so guards bounce to /login
    // rather than leaving the user on a page that can never load data.
    if (res.status === 401) {
      useAuthStore.getState().logout();
    }
    const error = body as ApiError;
    throw new HttpError(res.status, {
      message: error?.message ?? `HTTP ${res.status}`,
      code: error?.code,
    });
  }

  return body as T;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export const api = {
  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const res = await fetch(buildUrl(path, params), {
      method: 'GET',
      credentials: 'include',
      headers: authHeaders(),
    });
    return parseResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return parseResponse<T>(res);
  },

  async del<T = void>(path: string): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'DELETE',
      credentials: 'include',
      headers: authHeaders(),
    });
    return parseResponse<T>(res);
  },
};

export { HttpError };
