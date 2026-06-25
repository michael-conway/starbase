# Starbase Runtime Config

- Local development examples target `../irods-grid-stack`.
- The older `irods-go-drs` Docker Compose framework is deprecated for Starbase
  development.
- Default file loaded at startup: `/config/starbase.yaml`
- For `1.0.0-alpha`, the bundled `starbase.yaml` remains an
  `irods-grid-stack` localhost preset. Published deployments should replace it
  with deployment-specific REST and OIDC endpoints.
- Optional direct path override:
  - Set `VITE_STARBASE_CONFIG_PATH=<path>`
  - Startup file becomes `<path>`
  - Examples:
    - `VITE_STARBASE_CONFIG_PATH=/config/starbase-local.yaml`
    - `VITE_STARBASE_CONFIG_PATH=/config/starbase.niehs.yaml`
- Path must be browser-reachable:
  - Valid: `/config/starbase.niehs.yaml`
  - Valid: `https://example.org/config/starbase.yaml`
  - Invalid: local filesystem paths like `/Users/.../starbase.yaml`

Supported keys:

- `Title`: app title text shown in the top header.
- `Subtitle`: app subtitle text shown under the title.
- `RestAPIBaseURL`: default browser-facing `irods-go-rest` base URL used by
  API calls.
  For `irods-grid-stack`, use the provider REST host URL
  `http://localhost:8080`. Leave blank to use same-origin relative API paths.
- `OIDCAuthorizationEndpoint`: authorization endpoint for direct browser PKCE
  sign-in (for example
  `https://localhost:8443/realms/drs/protocol/openid-connect/auth`).
- `OIDCTokenEndpoint`: token endpoint for direct browser PKCE sign-in (for
  example `https://localhost:8443/realms/drs/protocol/openid-connect/token`).
- `OIDCClientID`: public Keycloak client ID used by Starbase for PKCE.
- `OIDCScope`: requested OIDC scopes (default `openid profile email`).
- `OIDCRedirectPath`: Starbase callback path for PKCE flow (default
  `/auth/callback`; callback URL becomes `<starbase-origin><OIDCRedirectPath>`.
  Route handling is mounted under `/auth/*`.
  `OIDCAuthorizationEndpoint`, `OIDCTokenEndpoint`, and `OIDCClientID` are
  required for OIDC sign-in.
- `AuthMode`: list of basic auth mode options.
- `S3AdminEnabled`: enables S3 administration tools, including collection bucket
  mappings and user S3 API secret settings.
- `UserGroupAdminEnabled`: enables the Users & Groups administration workspace
  for iRODS user, group, and membership operations (default `true`).

Included presets:

- `starbase.yaml`: irods-grid-stack provider REST + Keycloak defaults with
  direct Starbase PKCE sign-in.
- `starbase-local.yaml`: host-run `irods-go-rest` defaults plus Keycloak from
  irods-grid-stack with direct Starbase PKCE sign-in.

Minimal example:

```yaml
Title: Starbase
Subtitle: iRODS Grid Stack
RestAPIBaseURL: http://localhost:8080
OIDCAuthorizationEndpoint: https://localhost:8443/realms/drs/protocol/openid-connect/auth
OIDCTokenEndpoint: https://localhost:8443/realms/drs/protocol/openid-connect/token
OIDCClientID: starbase-spa
OIDCScope: openid profile email
OIDCRedirectPath: /auth/callback
S3AdminEnabled: true
UserGroupAdminEnabled: true
```
