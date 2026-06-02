import {
  IconFolders,
  IconServer2,
  IconCode,
  IconSearch,
  IconSettings,
  type Icon,
} from '@tabler/icons-react'

export interface AppSectionDefinition {
  slug: string
  label: string
  icon: Icon
  importPage: () => Promise<Record<string, unknown>>
  exportName: string
}

export const primarySections: AppSectionDefinition[] = [
  {
    slug: 'explorer',
    label: 'Explorer',
    icon: IconFolders,
    importPage: () => import('./pages/ExplorerPage'),
    exportName: 'ExplorerPage',
  },
  {
    slug: 'search',
    label: 'Search',
    icon: IconSearch,
    importPage: () => import('./pages/SearchPage'),
    exportName: 'SearchPage',
  },
  {
    slug: 'resources',
    label: 'Resources',
    icon: IconServer2,
    importPage: () => import('./pages/ResourcesPage'),
    exportName: 'ResourcesPage',
  },
]

// Keep future major sections declared close to the active explorer section so the
// shell can expand without reorganizing unrelated files later.
export const futureSections: AppSectionDefinition[] = [
  {
    slug: 'rules',
    label: 'Rules',
    icon: IconCode,
    importPage: () => import('./pages/RulesPage'),
    exportName: 'RulesPage',
  },
  {
    slug: 'admin',
    label: 'Admin',
    icon: IconSettings,
    importPage: () => import('./pages/AdminPage'),
    exportName: 'AdminPage',
  },
]
