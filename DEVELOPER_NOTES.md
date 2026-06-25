
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

## Sprint: Users And Groups Administration

Goal: add a focused top-level Starbase function for administering iRODS users,
groups, and group membership through `irods-go-rest`.

Navigation decision:

* add a primary left-nav section labeled `Users & Groups`
* place it at the same level as `Resources`, not under a generic admin page
* route the first usable version at `/app/users`
* keep the existing future `AdminPage` scaffold out of the active route table

Backend contract:

* use `GET /api/v1/user` for user listing and prefix search
* use `POST /api/v1/user` for user creation
* use `GET /api/v1/user/{user_name}` for user details
* use `PUT /api/v1/user/{user_name}/type` for user type updates
* use `PUT /api/v1/user/{user_name}/password` for password updates
* use `DELETE /api/v1/user/{user_name}` for user deletion
* use `GET /api/v1/usergroup` for group listing and prefix search
* use `POST /api/v1/usergroup` for group creation
* use `GET /api/v1/usergroup/{group_name}` for group details and membership
* use `DELETE /api/v1/usergroup/{group_name}` for group deletion
* use `POST /api/v1/usergroup/{group_name}/member` to add a member
* use `DELETE /api/v1/usergroup/{group_name}/member/{user_name}` to remove a
  member

Frontend boundary:

* keep authority decisions in `irods-go-rest`; Starbase should surface `403`
  responses clearly instead of duplicating iRODS policy
* prefer backend-provided action links when present for mutation affordances
* keep `src/lib/irods-rest.ts` as the only API client layer for these routes
* do not introduce Keycloak-specific user or group workflows in this page
* use `/api/v1/ext/*` only if a later workflow is truly extension-specific
* observe API needs while designing each screen; if the UI needs broad
  client-side joins, repeated per-row fetches, or catalog-wide filtering, stop
  and propose an `irods-go-rest` route instead of normalizing inefficiency in
  Starbase

Step 1: API Client Foundation

* add typed user and group models matching `api/openapi.yaml`
* add client functions for user list, create, fetch, update, and delete
* add client functions for group list, create, fetch, delete, add member, and
  remove member
* make cache-key inputs explicit: zone, prefix, user type, selected group
* record any missing response fields or action links needed by the UI before
  adding workaround state in the page
* verify with `npm run lint` and `npm run build`

Step 1 implementation notes:

* `src/lib/irods-rest.ts` now has OpenAPI-shaped user, group, and membership
  models plus route wrappers for the current generic `/api/v1/user*` and
  `/api/v1/usergroup*` APIs
* `searchUsers` and `searchGroups` remain as compatibility aliases for existing
  ACL autocomplete code
* explicit cache-key helpers are available for user lists, user details, group
  lists, and group details
* current list responses are enough for basic read-only tables; list-scale group
  member counts, groups containing a selected user, or user rows with membership
  summaries should be treated as backend API candidates rather than solved with
  Starbase-side N+1 requests
* likely efficient backend candidates, if needed in Step 3, are GenQuery-backed
  relationship or aggregate views exposed through documented `irods-go-rest`
  routes

Step 2: Top-Level Route And Shell Entry

* add a `Users & Groups` primary section in `src/app-sections.ts`
* create a lazy-loaded `src/pages/UsersPage.tsx`
* register `/app/users` through the existing primary-section route mapping
* use a concrete people/group icon from Tabler
* update README route and backend-area lists

Step 3: Read-Only Users And Groups Page

* implement tabs for `Users` and `Groups`
* add zone and prefix filters
* list users with name, type, and zone
* list groups with name, zone, and member count when available
* provide loading, empty, error, and unauthorized states
* keep the first pass read-only until the data shape and navigation feel stable
* identify inefficient data-access patterns, especially if member counts,
  reverse membership lookup, or filtered principals require multiple requests
  per displayed row

Step 3 implementation notes:

* `/app/users` is active as a read-only first pass with `Users` and `Groups`
  tabs, shared zone and prefix filters, loading, empty, error, and explicit
  `403` unauthorized states
* the user table uses `GET /api/v1/user/membership-summary` so rows can show
  user name, type, zone, and group memberships without per-user reverse
  membership requests
* the group table uses `GET /api/v1/usergroup/summary` so member counts are
  list-scale data rather than repeated group detail fetches
* no broad client-side joins, catalog-wide filtering, or per-row detail fetches
  are currently needed for the read-only page
* selected user/group detail views should continue using dedicated backend
  routes, such as `GET /api/v1/user/{user_name}/usergroup` for reverse
  membership and `GET /api/v1/principal` for combined principal search, rather
  than joining large lists in the browser

Step 4: User Mutation Workflows

* add create-user modal with name, type, optional initial password, and optional
  zone
* add edit-user modal for type and/or password changes
* add delete-user confirmation
* invalidate user queries after successful mutations
* handle `409`, `403`, and `404` with specific user-facing messages

Step 4 implementation notes:

* `/app/users` has create, edit, and delete user workflows backed by
  `POST /api/v1/user`, `PUT /api/v1/user/{user_name}/type`,
  `PUT /api/v1/user/{user_name}/password`, and `DELETE /api/v1/user/{user_name}`
* create accepts name, user type, optional initial password, and optional zone
  for `rodsadmin`; for `groupadmin`, create is limited to `rodsuser` with a
  still-optional initial password because PAM-authenticated users may not have
  an iRODS native password
* edit supports user type and/or password updates; returned user types outside
  the mutation enum are not silently coerced before submission
* `groupadmin` is available in create/edit type selectors only when
  `GET /api/v1/user/me` reports the current user is `rodsadmin`
* `irods-go-rest` does not allow a logged-in `groupadmin` user to change user
  password or type, so Starbase hides edit-user controls unless the current
  user is `rodsadmin`
* `groupadmin` cannot delete users, so Starbase hides delete-user controls
  unless the current user is `rodsadmin`; delete uses an explicit confirmation
  modal scoped to the selected user's zone
* successful mutations invalidate user membership summaries, user list/detail,
  reverse membership, and group summary queries so visible list data refreshes
* mutation error handling distinguishes `409`, `403`, and `404` before falling
  back to the backend error message

Step 5: Group And Membership Workflows

* add create-group modal
* add group details surface with member list
* add member by username with autocomplete-style search
* remove member with confirmation
* delete group with confirmation
* invalidate group detail and group list queries after membership mutations

Step 5 authorization notes:

* align Starbase groupadmin affordances with `igroupadmin` rather than generic
  rodsadmin catalog powers
* regular users may list groups through the `lg`-equivalent backend flow when
  allowed by `irods-go-rest`
* `groupadmin` can create `rodsuser` users through the `mkuser`-equivalent
  backend flow; Starbase keeps initial password optional because some
  deployments use PAM-authenticated users without native iRODS passwords
* `groupadmin` can create groups through the `mkgroup`-equivalent backend flow
* `groupadmin` can add users to groups through the `atg`-equivalent backend
  flow and remove users from groups through the `rfg`-equivalent backend flow
* `groupadmin` cannot change existing user password/type and cannot delete users
  or groups

Step 5 implementation notes:

* `/app/users` exposes `lg`-equivalent group summary rows and group detail
  member lists through `GET /api/v1/usergroup/summary` and
  `GET /api/v1/usergroup/{group_name}`
* `mkgroup` is represented by the create-group modal backed by
  `POST /api/v1/usergroup`
* after a groupadmin creates an empty group, Starbase opens that group and
  constrains the first add-member action to the current groupadmin user so the
  UI follows the `igroupadmin mkgroup` then `igroupadmin atg group self` flow
* `atg` is represented by the add-member control in group details, backed by
  `POST /api/v1/usergroup/{group_name}/member`
* `rfg` is represented by a remove-member confirmation modal, backed by
  `DELETE /api/v1/usergroup/{group_name}/member/{user_name}`
* group deletion is rodsadmin-only through `DELETE /api/v1/usergroup/{group_name}`
* group and membership mutations invalidate group summaries, group details,
  user membership summaries, and reverse membership queries

Step 6: Integration Verification

* extend env-gated integration tests for user/group list endpoints first
* add mutation tests only when the test environment has disposable principals
* document required test variables for mutation-safe users and groups
* run `npm run lint`, `npm run build`, and env-gated integration checks

API needs review:

* compare each Starbase workflow against `../irods-go-rest/api/openapi.yaml`
  before implementing UI-side data shaping
* propose new backend routes when the current API requires Starbase to perform
  N+1 group-detail fetches, client-side joins between users and groups, or
  client-side filtering over large catalogs
* consider GenQuery-backed `irods-go-rest` endpoints for efficient aggregate or
  relationship views, such as group member counts, users with group membership
  summaries, groups containing a given user, or principal search across users
  and groups
* keep any custom query surface path-oriented and contract-backed in
  `irods-go-rest`; do not add ad hoc query syntax to Starbase without an
  OpenAPI-documented REST route
* update this sprint with concrete backend route proposals when an API gap is
  found, including request parameters, response shape, auth expectations, and
  whether the implementation should use GenQuery

Open design questions:

* should `/app/users` remain a single tabs page, or should selected users and
  groups eventually get detail routes?
* should mutation controls be hidden when action links are absent, or shown and
  allowed to fail with backend `403`?
* should `reconcile=true` be exposed in the UI, or reserved for automation and
  integration tests?
* should group membership be managed only from group details, or also from user
  details once user detail routes exist?
* does the first page need a backend aggregate endpoint for group member counts,
  or is fetching group details on selection enough for the first usable slice?
* should `irods-go-rest` expose a principal search endpoint that returns users
  and groups together, or should Starbase keep separate user and group search
  controls?

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
