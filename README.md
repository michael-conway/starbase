# starbase

React web interface for `irods-go-rest`.

## Overview

This project provides a React-based single-page application for iRODS browsing
and operator workflows over the `irods-go-rest` API. The current starter is
intentionally focused on the first-use product slice: login, explorer, and
setup. It is designed to grow into a broader browser and administrative tool
without coupling future sections into the initial user experience.

It includes:

* an auth-first browser entry flow with Basic and OIDC-backed paths
* an explorer-first application shell for path browsing and collection work
* a typed path-first client aligned to the current `irods-go-rest` contract
* route-level code splitting and section definitions that can expand later
* local development conventions matched to the `irods-go-rest` docker test framework

## Project Metadata

| Field | Value |
| --- | --- |
| Project Name | `starbase` |
| Current Version | `TBD` |
| Status | `Active Development` |
| Primary Developer | `Mike Conway` |
| Organization | `NIEHS` |
| Repository | `https://github.com/michael-conway/starbase` |
| Companion Backend | `../irods-go-rest` |
| Contact | `mike.conway@nih.gov` |
| License | `TBD` |

## Master Index

* [Developer Notes](./DEVELOPER_NOTES.md)

## Project Structure

The repository follows a conventional Vite and React layout centered around a
thin frontend over `irods-go-rest`, an auth/session provider, and page-level
workflows for the current browser starter.

| Path | Purpose |
| --- | --- |
| `src/main.tsx` | Runtime composition, Mantine theme, React Query, and router bootstrap |
| `src/router.tsx` | Route map, auth gating, and lazy-loaded page registration |
| `src/App.tsx` | Authenticated app shell, navigation, and API health indicator |
| `src/app-sections.ts` | Active and future section definitions for later expansion |
| `src/providers/` | Shared frontend state providers such as session/auth state |
| `src/lib/` | `irods-go-rest` client and request helpers |
| `src/pages/` | Login, explorer, setup, and future major-view page modules |
| `public/` | Static frontend assets |
| `test/integration/` | Env-gated integration tests against a running backend |

## Stack and Testing Strategy

The implementation is written in React and TypeScript and keeps the frontend
thin relative to the backend. `irods-go-rest` remains the source of truth for
API shape, authentication semantics, and iRODS-facing behavior, while `starbase`
owns route structure, workspace interactions, and browser-oriented UI design.

The current stack is:

* Vite
* React
* TypeScript
* React Router
* TanStack Query
* Mantine

Mantine is currently used for the application shell, forms, overlays, and
general UI primitives. The long-term intent is to keep explorer-specific
interaction patterns explicit rather than depending on a generic component suite
to define the browser UX.

Testing is currently centered on:

* compile-time validation through `tsc -b`
* production bundle verification through `vite build`
* env-gated integration tests in `test/integration/`
* backend contract validation by staying aligned to `../irods-go-rest`

## Quick Start

Run the frontend locally:

```bash
npm install
npm run dev
```

By default, the Vite dev server proxies backend traffic to
`http://localhost:8080`.

Then visit:

* `http://localhost:5173/login`
* `http://localhost:5173/app/explorer`
* `http://localhost:5173/setup`

## Development Build

Build the production bundle locally:

```bash
npm run build
```

This runs TypeScript compilation and then the Vite production build.

## Auth Model

The frontend follows the current `irods-go-rest` auth model and exposes two
entry paths:

* Basic auth
* OIDC-backed bearer auth

Basic credentials can be entered directly in the SPA and are sent as
`Authorization: Basic <base64(user:password)>`.

OIDC currently uses the backend browser flow under `/web/login`. Until
`irods-go-rest` exposes an SPA-oriented session endpoint, the frontend launches
that browser flow and accepts a pasted access token for bearer-authenticated API
requests.

## Explorer Model

The explorer is intentionally path-first because the current backend is
path-first.

Current backend endpoints used by the starter:

* `GET /healthz`
* `GET /api/v1/path?irods_path=...`
* `GET /api/v1/path/children?irods_path=...`
* `GET /api/v1/path/contents?irods_path=...`

The current UI emphasizes:

* login that leads directly into the browser workspace
* path navigation with breadcrumbs
* collection child listing
* object detail display
* upload and download entry points

Future major areas such as search, rules, and administration remain scaffoldable
in `src/app-sections.ts`, but they are intentionally not part of the active
route table or visible navigation today.

## Styling and Customization

The visual baseline is currently optimized for clarity, legibility, and a
professional light theme. Shared theme and CSS variables in `src/main.tsx` and
`src/index.css` are intended to be the customization boundary for future style
work, so palette changes do not require page-by-page rewrites.

The current design goals are:

* readable and accessible defaults
* restrained visual density
* clean page hierarchy
* separation between shell styling and explorer-specific interaction design

## Integration Environment

The canonical local integration environment lives under:

`../irods-go-rest/deployments/docker-test-framework/5-0`

That compose stack starts PostgreSQL, an iRODS provider, and Keycloak for
end-to-end development and OIDC testing.

Typical workflow:

```bash
cd ../irods-go-rest/deployments/docker-test-framework/5-0
docker compose build
docker compose up
```

Then run `irods-go-rest` on `http://localhost:8080` and keep `starbase` on the
default Vite proxy, or set `VITE_PROXY_TARGET` / `VITE_API_BASE_URL` if the
backend is published elsewhere.

## Environment

Supported frontend environment variables:

* `VITE_PROXY_TARGET`
* `VITE_API_BASE_URL`

## References

* React: https://react.dev/
* Vite: https://vite.dev/
* Mantine: https://mantine.dev/
* TanStack Query: https://tanstack.com/query/latest
* React Router: https://reactrouter.com/home
* iRODS Go REST: ../irods-go-rest/README.md
