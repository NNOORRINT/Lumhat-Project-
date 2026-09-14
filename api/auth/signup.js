const json = (response, status, body) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  return response.status(status).json(body)
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 8
const rateLimits = new Map()

const clientAddress = (request) => {
  const forwarded = request.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]
  return first?.trim() || request.socket?.remoteAddress || 'unknown'
}

const isRateLimited = (request) => {
  const now = Date.now()
  const key = clientAddress(request)
  const current = rateLimits.get(key)
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > RATE_LIMIT_MAX_REQUESTS
}

const safeSiteUrl = () => {
  const configured = process.env.PUBLIC_SITE_URL?.trim()
  if (!configured) return 'https://www.lumhat.xyz'
  try {
    const url = new URL(configured)
    if (url.protocol === 'https:' || url.hostname === 'localhost') return url.origin
  } catch {
    // Fall through to the known production origin.
  }
  return 'https://www.lumhat.xyz'
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return json(response, 405, { message: 'Method not allowed.' })
  }

  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    return json(response, 415, { message: 'Content-Type must be application/json.' })
  }

  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (!Number.isFinite(contentLength) || contentLength > 8_192) {
    return json(response, 413, { message: 'Request body is too large.' })
  }

  if (isRateLimited(request)) {
    response.setHeader('Retry-After', '60')
    return json(response, 429, { message: 'Too many signup attempts. Please wait a minute.' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!supabaseUrl || !publishableKey) {
    return json(response, 500, { message: 'Authentication is temporarily unavailable.' })
  }

  if (JSON.stringify(request.body ?? {}).length > 4096) {
    return json(response, 413, { message: 'Request is too large.' })
  }

  const { email, password, displayName } = request.body ?? {}
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof displayName !== 'string' ||
    !email.trim() ||
    !displayName.trim()
  ) {
    return json(response, 400, { message: 'Name, email, and password are required.' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = displayName.trim().normalize('NFKC')
  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return json(response, 422, { message: 'Enter a valid email address.' })
  }
  if (normalizedName.length > 80 || /[\u0000-\u001f\u007f]/.test(normalizedName)) {
    return json(response, 422, { message: 'Name must be 80 characters or fewer.' })
  }
  if (password.length < 8 || password.length > 128) {
    return json(response, 422, { message: 'Password must be between 8 and 128 characters.' })
  }

  if (email.length > 254 || password.length > 128 || displayName.trim().length > 80) {
    return json(response, 422, { message: 'One or more fields are too long.' })
  }

  try {
    const signupUrl = new URL('/auth/v1/signup', supabaseUrl)
    signupUrl.searchParams.set(
      'redirect_to',
      safeSiteUrl(),
    )

    const upstream = await fetch(signupUrl, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'lumhat-auth-proxy/1.0',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        data: { display_name: normalizedName },
      }),
      signal: AbortSignal.timeout(10_000),
    })

    const contentType = upstream.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await upstream.json()
      : { message: 'Authentication service returned an invalid response.' }

    return json(response, upstream.status, body)
  } catch {
    return json(response, 502, {
      message: 'Connection interrupted. Please try again in a moment.',
    })
  }
}
