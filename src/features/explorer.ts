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

export function formatBytes(size?: number) {
  if (size === undefined) {
    return 'N/A'
  }

  if (size < 1024) {
    return `${size} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`
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
