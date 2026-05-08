/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STARBASE_CONFIG_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
