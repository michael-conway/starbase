# Starbase Runtime Config

- Local development examples target `../irods-grid-stack`.
- The older `irods-go-drs` Docker Compose framework is deprecated for Starbase
  development.
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
- `RestAPIBaseURL`: default browser-facing `irods-go-rest` base URL used by
  the login form and API calls when the user has not selected another endpoint.
  For `irods-grid-stack`, use the provider REST host URL
  `http://127.0.0.1:8080`. Leave blank to use same-origin relative API paths.
- `AuthMode`: list of basic auth mode options.
- `S3AdminEnabled`: enables S3 administration tools, including collection bucket
  mappings and user S3 API secret settings.

Minimal example:

```yaml
Title: Starbase
Subtitle: iRODS Grid Stack
RestAPIBaseURL: http://127.0.0.1:8080
S3AdminEnabled: true
```
