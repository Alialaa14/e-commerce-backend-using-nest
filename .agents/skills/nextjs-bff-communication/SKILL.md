---
name: nextjs-bff-communication
description: Strict patterns for Next.js Server Actions as BFF layer communicating with NestJS backend. Covers auth, API client, error handling, streaming, OAuth, and security patterns.
risk: moderate
source: fashionconnect-core
date_added: "2026-08-06"
---

# Skill: Next.js BFF Pattern (Server Actions → NestJS)

## Architecture Overview

This project uses **Next.js Server Actions as the BFF (Backend-for-Frontend) layer** between React components and a NestJS API.

**Key Principle**: Client components **NEVER** call the backend directly. All data fetching and mutations go through Server Actions.

---

## 1. Core API Client (`src/lib/api-client.ts`)

### Pattern: Centralized Request Wrapper with Auto Token Refresh

```typescript
// MANDATORY: 'server-only' at top of file
import 'server-only';
import { cookies } from 'next/headers';
import { setAuthCookies, clearAuthCookies } from './auth-cookies';

export const BASE_URL = process.env.NESTJS_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Token refresh deduplication - prevents race conditions
const refreshPromises = new Map<string, Promise<string | null>>();

async function handleTokenRefresh(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (!refreshToken) return null;

  if (refreshPromises.has(refreshToken)) {
    return refreshPromises.get(refreshToken)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await clearAuthCookies();
        return null;
      }
      const data = await res.json();
      await setAuthCookies(data.access_token, data.refresh_token || refreshToken);
      return data.access_token;
    } catch (error) {
      return null;
    } finally {
      refreshPromises.delete(refreshToken);
    }
  })();

  refreshPromises.set(refreshToken, promise);
  return promise;
}

async function request<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown> | FormData,
  isRetry = false,
  customFetchOptions: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('access_token')?.value;
  const headers = new Headers(customFetchOptions.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  
  const fetchConfig: RequestInit = {
    ...customFetchOptions,
    method,
    headers,
  };
  
  if (body) {
    if (body instanceof FormData) {
      fetchConfig.body = body;
      headers.delete('Content-Type');
    } else {
      headers.set('Content-Type', 'application/json');
      fetchConfig.body = JSON.stringify(body);
    }
  }
  
  const res = await fetch(`${BASE_URL}${endpoint}`, fetchConfig);
  
  // AUTO REFRESH ON 401
  if (res.status === 401 && !isRetry) {
    const refreshedToken = await handleTokenRefresh();
    if (refreshedToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
      const retryRes = await fetch(`${BASE_URL}${endpoint}`, { 
        ...fetchConfig, 
        headers: retryHeaders 
      });
      if (retryRes.status === 401) {
        const { redirect } = await import('next/navigation');
        redirect('/sign-in');
      }
      return handleResponse<T>(retryRes);
    } else {
      const { redirect } = await import('next/navigation');
      redirect('/sign-in');
    }
  }
  
  if (res.status === 401 && isRetry) {
    const { redirect } = await import('next/navigation');
    redirect('/sign-in');
  }

  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new ApiError(msg || 'Something went wrong', res.status);
  }
  return data as T;
}

export async function apiGet<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return request<T>(endpoint, 'GET', undefined, false, options);
}
export async function apiPost<T>(endpoint: string, body: Record<string, unknown> | FormData): Promise<T> {
  return request<T>(endpoint, 'POST', body);
}
export async function apiPatch<T>(endpoint: string, body: Record<string, unknown> | FormData): Promise<T> {
  return request<T>(endpoint, 'PATCH', body);
}
export async function apiDelete<T>(endpoint: string, body?: Record<string, unknown> | FormData): Promise<T> {
  return request<T>(endpoint, 'DELETE', body);
}
```

---

## 2. Server Actions (`src/features/**/actions.ts`)

### Pattern: Zod Validation & Discriminated Unions

```typescript
'use server';

import { apiGet, apiPost, ApiError } from '@/src/lib/api-client';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
});

type ActionResult = 
  | { success: true; data: any }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createGroupAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  };
  
  const parsed = createGroupSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await apiPost<any>('/groups', parsed.data);
    revalidatePath('/dashboard/groups');
    updateTag('groups');
    return { success: true, data: res.data };
  } catch (err) {
    if ((err as any)?.message === 'NEXT_REDIRECT' || (err as any)?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    if (err instanceof ApiError) {
      return { success: false, error: err.message };
    }
    console.error('createGroupAction error:', err);
    return { success: false, error: 'Internal server error' };
  }
}
```

**CRITICAL RULES FOR SERVER ACTIONS**:
- `'use server'` at top - Required for all Server Actions
- Validate with Zod FIRST - Never trust client input
- Return typed discriminated unions - `{ success: true, data } | { success: false, error }`
- Catch `NEXT_REDIRECT` and re-throw - Next.js uses thrown errors for redirects
- Catch `ApiError` specifically - Map to user-friendly error messages
- Use `revalidatePath` / `updateTag` - Invalidate cache after mutations
- Use `{ cache: 'no-store' }` for GET - Fresh data by default in Server Actions

---

## 3. Route Handlers for Streaming/Proxy (`src/app/api/**/route.ts`)

**Pattern: Next.js Route Handlers as Streaming Proxies**
Use Route Handlers (NOT Server Actions) for:
- Streaming responses (video, SSE, large file uploads)
- Webhook endpoints
- OAuth callbacks
- Any request needing `duplex: 'half'` or ReadableStream

```typescript
// src/app/api/recordings/[room]/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BASE_URL } from '@/src/lib/api-client';
import { cookies } from 'next/headers';

export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ room: string }> }
) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    const backendRes = await fetch(`${BASE_URL}/drive/recording/stream/${resolvedParams.room}`, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers.get('Content-Type') || 'video/webm',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
      },
      body: req.body,
      duplex: 'half'
    } as RequestInit);

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    console.error('Stream Proxy Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

---

## 4. Middleware (`src/proxy.ts`) - Auth Guard at Edge

**Pattern: Next.js Middleware for Route Protection**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function proxy(request: NextRequest) {
  let accessToken = request.cookies.get('access_token')?.value;
  let refreshToken = request.cookies.get('refresh_token')?.value;
  const pathname = request.nextUrl.pathname;

  // Verification logic goes here...

  const isProtectedRoute = pathname.startsWith('/dashboard-') || pathname.startsWith('/setting-profile');
  const isAuthRoute = ['/sign-in', '/sign-up'].some(r => pathname.startsWith(r));

  if (isAuthRoute && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtectedRoute && !accessToken) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## 5. Security Checklist (MUST FOLLOW)

- **HttpOnly Cookies Only**: All tokens in HttpOnly cookies (never localStorage).
- **Auto Token Refresh**: Implemented with promise deduplication (`refreshPromises`) in the API client to prevent race conditions on parallel requests.
- **Zod Validation**: Schema validation on EVERY Server Action input.
- **Error Obfuscation**: Generic error messages for 500s. No stack traces to client.
- **CORS & CSRF**: SameSite=lax cookies = CSRF protection for GET.
- **Content-Type Forwarding**: Validate Content-Type on upload proxies to prevent spoofing.

---

## 6. Anti-Patterns (DO NOT DO)

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| `fetch()` in Client Components | Use Server Actions + `api-client` |
| `localStorage.setItem('token')` | HttpOnly cookies only |
| Try/catch swallowing `NEXT_REDIRECT` | Check `err?.digest?.startsWith('NEXT_REDIRECT')` and re-throw |
| Direct `cookies()` calls in actions | Use `auth-cookies.ts` helpers |
| No Zod validation | Validate every input |
| Server Action for video streaming | Route Handler with `duplex: 'half'` |
| Exposing refresh token to client | Only in HttpOnly cookie |
