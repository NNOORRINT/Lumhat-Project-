const json = (response, status, body) => {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return json(response, 405, { message: 'Method not allowed.' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!supabaseUrl || !publishableKey) {
    return json(response, 500, { message: 'Authentication is temporarily unavailable.' })
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

  if (password.length < 6) {
    return json(response, 422, { message: 'Password should be at least 6 characters.' })
  }

  try {
    const signupUrl = new URL('/auth/v1/signup', supabaseUrl)
    signupUrl.searchParams.set(
      'redirect_to',
      process.env.PUBLIC_SITE_URL?.trim() || 'https://www.lumhat.xyz',
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
        email: email.trim(),
        password,
        data: { display_name: displayName.trim() },
      }),
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
