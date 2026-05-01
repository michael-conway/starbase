/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly STARBASE_CONFIG_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
