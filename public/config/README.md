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
- `S3AdminEnabled`: enables S3 administration tools, including collection bucket
  mappings and user S3 API secret settings.
