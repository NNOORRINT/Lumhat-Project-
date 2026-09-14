import { createClient, type User } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(
  url && publishableKey && !url.includes('your-project-ref') && !publishableKey.includes('your-publishable'),
)

export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export type AuthUser = User

const NETWORK_ERROR_MESSAGE =
  'Connection interrupted. Check your internet connection and try again.'

function authErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const body = payload as Record<string, unknown>
  for (const key of ['msg', 'message', 'error_description', 'error']) {
    if (typeof body[key] === 'string' && body[key]) return body[key]
  }
  return fallback
}

function normalizeNetworkError(error: unknown): never {
  if (
    error instanceof TypeError ||
    (error instanceof Error && /load failed|failed to fetch|network request failed/i.test(error.message))
  ) {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }
  throw error
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  } catch (error) {
    normalizeNetworkError(error)
  }
}

export async function signUp(email: string, password: string, displayName: string) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  try {
    // iOS WebKit intermittently rejects cross-origin Supabase signup requests
    // with only "Load failed". Production uses our same-origin Vercel function
    // so the browser never has to make that cross-origin request.
    if (import.meta.env.PROD) {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(authErrorMessage(payload, 'Account creation failed. Please try again.'))
      }

      const authPayload = payload as Record<string, unknown>
      const hasSession = Boolean(authPayload.access_token && authPayload.refresh_token)
      if (hasSession) {
        const { data, error } = await supabase.auth.setSession({
          access_token: String(authPayload.access_token),
          refresh_token: String(authPayload.refresh_token),
        })
        if (error) throw error
        return data
      }

      return {
        user:
          authPayload.user ?? (typeof authPayload.id === 'string' ? authPayload : null),
        session: null,
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw error
    return data
  } catch (error) {
    normalizeNetworkError(error)
  }
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
