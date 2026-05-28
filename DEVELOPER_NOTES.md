## Handoff Note (2026-05-28)

Current problem to resume tomorrow:

* Direct Starbase PKCE login (`starbase -> keycloak -> starbase callback`) is
  implemented and the browser callback completes, but API calls from Starbase
  to local `irods-go-rest` still fail with bearer-token verification errors.
* `irods-go-rest` logs show repeated:
  * `error_code=invalid_token`
  * `error_class=auth_error`
  * `bearer token verification failed error=unauthorized`
* CORS preflight is now working (OPTIONS return `204`), so this is no longer a
  CORS-origin issue.

Important symptom seen in browser console:

* `starbase-config.ts:394 [starbase] Ignoring VITE_STARBASE_CONFIG_PATH=/Users/.../starbase.yaml because browser config must be an HTTP(S) or site-relative path.`
* This means a local filesystem path was supplied for
  `VITE_STARBASE_CONFIG_PATH`, which the app intentionally rejects. Runtime
  config falls back to `/config/starbase.yaml`.

Implication:

* Testing may be using a different runtime config than expected unless
  `VITE_STARBASE_CONFIG_PATH` is set to a browser-reachable path such as
  `/config/starbase-local.yaml`.

State of related work already completed:

* Starbase direct PKCE flow added (authorization redirect + `/auth/*`
  callback + token exchange).
* `starbase.yaml` and `starbase-local.yaml` updated with PKCE keys and
  `/web/login` fallback.
* `irods-grid-stack` patched with `starbase-spa` Keycloak client (redirect URIs
  for `http://localhost:8081/auth/callback` and
  `http://localhost:5173/auth/callback`) and audience mapper targeting
  `irods-go-rest`.
* `irods-go-rest` `rest-config.yaml` CORS defaults expanded to include both
  `8081` and `5173` localhost/127.0.0.1 origins.

Next debug steps for tomorrow:

1. Confirm Starbase is loading the intended config file (site-relative path, no
   filesystem path).
2. Decode the Starbase access token and verify:
   * `iss = https://localhost:8443/realms/drs`
   * `azp = starbase-spa`
   * `aud` includes `irods-go-rest`
3. Call Keycloak introspection manually with `irods-go-rest` client creds to
   determine if token is `active` for that client.
4. If `aud` is missing or introspection not active, force Keycloak realm
   re-import/recreate in `irods-grid-stack` and re-login to mint a fresh token.

## AI Summary

This block is intended as a short operational summary for Codex or another AI
assistant working in this repository.

`starbase` is the SPA frontend companion to `irods-go-rest`. The current
product slice is intentionally narrow: first-open login, a focused explorer
workspace, and setup guidance for the shared local stack. Do not expand the
visible product surface casually. Search, rule execution, and administration may
arrive later, but they should not shape the current UX until there is a clear
need and a coherent workflow for each.

Primary frontend model:

* unauthenticated users land on `/login`
* successful auth moves the user into `/app/explorer`
* `/app/setup` exists as supporting workflow and local-stack guidance
* the explorer is path-first because `irods-go-rest` is path-first
* `irods-go-rest` owns auth semantics, API contract, and iRODS behavior

Design assumptions:

* keep the first-use experience concise and readable
* prefer a Drive-like browser feel over a dashboard full of unrelated panels
* keep login, shell, and explorer concerns separate
* preserve route and section boundaries so broader future workflows can be added
  without restructuring the current app
* keep styling centralized in theme and CSS variables so future customization is
  practical
* prefer accessible, professional, light-theme defaults unless there is a clear
  product reason to change them
* always flag frontend complexity that could be removed by adding or refining a
  backend REST service
* do not normalize avoidable domain or workflow complexity in the UI or
  JavaScript layer when it belongs in `irods-go-rest`
* when a feature starts requiring fragile client-side orchestration, propose the
  corresponding backend contract or service change explicitly

Implementation assumptions:

* `src/router.tsx` should only register the currently active product sections
* `src/app-sections.ts` may describe future sections, but those should remain
  non-routable and non-prominent until activated intentionally
* `src/lib/irods-rest.ts` should stay thin and aligned to the backend contract
* `src/providers/session.tsx` is the frontend auth/session boundary
* explorer-specific interaction patterns should be treated as product code, not
  as accidental side effects of a component library
* if implementing a UI feature requires encoding backend-facing workflow logic,
  state reconciliation rules, or path semantics in the frontend, stop and note
  the upper-layer service change that would simplify the client

When changing the UI, favor stronger separation of concerns over short-term
convenience. Avoid turning the explorer into a generic card dashboard. Avoid
mixing future admin or advanced tools into the visible starter unless the user
explicitly asks for them.

## Planning

### AI Context Instructions

Use these assumptions when continuing work in `starbase`:

* `starbase` is intentionally developed in lockstep with `irods-go-rest`
* frontend page features should be linked explicitly to backend REST routes that
  enable them
* route proposals should follow the REST design philosophy already documented in
  `../irods-go-rest/DEVELOPER_NOTES.md`
* preserve the current path-first backend model:
  `GET /api/v1/path?irods_path=...` remains the canonical lookup pattern
* prefer one generic path resource with typed subresources such as
  `/children`, `/contents`, `/metadata`, and `/acl`
* avoid inventing separate top-level file-versus-collection endpoint families
  unless there is a strong reason to introduce a new identifier space
* keep the visible product slice focused until a new top-level workflow is
  product-ready
* always identify frontend complexity that should instead be provided by an
  upper service layer in `irods-go-rest`
* do not encode avoidable business rules, path interpretation rules, or
  multi-step orchestration logic in the browser if a REST service can absorb it

When a frontend feature is proposed, ask:

* what exact user workflow does this enable?
* does the current backend contract already support it?
* if not, what path-oriented route or subresource is missing?
* can the route be expressed as a RESTful subresource of `/path`?
* does the new route preserve the same identifier and navigation philosophy as
  `irods-go-rest`?
* what complexity is currently being carried in the UI that should be pushed up
  into `irods-go-rest` instead?

# Starbase Developer Notes

## Overview

This document records architecture, workflow, and implementation notes for
`starbase`, the React frontend for `irods-go-rest`.


## Current Architecture

The current frontend shape is:

* `src/main.tsx` composes the Mantine theme, notifications, React Query, session
  provider, and router
* `src/router.tsx` owns auth-gated routing and lazy-loaded page registration
* `src/App.tsx` owns the authenticated shell and navigation chrome
* `src/providers/session.tsx` owns frontend auth/session state
* `src/lib/irods-rest.ts` owns typed backend requests
* `src/pages/LoginPage.tsx` owns the first-open auth workflow
* `src/pages/ExplorerPage.tsx` owns the current browser workspace
* `src/pages/SetupPage.tsx` owns local stack and integration guidance

## Backend Alignment

`starbase` should remain thin relative to `irods-go-rest`.

The backend currently defines:

* authentication semantics
* the path-first API contract
* browser login flow under `/web/*`
* iRODS integration behavior

If the backend contract changes, `src/lib/irods-rest.ts` and the explorer
workflows should be updated to match rather than inventing a parallel frontend
resource model.

## Auth Notes

The frontend supports:

* Basic auth entered directly in the SPA
* OIDC-backed bearer auth launched through `irods-go-rest` browser login

Current constraint:

* OIDC is still a manual token handoff from the backend web session page into
  the SPA because the backend does not yet expose an SPA-friendly session
  endpoint

When that backend capability exists, the right place to evolve is
`src/providers/session.tsx` and the login flow, not the page-level data access
code.

## Explorer Design Notes

The explorer is intended to be a Drive-like iRODS browser.

Current priorities:

* path entry and navigation
* breadcrumb traversal
* collection child listing
* object details
* upload and download entry points

Near-term design guidance:

* keep the explorer focused on browsing and file work
* do not overload it with admin or advanced operator features
* prefer layouts that support left navigation, central listing, and optional
  detail surfaces over dense dashboard cards
* treat collection and object workflows as related but not identical

## Styling Notes

The current visual baseline is intentionally conservative:

* light theme
* readable typography
* restrained accent usage
* centralized style tokens

Theme and palette customization should primarily flow through:

* `src/main.tsx`
* `src/index.css`

Avoid baking visual policy into many page components. Keep page code focused on
layout and workflow structure.

## Future Expansion

Search, rules, and administration are still valid future directions, but they
should be added as distinct top-level workflows only when there is enough
product clarity to justify them.

Until then:

* keep future sections out of the active route table
* keep visible navigation tightly scoped
* avoid writing copy that over-promises incomplete areas

## Local Workflow

Run the frontend:

```bash
npm install
npm run dev
```

Run a production build:

```bash
npm run build
```

Run the frontend integration test suite against a running backend:

```bash
STARBASE_INTEGRATION=1 \
STARBASE_TEST_BASE_URL=http://127.0.0.1:8080 \
STARBASE_TEST_BEARER_TOKEN='your bearer token' \
STARBASE_TEST_IRODS_PATH='/tempZone/home/test1/file.txt' \
STARBASE_TEST_COLLECTION_PATH='/tempZone/home/test1/project' \
npm run test:integration
```

Basic-auth integration is also supported through:

* `STARBASE_TEST_BASIC_USERNAME`
* `STARBASE_TEST_BASIC_PASSWORD`

## Shared Local Stack

The preferred local integration environment is:

`../irods-grid-stack`

The older `irods-go-drs` Docker Compose framework and the
`../irods-go-rest/deployments/docker-test-framework/5-0` stack are deprecated
for Starbase development.

Typical flow:

```bash
cd ../irods-grid-stack
cp .env.example .env
docker compose --profile frontend config --quiet
docker compose --profile frontend up -d --build
```

Then run this repository with Vite against the grid-stack provider REST endpoint
at `http://127.0.0.1:8080`, or use the Starbase container exposed by the stack.

## Developer Links

* [README.md](./README.md): project overview, setup, and environment notes
* [src/main.tsx](./src/main.tsx): app bootstrapping, theme, notifications, and query setup
* [src/router.tsx](./src/router.tsx): route map and auth gating
* [src/App.tsx](./src/App.tsx): shell, navigation, and health indicator
* [src/pages/LoginPage.tsx](./src/pages/LoginPage.tsx): first-open login workflow
* [src/pages/ExplorerPage.tsx](./src/pages/ExplorerPage.tsx): browser workspace
* [src/pages/SetupPage.tsx](./src/pages/SetupPage.tsx): local integration guidance
* [src/lib/irods-rest.ts](./src/lib/irods-rest.ts): typed API client for `irods-go-rest`
* [vite.config.ts](./vite.config.ts): dev proxy setup
* [.env.example](./.env.example): frontend environment variables
* [test/integration/irods-go-rest.integration.test.mjs](./test/integration/irods-go-rest.integration.test.mjs): env-gated integration checks
* [../irods-grid-stack/README.md](../irods-grid-stack/README.md): preferred Compose development environment
* [../irods-go-rest/README.md](../irods-go-rest/README.md): backend overview and auth model
* [../irods-go-rest/DEVELOPER_NOTES.md](../irods-go-rest/DEVELOPER_NOTES.md): backend design philosophy and route guidance
