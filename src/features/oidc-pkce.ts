interface OidcPkceTransaction {
  state: string
  codeVerifier: string
  baseUrl: string
  createdAt: number
}

interface StartOidcPkceSignInInput {
  authorizationEndpoint: string
  clientId: string
  scope: string
  redirectUri: string
  baseUrl: string
}

interface CompleteOidcPkceSignInInput {
  tokenEndpoint: string
  clientId: string
  redirectUri: string
  code: string
  state: string
}

interface OidcTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  error?: string
  error_description?: string
}

const pkceTransactionStorageKey = 'starbase.oidc.pkce.transaction'
const transactionMaxAgeMs = 10 * 60 * 1000

function encodeBase64Url(bytes: Uint8Array) {
  const base64 = window.btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomBase64Url(bytesLength = 32) {
  const bytes = new Uint8Array(bytesLength)
  window.crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

async function sha256Base64Url(value: string) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return encodeBase64Url(new Uint8Array(digest))
}

function savePkceTransaction(transaction: OidcPkceTransaction) {
  window.sessionStorage.setItem(pkceTransactionStorageKey, JSON.stringify(transaction))
}

function loadPkceTransaction() {
  const raw = window.sessionStorage.getItem(pkceTransactionStorageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as OidcPkceTransaction
    if (
      !parsed ||
      typeof parsed.state !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.baseUrl !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null
    }

    if (Date.now() - parsed.createdAt > transactionMaxAgeMs) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function clearPkceTransaction() {
  window.sessionStorage.removeItem(pkceTransactionStorageKey)
}

export async function startOidcPkceSignIn(input: StartOidcPkceSignInInput) {
  const state = randomBase64Url(32)
  const codeVerifier = randomBase64Url(32)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  savePkceTransaction({
    state,
    codeVerifier,
    baseUrl: input.baseUrl.trim(),
    createdAt: Date.now(),
  })

  const authorizationUrl = new URL(input.authorizationEndpoint)
  authorizationUrl.searchParams.set('client_id', input.clientId)
  authorizationUrl.searchParams.set('redirect_uri', input.redirectUri)
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('scope', input.scope)
  authorizationUrl.searchParams.set('state', state)
  authorizationUrl.searchParams.set('code_challenge', codeChallenge)
  authorizationUrl.searchParams.set('code_challenge_method', 'S256')

  return authorizationUrl.toString()
}

export async function completeOidcPkceSignIn(input: CompleteOidcPkceSignInInput) {
  const transaction = loadPkceTransaction()
  if (!transaction) {
    throw new Error('Missing or expired OIDC sign-in transaction. Start sign-in again.')
  }

  if (transaction.state !== input.state) {
    clearPkceTransaction()
    throw new Error('OIDC sign-in state mismatch. Start sign-in again.')
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', input.code)
  body.set('redirect_uri', input.redirectUri)
  body.set('client_id', input.clientId)
  body.set('code_verifier', transaction.codeVerifier)

  const response = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })

  const payload = (await response.json().catch(() => null)) as OidcTokenResponse | null
  if (!response.ok) {
    const code = payload?.error?.trim()
    const description = payload?.error_description?.trim()
    const details = code && description ? `${code}: ${description}` : code || description
    throw new Error(details || `Token exchange failed (${response.status})`)
  }

  const accessToken = payload?.access_token?.trim()
  if (!accessToken) {
    throw new Error('OIDC token response did not include access_token.')
  }

  clearPkceTransaction()

  return {
    accessToken,
    baseUrl: transaction.baseUrl,
  }
}

export function clearOidcPkceSignInTransaction() {
  clearPkceTransaction()
}
