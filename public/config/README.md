# Starbase Runtime Config

- Default file loaded at startup: `/config/starbase.yaml`
- Optional direct path override:
  - Set `VITE_STARBASE_CONFIG_PATH=<path>`
  - Startup file becomes `<path>`
  - Example: `VITE_STARBASE_CONFIG_PATH=/config/starbase.niehs.yaml`
- Path must be browser-reachable:
  - Valid: `/config/starbase.niehs.yaml`
  - Valid: `https://example.org/config/starbase.yaml`
  - Invalid: local filesystem paths like `/Users/.../starbase.yaml`

Supported keys:

- `Title`: app title text shown in the top header.
- `Subtitle`: app subtitle text shown under the title.
- `AuthMode`: list of basic auth mode options.
- `S3AdminEnabled`: enables S3 administration tools, including collection bucket
  mappings and user S3 API secret settings.
