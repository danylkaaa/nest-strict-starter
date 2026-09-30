# web

React 19 + Vite SPA. UI: Chakra UI v3 (`ChakraProvider` with `defaultSystem`, no CLI snippets). Server state: TanStack Query. Client UI state: zustand. Routing: React Router.

## Layout

- `src/app/` — providers (`app.tsx`), routes (`router.tsx`), shell (`layout.tsx`, `sidebar.tsx`)
- `src/pages/` — simple pages with no data (e.g. `home-page.tsx`)
- `src/features/<name>/` — one folder per feature: types, API functions, query hooks, store, components. Reference: `src/features/emails/`
- Import across folders with the `@/` alias (`@/features/...`); `import/no-relative-parent-imports` forbids `../`

## Patterns

- Server data goes through a TanStack Query hook (`use-emails-page.ts`); components never call API functions directly. Why: caching, loading, and error states in one place
- UI state that outlives a component (current page, expanded row) lives in a feature zustand store (`emails-store.ts`)
- The emails API is simulated: `emails-api.ts` returns deterministic data from `mock-emails.ts` with fake latency. Replace the body of `fetchEmails` with a real `fetch` once the backend endpoint exists; the hook and components stay unchanged
- Pagination is page-number based (`Page<T>` in `email.ts`) with Previous/Next buttons; `keepPreviousData` keeps the list on screen while the next page loads

## Testing

- Unit-test pure logic only (`*.spec.ts` next to source, vitest, node environment): pagination, formatting, data helpers
- No component or e2e tests for UI. Verify UI manually in a browser (Claude in Chrome MCP when available); the app needs no auth

## Commands

`pnpm --filter web dev` (Vite on :5173), `pnpm --filter web test`, `pnpm --filter web build`.
