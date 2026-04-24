export const defaultPath = '/tempZone/home'

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

  return new Intl.NumberFormat('en-US', {
    notation: size > 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(size)
}
