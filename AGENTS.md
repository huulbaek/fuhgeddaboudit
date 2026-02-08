# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Nuxt frontend (pages, layouts, components, composables, and `app/assets/css/main.css`).
- `server/`: Nitro API routes and backend logic.
- `server/database/`: Drizzle client, schema, and SQL migrations (`server/database/migrations/`).
- `tests/unit/`: Vitest unit/integration-style tests (`*.test.ts`).
- `public/`: Static assets (logos, images).
- `scripts/`: Utility scripts used by local automation.

## Build, Test, and Development Commands
- `bun install`: Install dependencies.
- `docker compose up -d`: Start local PostgreSQL (mapped to `localhost:5434`).
- `bun run dev`: Start local Nuxt dev server at `http://localhost:3000`.
- `bun run build`: Build production bundle.
- `bun run preview`: Run production preview server.
- `bun test`: Run all tests with Vitest.
- `npx vitest run tests/unit/login.test.ts`: Run a single test file.
- `bun run db:push`: Push Drizzle schema to DB.
- `bun run db:generate`: Generate Drizzle migrations.

## Coding Style & Naming Conventions
- Language: TypeScript + Vue SFCs.
- Use 2-space indentation and keep existing import/order style.
- Components use PascalCase filenames (example: `app/components/emdr/BilateralDot.vue`).
- Composables use `useX` naming (example: `app/composables/useAuth.ts`).
- API route files follow Nitro conventions: `*.get.ts`, `*.post.ts`, `*.patch.ts`, including dynamic params (example: `server/api/sessions/[id].get.ts`).

## Testing Guidelines
- Framework: Vitest with Nuxt test environment (`vitest.config.ts`).
- Put tests in `tests/unit/` and name them `feature-name.test.ts`.
- Add tests for new API validation, composable logic, and critical user flows.
- No hard coverage gate is configured; new behavior should ship with tests.

## Commit & Pull Request Guidelines
- Follow existing commit history style: short, imperative subject lines (commonly `Add ...` / `Fix ...`).
- Keep commits focused and logically grouped.
- PRs should include a clear summary of behavior changes and a linked issue when applicable.
- Include test evidence in the PR (for example, `bun test` output).
- Include screenshots or GIFs for UI changes.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets.
- Keep trauma narrative content client-side only; avoid storing raw memory text server-side.
- Preserve auth, rate-limit, and CSP protections when editing `server/` or `nuxt.config.ts`.
