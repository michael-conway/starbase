# starbase

React web interface for `irods-go-rest`.

## Overview

`starbase` is a Vite, React, and TypeScript single-page application for
browsing and operating on iRODS data through the `irods-go-rest` API. The active
application surface is centered on authenticated iRODS browsing, resource
inspection, object details, metadata, permissions, tickets, uploads, downloads,
and operator-oriented setup guidance.

It includes:

* Basic and OIDC-backed sign-in paths
* an authenticated app shell with health and service information
* path-first collection and data object browsing
* object detail views for overview, storage, AVUs, permissions, and tickets
* resource listing and resource detail pages
* user and group membership summary browsing
* queued upload management with progress and overwrite handling
* runtime app branding and auth-mode configuration from YAML files in `public/config`
* local development conventions matched to `irods-grid-stack`
* Ubuntu-based Docker image build support and GitHub Actions verification

## Project Metadata

| Field | Value |
| --- | --- |
| Project Name | `starbase` |
| Current Version | `1.0.0-alpha` |
| Status | `Alpha` |
| Primary Developer | `Mike Conway` |
| Organization | `NIEHS` |
| Repository | `https://github.com/michael-conway/starbase` |
| Companion Backend | `../irods-go-rest` |
| Contact | `mike.conway@nih.gov` |
| License | `BSD 2-Clause` |

## Master Index

* [Developer Notes](./DEVELOPER_NOTES.md)
* [Runtime Config Notes](./public/config/README.md)

## Project Structure

The repository follows a conventional Vite and React layout with a thin frontend
over `irods-go-rest`, shared session/config/upload providers, and route-level
page modules.

| Path | Purpose |
| --- | --- |
| `src/main.tsx` | Runtime composition, Mantine theme, React Query, notifications, router bootstrap |
| `src/router.tsx` | Route map, auth gating, and lazy-loaded page registration |
| `src/App.tsx` | Authenticated app shell, navigation, health status, service information |
| `src/app-sections.ts` | Active app sections and scaffolded future section definitions |
| `src/pages/` | Login, setup, explorer, resource, detail, preview, and scaffolded major-view pages |
| `src/providers/` | Session, app config, and upload manager providers |
| `src/lib/irods-rest.ts` | Typed `irods-go-rest` client and request helpers |
| `src/features/` | Explorer and file preview helpers |
| `public/config/` | Runtime YAML config loaded by the browser |
| `test/integration/` | Env-gated integration tests against a running backend |
| `Dockerfile` | Ubuntu-based multi-stage production image build |
| `docker/nginx.conf` | nginx SPA fallback config for the production image |
| `.github/workflows/` | npm verification and Docker image build workflows |

## Stack

The current frontend stack is:

* Vite 8
* React 19
* TypeScript 6
* React Router 7
* TanStack Query 5
* Mantine 9
* Tabler React icons
* Node.js 24 in CI and Docker builds

`irods-go-rest` remains the source of truth for API shape, authentication
semantics, and iRODS-facing behavior. `starbase` owns route structure,
workspace interactions, runtime configuration, and browser-oriented UI.

## Active Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to the appropriate app entry point |
| `/login` | Basic or OIDC sign-in |
| `/setup` | Local setup and connection guidance |
| `/app` | Authenticated shell; redirects to explorer |
| `/app/explorer` | Collection and data object browser |
| `/app/explorer/details` | Data object or collection details |
| `/app/explorer/preview` | Preview route for supported file types |
| `/app/search` | Saved metadata query and search workspace |
| `/app/search/queries` | Saved metadata query list |
| `/app/search/queries/new` | New metadata query editor |
| `/app/search/queries/:queryId/edit` | Saved metadata query editor |
| `/app/search/results/:queryId` | Saved metadata query results |
| `/app/resources` | iRODS resource listing |
| `/app/resources/details` | Resource detail page |
| `/app/users` | Users, groups, and membership summaries |
| `/app/settings` | Session settings and enabled user tools |
| `/app/setup` | Setup page inside the authenticated shell |

Rules and generic admin pages are scaffolded in `src/pages/` and declared as
future sections in `src/app-sections.ts`, but they are not part of the active
navigation or route table yet.

## Quick Start

Install dependencies and run the frontend locally:

```bash
npm install
npm run dev
```

By default, the Vite dev server proxies backend traffic to
`http://localhost:8080`. The proxy covers `/api`, `/healthz`, `/openapi.yaml`,
and `/swagger`.

Then visit:

* `http://localhost:5173/login`
* `http://localhost:5173/app/explorer`
* `http://localhost:5173/setup`

The API base URL defaults from runtime config key `RestAPIBaseURL`. Leave it
blank to use the Vite proxy, or provide an absolute backend URL when connecting
to a published `irods-go-rest` service.

## Development Commands

Install from the lockfile:

```bash
npm ci
```

Run lint:

```bash
npm run lint
```

Build the production bundle:

```bash
npm run build
```

Preview the production bundle locally:

```bash
npm run preview
```

The production build runs TypeScript project validation with `tsc -b` and then
the Vite production build.

## Docker Build

Build the Ubuntu-based production image:

```bash
docker build --tag starbase:local .
```

Run the container on local port `5173`:

```bash
docker run --rm -p 5173:8080 starbase:local
```

Then visit `http://localhost:5173/login`.

The image builds the Vite bundle in an `ubuntu:24.04` Node 24 stage and serves
the static output from an `ubuntu:24.04` nginx runtime stage on container port
`8080`.

For a container with a baked-in default backend API URL, set the Vite build arg:

```bash
docker build \
  --tag starbase:local \
  --build-arg VITE_API_BASE_URL=http://127.0.0.1:8080 \
  .
```

`VITE_API_BASE_URL` is embedded at build time by Vite. Prefer runtime
`RestAPIBaseURL` in `/config/starbase.yaml` for compose and published
deployments because it can be changed without rebuilding the static bundle.

## Runtime Configuration

At browser startup, `starbase` loads YAML configuration from:

```text
/config/starbase.yaml
```

For `1.0.0-alpha`, the bundled `public/config/starbase.yaml` intentionally
targets the local `irods-grid-stack` provider REST and Keycloak services.
Published deployments should provide their own browser-reachable
`/config/starbase.yaml` with deployment-specific REST and OIDC endpoints.

Example:

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
```

Set `VITE_STARBASE_CONFIG_PATH=<path>` at build time to load an explicit config file:

```text
<path>
```

Example:

```text
/config/starbase.niehs.yaml
```

Only browser-reachable paths are valid (site-relative `/config/...` or absolute
`http(s)://...` URLs). Filesystem paths like `/Users/...` are ignored and the
app falls back to `/config/starbase.yaml`.

Supported config keys:

* `Title`: app title shown in the authenticated shell
* `Subtitle`: app subtitle shown in the authenticated shell
* `RestAPIBaseURL`: default browser-facing `irods-go-rest` endpoint used at
  startup for API calls; blank keeps same-origin relative API calls
* `OIDCAuthorizationEndpoint`: direct browser PKCE authorization endpoint
* `OIDCTokenEndpoint`: direct browser PKCE token endpoint
* `OIDCClientID`: direct browser PKCE public client ID
* `OIDCScope`: OIDC scopes requested in direct browser PKCE flow
* `OIDCRedirectPath`: callback route path used by direct browser PKCE flow
  (handled under `/auth/*`)
* `AuthMode`: basic auth mode options shown on the login form
* `S3AdminEnabled`: enables S3 administration tools backed by
  `irods-go-rest` `/api/v1/ext/s3/*` routes, including collection bucket
  mappings and user S3 API secret settings

See [public/config/README.md](./public/config/README.md) for the file-level
runtime config notes.

`RestAPIBaseURL` is evaluated in the browser. In Docker Compose deployments it
should usually be the host-facing REST URL, not the Docker-internal service
name.

## Auth Model

The frontend supports two session modes:

* Basic auth with a selectable backend auth type such as `native` or `pam`
* OIDC bearer-token auth

Basic credentials are stored in browser session storage for the current tab and
sent as `Authorization: Basic <base64(user:password)>`.

OIDC supports:

* direct browser PKCE flow (`starbase -> keycloak -> /auth/callback`)

`OIDCAuthorizationEndpoint`, `OIDCTokenEndpoint`, and `OIDCClientID` are
required in `starbase.yaml` for OIDC sign-in.

Session preferences such as preferred auth mode, basic auth type, and resolved
API base URL are stored in local storage. Session secrets are stored in session
storage and are cleared by signing out or closing the browser tab.

## Explorer Model

The explorer is intentionally path-first because the backend contract is
path-first. The UI supports:

* collection child listing with breadcrumbs and quick locations
* scoped searching inside the current collection or subtree
* collection and data object creation
* rename, move, copy, and delete actions
* favorite add/remove support
* upload and download actions
* object and collection detail pages
* replicas, checksums, AVUs, ACLs, inheritance, and tickets
* resource browsing and resource detail inspection

Current backend areas used by the frontend include:

* `GET /healthz`
* `GET /api/v1/server`
* `/api/v1/path`
* `/api/v1/path/children`
* `/api/v1/path/contents`
* `/api/v1/path/replicas`
* `/api/v1/path/avu`
* `/api/v1/path/acl`
* `/api/v1/path/checksum`
* `/api/v1/resource`
* `/api/v1/user`
* `/api/v1/user/me`
* `/api/v1/user/membership-summary`
* `/api/v1/usergroup`
* `/api/v1/usergroup/summary`
* `/api/v1/ticket`
* `/api/v1/ext/favorites`

## Testing

Local verification currently centers on:

```bash
npm run lint
npm run build
```

Integration tests are env-gated and expect a running `irods-go-rest` service:

```bash
STARBASE_INTEGRATION=1 \
STARBASE_TEST_BASE_URL=http://127.0.0.1:8080 \
STARBASE_TEST_BASIC_USERNAME=rods \
STARBASE_TEST_BASIC_PASSWORD=rods \
STARBASE_TEST_IRODS_PATH=/tempZone/home/rods \
STARBASE_TEST_COLLECTION_PATH=/tempZone/home/rods \
npm run test:integration
```

You can use `STARBASE_TEST_BEARER_TOKEN` instead of the basic username/password
variables for bearer-authenticated integration checks.

## Continuous Integration

GitHub Actions currently includes:

* `.github/workflows/basic-checks.yml`: runs on `ubuntu-latest`, installs Node
  24, runs `npm ci`, `npm run lint`, and `npm run build`
* `.github/workflows/docker-build.yml`: runs on `ubuntu-latest` and verifies
  `docker build --tag starbase:ci .`

Both workflows run on pushes to `develop` and pull requests targeting `develop`
or `main`.

## Integration Environment

The preferred local development and integration environment is:

`../irods-grid-stack`

The older `irods-go-drs` Docker Compose framework and the
`../irods-go-rest/deployments/docker-test-framework/5-0` stack previously used
for Starbase development are deprecated. Use `irods-grid-stack` for new local
development, integration testing, and OIDC/S3/DRS scenarios.

With the `frontend` profile, `irods-grid-stack` starts PostgreSQL, Keycloak,
the iRODS provider and resource servers, provider/resource `irods-go-rest`,
`irods-go-drs`, S3 endpoints, and a published Starbase container. You can still
run this repository with Vite on port `5173` against the same provider REST
endpoint.

Typical workflow:

```bash
cd ../irods-grid-stack
cp .env.example .env
docker compose --profile frontend config --quiet
docker compose --profile frontend up -d --build
```

Use the provider REST endpoint at `http://127.0.0.1:8080` for
`RestAPIBaseURL`, `VITE_PROXY_TARGET`, or `STARBASE_TEST_BASE_URL`. If the
backend is published elsewhere, set `VITE_PROXY_TARGET`, `VITE_API_BASE_URL`,
or runtime `RestAPIBaseURL` to that browser-facing URL.

## Environment

Supported frontend environment variables:

* `VITE_PROXY_TARGET`: dev server proxy target, defaulting to `http://localhost:8080`;
  use `http://127.0.0.1:8080` to match the `irods-grid-stack` defaults
* `VITE_API_BASE_URL`: production bundle default API base URL used when
  runtime config does not set `RestAPIBaseURL`
* `VITE_STARBASE_CONFIG_PATH`: runtime config path override (for example `/config/starbase.niehs.yaml`)

Supported integration test environment variables:

* `STARBASE_INTEGRATION`
* `STARBASE_TEST_BASE_URL`
* `STARBASE_TEST_BEARER_TOKEN`
* `STARBASE_TEST_BASIC_USERNAME`
* `STARBASE_TEST_BASIC_PASSWORD`
* `STARBASE_TEST_IRODS_PATH`
* `STARBASE_TEST_COLLECTION_PATH`

## References

* React: https://react.dev/
* Vite: https://vite.dev/
* Mantine: https://mantine.dev/
* TanStack Query: https://tanstack.com/query/latest
* React Router: https://reactrouter.com/home
* iRODS Grid Stack: ../irods-grid-stack/README.md
* iRODS Go REST: ../irods-go-rest/README.md
