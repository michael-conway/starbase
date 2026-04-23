# DEV Notes

## Local project docs

- [README.md](./README.md): project overview, setup, and environment notes
- [src/main.tsx](./src/main.tsx): app bootstrapping, Mantine provider, notifications, and React Query setup
- [src/router.tsx](./src/router.tsx): route map for the explorer and setup pages
- [src/App.tsx](./src/App.tsx): shared shell, header, and health check wiring
- [src/pages/ExplorerPage.tsx](./src/pages/ExplorerPage.tsx): primary object and collection lookup UI
- [src/pages/SetupPage.tsx](./src/pages/SetupPage.tsx): local integration and environment guidance
- [src/lib/irods-rest.ts](./src/lib/irods-rest.ts): typed API client for `irods-go-rest`
- [vite.config.ts](./vite.config.ts): dev proxy setup for local backend access
- [.env.example](./.env.example): supported frontend environment variables
- [test/integration/irods-go-rest.integration.test.mjs](./test/integration/irods-go-rest.integration.test.mjs): env-gated integration checks against a running `irods-go-rest` service
- [.github/workflows/basic-checks.yml](./.github/workflows/basic-checks.yml): basic CI checks for pushes to `develop` and PRs into `develop` or `main`

## Backend docs and API

- [irods-go-rest README](../irods-go-rest/README.md): backend service overview, auth model, and local runtime notes
- [irods-go-rest OpenAPI](../irods-go-rest/api/openapi.yaml): current API contract used by starbase
- [irods-go-rest HTTP handlers](../irods-go-rest/internal/httpapi/handler.go): route wiring for `/healthz`, `/swagger`, `/web/*`, and `/api/v1/*`
- [irods-go-rest catalog handlers](../irods-go-rest/internal/httpapi/handlers_catalog.go): object and collection endpoint behavior
- [irods-go-rest docker test framework](../irods-go-rest/deployments/docker-test-framework/5-0/docker-compose.yml): compose-backed iRODS, Postgres, and Keycloak development stack
- [irods-go-rest docker notes](../irods-go-rest/deployments/README.md): top-level deployment notes for the versioned docker test framework

## Integration test references

- [irods-go-drs integration env helper](../irods-go-drs/test/integration_support_test.go): env-gated integration test conventions
- [irods-go-drs iRODS integration tests](../irods-go-drs/test/drs_to_irods_service_integration_test.go): compose-backed iRODS tests against the `deployments/docker-test-framework/5-0` stack
- [irods-go-drs deployment notes](../irods-go-drs/deployments/README.md): matching docker test framework overview

## External docs

- [React docs](https://react.dev/)
- [Vite docs](https://vite.dev/)
- [Mantine docs](https://mantine.dev/)
- [TanStack Query docs](https://tanstack.com/query/latest)
- [React Router docs](https://reactrouter.com/home)

## Current API surface

- `GET /healthz`
- `GET /api/v1/objects/{object_id}`
- `GET /api/v1/collections/{collection_id}`
- `GET /swagger`
- `GET /openapi.yaml`
- `GET /web/login`

## Architecture summary

Starbase is a thin React frontend over `irods-go-rest`. `main.tsx` composes the
runtime providers, `router.tsx` defines the top-level navigation, `App.tsx`
provides the shared application shell and health status indicator, and the page
components handle user workflows. Data access is centralized in
`src/lib/irods-rest.ts`, which keeps the UI aligned to the backend OpenAPI
contract while Vite handles local proxying during development.

For local end-to-end work, treat `../irods-go-rest` as the active companion
backend and `../irods-go-rest/deployments/docker-test-framework/5-0` as the
shared integration environment. `irods-go-drs` is the reference for how to
structure integration-test assumptions around that stack.
