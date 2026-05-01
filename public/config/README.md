# Starbase Runtime Config

- Default file loaded at startup: `/config/starbase.yaml`
- Optional environment override:
  - Set `STARBASE_CONFIG_ENV=<name>`
  - Startup file becomes `/config/starbase.<name>.yaml`
  - Example: `STARBASE_CONFIG_ENV=dev` loads `/config/starbase.dev.yaml`

Supported keys:

- `Title`: app title text shown in the top header.
- `Subtitle`: app subtitle text shown under the title.
- `AuthMode`: list of basic auth mode options.
