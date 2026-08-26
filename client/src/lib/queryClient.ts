import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Clerk Bearer token getter — set by ClerkTokenProvider in App.tsx.
// Allows non-component code to attach Authorization headers to every request.
let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  getTokenFn = fn;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  const token = getTokenFn ? await getTokenFn() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiBinaryRequest<T = unknown>(
  url: string,
  body: Blob,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: await authHeaders(headers),
    body,
    credentials: "include",
  });
  await throwIfResNotOk(response);
  return await response.json() as T;
}

// New code uses apiRequest(method, url, data) and consumes the Response. A
// handful of generated screens use the older apiRequest(url, options) or
// apiRequest<T>(url, method, data) convention. Keeping the compatibility
// overload here gives the application one authenticated transport instead of
// letting those screens fall back to unauthenticated fetch calls.
export async function apiRequest<T = any>(
  first: string,
  second?: string | RequestInit,
  third?: unknown,
): Promise<T> {
  const methodFirst = /^(GET|POST|PUT|PATCH|DELETE)$/.test(first) && typeof second === "string";
  const url = methodFirst ? second as string : first;
  const options = !methodFirst && second && typeof second === "object" ? second : undefined;
  const method = methodFirst ? first : typeof second === "string" ? second : options?.method || "GET";
  const data = methodFirst ? third : typeof second === "string" ? third : options?.body;
  const serializedBody = data == null
    ? undefined
    : typeof data === "string"
      ? data
      : JSON.stringify(data);
  const headers = await authHeaders({
    ...(serializedBody ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers ? Object.fromEntries(new Headers(options.headers).entries()) : {}),
  });
  const res = await fetch(url, {
    ...options,
    method,
    headers,
    body: serializedBody,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  if (methodFirst) return res as T;
  if (res.status === 204) return undefined as T;
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = await authHeaders();
    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
