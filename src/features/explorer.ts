export const defaultPath = '/tempZone/home'
export const defaultZoneRoot = `/${defaultPath.split('/').filter(Boolean).at(0) ?? 'tempZone'}`

export function homePathForUser(username?: string, currentPath?: string) {
  const segments = (currentPath ?? defaultPath).split('/').filter(Boolean)
  const zoneRoot = segments[0] ? `/${segments[0]}` : defaultZoneRoot

  return username ? `${zoneRoot}/home/${username}` : defaultPath
}

export function displayName(path: string) {
  if (path === '/') {
    return '/'
  }

  return path.split('/').filter(Boolean).at(-1) ?? path
}

export function formatDateTime(value?: string) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
