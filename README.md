# starbase

React web interface for `irods-go-rest`.

[Developer notes](./DEV_NOTES.md)

## Stack

- Vite
- React + TypeScript
- Mantine
- TanStack Query

Mantine was chosen because it gives the cleanest operator-style UI for a data
console with less setup and design drift than heavier component suites or a
hand-assembled Tailwind stack.

Starbase uses Vite for local development and build output, React Router for the
top-level application flow, Mantine for the UI shell and form primitives, and
TanStack Query for backend state. The runtime is split into a small shared app
shell in `src/App.tsx`, route definitions in `src/router.tsx`, page-level
workflows under `src/pages`, and a typed `irods-go-rest` client in
`src/lib/irods-rest.ts`, with Vite proxying API traffic to the Go backend
during local development.

## Development

```bash
npm install
npm run dev
```

By default, the Vite dev server proxies API traffic to
`http://localhost:8080`. Start `irods-go-rest` there or adjust
`VITE_PROXY_TARGET`.

## Integration test

An opt-in integration suite is available for the backend contract that
`starbase` depends on:

```bash
STARBASE_INTEGRATION=1 \
STARBASE_TEST_BASE_URL=http://localhost:8080 \
STARBASE_TEST_BEARER_TOKEN=... \
STARBASE_TEST_OBJECT_ID=... \
STARBASE_TEST_COLLECTION_ID=... \
npm run test:integration
```

Notes:

- `STARBASE_INTEGRATION=1` enables the suite
- `STARBASE_TEST_BASE_URL` defaults to `http://localhost:8080`
- `STARBASE_TEST_BEARER_TOKEN`, `STARBASE_TEST_OBJECT_ID`, and
  `STARBASE_TEST_COLLECTION_ID` gate the protected object and collection checks
- the intended backing environment is
  `../irods-go-rest/deployments/docker-test-framework/5-0`

## Companion repositories

This frontend is intended to be developed alongside these sibling repositories:

- `../irods-go-rest`: the REST API, browser login flow, and iRODS integration boundary
- `../irods-go-drs`: reference project for docker-backed integration tests and local stack conventions

`starbase` should stay thin. API shape, auth, and integration behavior should be
driven from `irods-go-rest`, with `starbase` following that contract rather
than inventing its own backend assumptions.

## Integration environment

The canonical local integration environment lives under:

`../irods-go-rest/deployments/docker-test-framework/5-0`

That compose stack starts PostgreSQL, an iRODS provider, and Keycloak with the
same service names that `irods-go-rest` expects for end-to-end development and
integration testing.

Typical workflow:

```bash
cd ../irods-go-rest/deployments/docker-test-framework/5-0
docker compose build
docker compose up
```

Then either:

- run `irods-go-rest` directly on `http://localhost:8080` and keep `starbase`
  on the default dev proxy, or
- add `irods-go-rest` to that compose network and point `starbase` at the
  published backend URL with `VITE_PROXY_TARGET` or `VITE_API_BASE_URL`

The compose stack exposes the iRODS provider on `1247`, `1248`, and
`20000-20199`, with Keycloak on `8443`.

## Integration test pattern

When `starbase` grows integration coverage, follow the same contract used in
`irods-go-drs`:

- use the docker test framework under `deployments/docker-test-framework/5-0`
- keep environment-specific values behind opt-in env vars
- assume tests can be skipped when the backing stack is not running

The clearest references are:

- `../irods-go-drs/test/integration_support_test.go`
- `../irods-go-drs/test/drs_to_irods_service_integration_test.go`

## Environment

Copy `.env.example` if you want to override defaults:

- `VITE_PROXY_TARGET`: backend target for the Vite dev proxy
- `VITE_API_BASE_URL`: explicit backend origin for built deployments

## Current scope

- Health check against `GET /healthz`
- Object lookup against `GET /api/v1/objects/{object_id}`
- Collection lookup against `GET /api/v1/collections/{collection_id}`
- Bearer token input for protected API calls
- Setup page with local integration notes
