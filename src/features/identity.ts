import type { AuthMode } from '../lib/irods-rest'

export function userFromOIDCToken(token: string) {
  const payload = token.split('.')[1]
  if (!payload) {
    return ''
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    )
    const decoded = JSON.parse(window.atob(paddedPayload)) as {
      preferred_username?: string
      irods_user_name?: string
      email?: string
      sub?: string
    }

    return (
      decoded.irods_user_name?.trim() ||
      decoded.preferred_username?.trim() ||
      decoded.email?.trim() ||
      decoded.sub?.trim() ||
      ''
    )
  } catch {
    return ''
  }
}

export function currentSessionUserName(input: {
  authMode: AuthMode
  basicUsername: string
  oidcToken: string
}) {
  return input.authMode === 'basic'
    ? input.basicUsername.trim()
    : userFromOIDCToken(input.oidcToken)
}
