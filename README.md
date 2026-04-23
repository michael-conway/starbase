# starbase

React web interface for `irods-go-rest`.

## Stack

- Vite
- React + TypeScript
- Mantine
- TanStack Query

Mantine was chosen because it gives the cleanest operator-style UI for a data
console with less setup and design drift than heavier component suites or a
hand-assembled Tailwind stack.

## Development

```bash
npm install
npm run dev
```

By default, the Vite dev server proxies API traffic to
`http://localhost:8080`. Start `irods-go-rest` there or adjust
`VITE_PROXY_TARGET`.

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
# starbase
